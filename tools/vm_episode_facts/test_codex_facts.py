import asyncio
import copy
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from book_audio import codex_facts as f

def card(kind='extracted', no_cases=False):
    d=dict(kind=kind,cases=[] if no_cases else [dict(id='c1',title='A story',participants=['A requests, B buys'],events=['First meal and water','Later cola'],essential_context=['A pays, B executes'],author_commentary=['Thought, not spoken dialogue'],evidence=[dict(quote='Original',location='Page 1')])],source_ambiguities=[],source_absences=['Reason not stated'],no_cases_reason='No narrative' if no_cases else '')
    if kind=='reviewed':
        d.update(changes=[],removed_cases=[],voice_budget_ok=True)
        for c in d['cases']:c['voice_notes']='A pays and asks B to buy; meal and water first, cola later. Page 1.'
    return d

class Tests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        (self.root/'sources').mkdir();self.source=self.root/'sources/ep01_content.txt'
        self.source.write_text('Original',encoding='utf-8')
        self.aps=self.root/'audio_prompts.json';self.aps.write_text(json.dumps({'EP01':'Base','EP02':'Unrelated'}),encoding='utf-8')
        self.book=SimpleNamespace(dir=self.root)
        self.first=card();self.second=card('reviewed');self.calls=[]
        async def run(cli,root,question,images):
            self.calls.append(question)
            d=self.first if root.name=='extract' else self.second
            return json.dumps(d),dict(usage=dict(input_tokens=10,output_tokens=5,cached_input_tokens=2),elapsed_seconds=1)
        self.runner=run
        self.probe=patch.object(f,'cli_preflight',return_value=f.CLI_VERSION);self.probe.start()
        self.call=patch.object(f,'call_stage',side_effect=run);self.mockcall=self.call.start()
    def tearDown(self):self.call.stop();self.probe.stop();self.temp.cleanup()
    async def prepare(self):return await f.prepare_codex_episode_facts(self.book,1)
    async def test_two_passes_source_and_style_independent_cache(self):
        r=await self.prepare();self.assertEqual(len(self.calls),2)
        self.assertTrue(all('Original' in p for p in self.calls))
        self.assertEqual(r['usage']['input_tokens'],20)
        self.assertFalse(r['audio_quality_verified'])
        aps=json.loads(self.aps.read_text());aps['EP01']='New style'+aps['EP01'][4:]
        self.aps.write_text(json.dumps(aps));await self.prepare()
        self.assertEqual(len(self.calls),2)
        aps=json.loads(self.aps.read_text());self.assertEqual(aps['EP02'],'Unrelated')
        self.assertTrue(aps['EP01'].startswith('New style'));self.assertEqual(aps['EP01'].count(f.START),1)
        self.source.write_text('Changed',encoding='utf-8');await self.prepare()
        self.assertEqual(len(self.calls),4)
    async def test_full_record_over_2600_and_compact_voice(self):
        self.second['cases'][0]['author_commentary']=['Full details '*350]
        r=await self.prepare();self.assertGreater(len(f.dumps(r['card'])),2600)
        self.assertNotIn('Full details',json.loads(self.aps.read_text())['EP01'])
        self.assertIn('cola later',json.loads(self.aps.read_text())['EP01'])
    async def test_ambiguity_and_failed_recheck_preserve_original_prompt(self):
        before=self.aps.read_bytes();self.second['source_ambiguities']=['Cannot read actor']
        with self.assertRaises(f.EpisodeFactsError):await self.prepare()
        self.assertEqual(before,self.aps.read_bytes())
        self.second=card('reviewed');self.second['voice_budget_ok']=False
        with self.assertRaises(f.EpisodeFactsError):await self.prepare()
        self.assertEqual(before,self.aps.read_bytes())
    async def test_missing_case_and_overflow_fail_no_truncation(self):
        before=self.aps.read_bytes();self.second=card('reviewed',True)
        with self.assertRaises(f.EpisodeFactsError):await self.prepare()
        self.second=card('reviewed');self.second['cases'][0]['voice_notes']='x'*2500
        with self.assertRaises(f.EpisodeFactsError):await self.prepare()
        self.assertEqual(before,self.aps.read_bytes())
    async def test_no_cases_and_unknown_details_not_blocking(self):
        self.first=card(no_cases=True);self.second=card('reviewed',True)
        r=await self.prepare();self.assertEqual(r['card']['cases'],[])
        self.assertIn('No narrative',json.loads(self.aps.read_text())['EP01'])
    async def test_cache_corruption_fails_without_model_calls(self):
        await self.prepare();p=next(self.root.glob('episode_facts/EP01/*/reviewed.json'))
        p.write_text(p.read_text()+' ')
        with self.assertRaises(f.EpisodeFactsError):await self.prepare()
        self.assertEqual(len(self.calls),2)
    async def test_source_or_prompt_changed_inflight_does_not_write_audio(self):
        before=self.aps.read_bytes()
        async def changed(cli,root,question,images):
            result=await self.runner(cli,root,question,images)
            if root.name=='recheck':self.source.write_text('Changed while reading')
            return result
        self.mockcall.side_effect=changed
        with self.assertRaises(f.EpisodeFactsError):await self.prepare()
        self.assertEqual(before,self.aps.read_bytes())
    async def test_cli_entry_never_uses_notebook(self):
        from book_audio.episode_facts import prepare_episode_facts
        nb=SimpleNamespace(ask_chat_patient=AsyncMock(side_effect=AssertionError('No Notebook chat')))
        await prepare_episode_facts(nb,self.book,1);nb.ask_chat_patient.assert_not_called()
    def test_fingerprint_settings_invalidate_but_style_not_in_identity(self):
        original=f.identity_for(self.source,f.CLI,f.CLI_VERSION)
        self.assertNotIn('base_sha256',original)
        for name,value in [('MODEL','changed'),('EFFORT','low'),('VERSION','v2'),('RENDER_SCALE',2000),('EXTRACT_PROMPT','changed'),('RECHECK_PROMPT','changed'),('VOICE_CHARS',2300)]:
            with patch.object(f,name,value):self.assertNotEqual(original,f.identity_for(self.source,f.CLI,f.CLI_VERSION))
    def test_json_evidence_and_removed_cases_validation(self):
        d=card('reviewed');d['cases'][0]['evidence']=[]
        with self.assertRaises(f.EpisodeFactsError):f.parse_card(json.dumps(d),'reviewed')
        d=card('reviewed',True);d['removed_cases']=[dict(id='c1',reason='A hypothetical not an actual case')]
        f.check_coverage(card(),f.parse_card(json.dumps(d),'reviewed'))

class ProcessTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_subprocess_stage_cache_and_integrity(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);cli=root/'fake-cli'
            cli.write_text("#!/usr/bin/env python3\nimport sys,json\nfrom pathlib import Path\nq=sys.stdin.read()\nPath(sys.argv[sys.argv.index('--output-last-message')+1]).write_text(q)\nprint(json.dumps({'type':'turn.completed','usage':{'input_tokens':10,'output_tokens':5}}))\n")
            cli.chmod(0o700)
            a,r=await f.call_stage(cli,root/'stage','question',[])
            self.assertEqual(a,'question');self.assertEqual(r['status'],'answered')
            cli.unlink();cached,_=await f.call_stage(cli,root/'stage','question',[])
            self.assertEqual(cached,a)
            with self.assertRaises(f.EpisodeFactsError):await f.call_stage(cli,root/'stage','changed',[])
    async def test_failed_attempt_requires_reconciliation_no_auto_resubmit(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);cli=root/'fake-cli';count=root/'count'
            cli.write_text('#!/usr/bin/env python3\nfrom pathlib import Path\nimport sys\nPath('+repr(str(count))+').write_text("once")\nsys.exit(1)\n');cli.chmod(0o700)
            with self.assertRaises(f.EpisodeFactsError):await f.call_stage(cli,root/'stage','q',[])
            cli.unlink()
            with self.assertRaises(f.EpisodeFactsError):await f.call_stage(cli,root/'stage','q',[])
            self.assertEqual(count.read_text(),'once')
    async def test_tools_used_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            root=Path(t);cli=root/'fake-cli'
            cli.write_text("#!/usr/bin/env python3\nimport sys,json\nfrom pathlib import Path\nsys.stdin.read()\nPath(sys.argv[sys.argv.index('--output-last-message')+1]).write_text('answer')\nprint(json.dumps({'type':'item.completed','item':{'type':'command_execution'}}))\nprint(json.dumps({'type':'turn.completed','usage':{'input_tokens':10,'output_tokens':5}}))\n");cli.chmod(0o700)
            with self.assertRaises(f.EpisodeFactsError):await f.call_stage(cli,root/'stage','q',[])

if __name__=='__main__':unittest.main()
