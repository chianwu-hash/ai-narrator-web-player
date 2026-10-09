import asyncio
import copy
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from book_audio.episode_facts import EpisodeFactsError, prepare_notebook_episode_facts as prepare_episode_facts, parse_response, source_selected, START

def card(kind='extracted', cases=True):
    return dict(kind=kind,cases=[dict(title='Case',participants=['A requests, B carries it out'],events=['B completes task'],essential_context=['Later clarification'],author_commentary=['Author gives example, not actual dialogue'],evidence=[dict(quote='Exact source text',location='Section 1')])] if cases else [],uncertainties=[],no_cases_reason='' if cases else 'No narrative cases in this section')

class FakeNotebook:
    def __init__(self):
        self.checked=['guide.txt','ep01_content.txt','ep01_context.txt']
        self.calls=[]
        self.answers=[json.dumps(card()), json.dumps(card('reviewed'))]
    async def checked_sources(self): return self.checked[:]
    async def select_sources(self, names): self.checked=names[:]
    async def ask_chat_patient(self, question, mark, timeout):
        self.calls.append((question,self.checked[:]))
        return self.answers.pop(0)

class FactsTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        (self.root/'sources').mkdir()
        (self.root/'sources/ep01_content.txt').write_text('Exact source text',encoding='utf-8')
        self.aps=self.root/'audio_prompts.json'
        self.aps.write_text(json.dumps({'EP01':'Custom base','EP02':'Unrelated custom prompt'}),encoding='utf-8')
        self.book=SimpleNamespace(dir=self.root)
        self.nb=FakeNotebook()
    def tearDown(self): self.temp.cleanup()
    async def test_source_only_two_passes_restore_and_cache(self):
        result=await prepare_episode_facts(self.nb,self.book,1)
        self.assertEqual(len(self.nb.calls),2)
        self.assertTrue(all(names==['ep01_content.txt'] for _,names in self.nb.calls))
        self.assertIn('extract',self.nb.calls[0][0])
        self.assertIn('reviewed',self.nb.calls[1][0])
        self.assertEqual(self.nb.checked,['guide.txt','ep01_content.txt','ep01_context.txt'])
        aps=json.loads(self.aps.read_text())
        self.assertEqual(aps['EP02'],'Unrelated custom prompt')
        self.assertTrue(aps['EP01'].startswith('Custom base'))
        await prepare_episode_facts(self.nb,self.book,1)
        self.assertEqual(len(self.nb.calls),2)
        self.assertEqual(json.loads(self.aps.read_text())['EP01'].count(START),1)
        self.assertFalse(result['audio_quality_verified'])
    async def test_source_change_invalidates_cache(self):
        await prepare_episode_facts(self.nb,self.book,1)
        (self.root/'sources/ep01_content.txt').write_text('Changed source',encoding='utf-8')
        self.nb.answers=[json.dumps(card()),json.dumps(card('reviewed'))]
        await prepare_episode_facts(self.nb,self.book,1)
        self.assertEqual(len(self.nb.calls),4)
    async def test_base_edit_invalidates_cache(self):
        await prepare_episode_facts(self.nb,self.book,1)
        aps=json.loads(self.aps.read_text())
        aps['EP01']=aps['EP01'].replace('Custom base','New base')
        self.aps.write_text(json.dumps(aps),encoding='utf-8')
        self.nb.answers=[json.dumps(card()),json.dumps(card('reviewed'))]
        await prepare_episode_facts(self.nb,self.book,1)
        self.assertEqual(len(self.nb.calls),4)
    async def test_failed_verification_preserves_prompt_and_reuses_extraction(self):
        original=self.aps.read_bytes()
        self.nb.answers=[json.dumps(card()),'Not a response']
        with self.assertRaises(EpisodeFactsError): await prepare_episode_facts(self.nb,self.book,1)
        self.assertEqual(self.aps.read_bytes(),original)
        self.assertEqual(len(self.nb.checked),3)
        self.nb.answers=[json.dumps(card('reviewed'))]
        await prepare_episode_facts(self.nb,self.book,1)
        self.assertEqual(len(self.nb.calls),3)
    async def test_no_story_does_not_fabricate(self):
        self.nb.answers=[json.dumps(card(cases=False)),json.dumps(card('reviewed',False))]
        result=await prepare_episode_facts(self.nb,self.book,1)
        self.assertEqual(result['card']['cases'],[])
    async def test_ambiguous_source_fails_without_chat(self):
        (self.root/'sources/ep01_content.pdf').write_bytes(b'PDF')
        with self.assertRaises(EpisodeFactsError): await prepare_episode_facts(self.nb,self.book,1)
        self.assertFalse(self.nb.calls)
    def test_echo_cannot_replace_reviewed_answer(self):
        raw=json.dumps(card())+'\nThoughts\n'+json.dumps(card('reviewed'))
        self.assertEqual(parse_response(raw,'reviewed')['kind'],'reviewed')
        with self.assertRaises(EpisodeFactsError): parse_response(json.dumps(card()),'reviewed')
    def test_missing_evidence_and_overflow_fail(self):
        bad=card('reviewed');bad['cases'][0]['evidence']=[]
        with self.assertRaises(EpisodeFactsError): parse_response(json.dumps(bad),'reviewed')
        bad=card('reviewed');bad['cases'][0]['events']=['X'*4000]
        with self.assertRaises(EpisodeFactsError): parse_response(json.dumps(bad),'reviewed')
    def test_icon_labels_and_wrong_filename(self):
        self.assertTrue(source_selected(['article ep01_content.txt more_vert'],'ep01_content.txt'))
        self.assertTrue(source_selected(['drive_pdfep01_content.pdfmore_vert'],'ep01_content.pdf'))
        self.assertFalse(source_selected(['ep01_content.txt_backup'],'ep01_content.txt'))

class HookTests(unittest.IsolatedAsyncioTestCase):
    async def test_trigger_prepares_before_ledger_or_audio(self):
        from book_audio import pipeline as p
        nb=SimpleNamespace(customize_and_generate=AsyncMock())
        with patch.object(p,'prepare_episode_facts',AsyncMock(side_effect=EpisodeFactsError('bad source'))),patch.object(p,'Ledger') as ledger:
            with self.assertRaises(EpisodeFactsError): await p._trigger_episode(nb,SimpleNamespace(),1)
            ledger.assert_not_called()
            nb.customize_and_generate.assert_not_called()
    async def test_regen_failure_never_deletes_existing_tile(self):
        from book_audio import pipeline as p
        state=dict(authuser=3,notebook_id='test',produced=[1])
        book=SimpleNamespace(load=lambda:state,save=lambda value:None)
        nb=SimpleNamespace(open=AsyncMock(),delete_tile=AsyncMock())
        cdp=SimpleNamespace(close=AsyncMock())
        with patch.object(p,'Ledger'),patch.object(p,'usage_job',return_value='job'),patch.object(p.CDP,'connect',AsyncMock(return_value=cdp)),patch.object(p,'Notebook',return_value=nb),patch.object(p,'prepare_episode_facts',AsyncMock(side_effect=EpisodeFactsError('bad source'))):
            self.assertFalse(await p.stage_regen(book,'18801',[1]))
            nb.delete_tile.assert_not_called()
            self.assertTrue(nb._sources_indexed)
            cdp.close.assert_awaited_once()

if __name__=='__main__': unittest.main()
