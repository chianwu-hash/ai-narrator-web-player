import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from book_audio import episode_facts as f


class Tests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root/'sources').mkdir()
        self.source = self.root/'sources/ep01_content.pdf'
        self.source.write_bytes(b'fake pdf')
        self.path = self.root/'audio_prompts.json'
        self.path.write_text(json.dumps({'EP01':'Base\n'+f.START+'\nOld facts',
                                         'EP02':'Other'}), encoding='utf-8')
        self.book = SimpleNamespace(dir=self.root)

    def tearDown(self):
        self.tmp.cleanup()

    async def test_scan_skips_cli_and_regen_is_idempotent(self):
        with patch('book_audio.scanpdf.is_text_pdf', return_value=False), \
             patch('book_audio.codex_facts.prepare_codex_episode_facts', new_callable=AsyncMock) as cli:
            receipt = await f.prepare_episode_facts(None, self.book, 1)
            first = self.path.read_bytes()
            await f.prepare_episode_facts(None, self.book, 1)
            self.assertEqual(first, self.path.read_bytes())
            cli.assert_not_awaited()
        prompts = json.loads(first)
        self.assertEqual(prompts['EP02'], 'Other')
        self.assertNotIn(f.START, prompts['EP01'])
        self.assertEqual(prompts['EP01'].count(f.SCAN_WARNING), 1)
        self.assertEqual(receipt['verification'], 'skipped_image_pdf')
        self.assertFalse(receipt['audio_quality_verified'])

    async def test_text_pdf_skips_cli_and_strips_prior_facts(self):
        with patch('book_audio.scanpdf.is_text_pdf', return_value=True), \
             patch('book_audio.codex_facts.prepare_codex_episode_facts', new_callable=AsyncMock) as cli:
            receipt = await f.prepare_episode_facts(None, self.book, 1)
            cli.assert_not_awaited()
        self.assertEqual(receipt['verification'], 'skipped_by_policy')
        self.assertEqual(receipt['codex_calls'], 0)
        self.assertEqual(json.loads(self.path.read_text())['EP01'], 'Base')

    async def test_text_regen_removes_old_warning_without_cli(self):
        self.source.unlink()
        (self.root/'sources/ep01_content.txt').write_text('Original', encoding='utf-8')
        self.path.write_text(json.dumps({'EP01': 'Base\n'+f.SCAN_START+'\nWarning',
                                         'EP02': 'Other'}), encoding='utf-8')
        with patch('book_audio.codex_facts.prepare_codex_episode_facts', new_callable=AsyncMock) as cli:
            await f.prepare_episode_facts(None, self.book, 1)
            first = self.path.read_bytes()
            await f.prepare_episode_facts(None, self.book, 1)
            self.assertEqual(first, self.path.read_bytes())
            cli.assert_not_awaited()
        self.assertEqual(json.loads(first), {'EP01': 'Base', 'EP02': 'Other'})
        self.assertEqual(f.base_prompt('Base\n'+f.SCAN_START+'\nWarning'), 'Base')

    async def test_ambiguous_source_preserves_prompt(self):
        (self.root/'sources/ep01_content.txt').write_text('Original', encoding='utf-8')
        before = self.path.read_bytes()
        with self.assertRaises(f.EpisodeFactsError):
            await f.prepare_episode_facts(None, self.book, 1)
        self.assertEqual(before, self.path.read_bytes())
