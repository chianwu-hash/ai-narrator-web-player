import shutil
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock
from book_audio.cdp import Notebook

class AudioPromptDOMTests(unittest.IsolatedAsyncioTestCase):
    async def test_prompt_intact_required_before_generation(self):
        from playwright.async_api import async_playwright
        chrome=shutil.which('google-chrome') or shutil.which('chromium')
        if not chrome:self.skipTest('Chrome required')
        async with async_playwright() as pw:
            browser=await pw.chromium.launch(executable_path=chrome,args=['--no-sandbox'])
            try:
                page=await browser.new_page()
                for mode,expected in [('intact',True),('immediate_truncate',False),('delayed_truncate',False)]:
                    with self.subTest(mode=mode):
                        await page.set_content('<button aria-label="自訂語音摘要">Customize</button><div role="dialog"><textarea aria-label="Host focus"></textarea><button onclick="window.generated++">Generate</button></div>')
                        await page.evaluate('window.generated=0')
                        if mode!='intact':
                            await page.evaluate("""(mode)=>{document.querySelector('textarea').addEventListener('input',e=>{const cut=()=>{e.target.value=e.target.value.slice(0,70)};if(mode==='delayed_truncate')setTimeout(cut,50);else cut()})}""",mode)
                        nb=Notebook(SimpleNamespace(js=page.evaluate))
                        nb.ensure_audio_language_zh_tw=AsyncMock(return_value=True)
                        self.assertEqual(await nb.customize_and_generate('Original complete story '+('x'*100)),expected)
                        self.assertEqual(await page.evaluate('window.generated'),int(expected))
            finally:await browser.close()

if __name__=='__main__':unittest.main()
