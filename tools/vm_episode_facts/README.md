# news-vm 情節閱讀模組

這裡保存正式 VM 模組的可追蹤來源；網站本機不執行 Codex 讀書。

- `episode_facts.py` → VM `book_audio/episode_facts.py`：共同入口；所有來源不呼叫CLI，掃描影像PDF加入主持人開場警語提示。舊Notebook函式僅保留歷史相容測試，無自動fallback。
- `codex_facts.py` → VM `book_audio/codex_facts.py`：保留歷史兩輪工具與紀錄相容性，正式產線已不呼叫。
- `test_*.py` → VM `tests/`：情節流程、既有入口保護及離線DOM文字完整性測試。
- `cdp_prompt_integrity.patch`：VM `book_audio/cdp.py` 的小幅修改，填入後及送出前必須符合完整提示詞，防止截短。

歷史Codex工具使用news-vm隔離CLI及ChatGPT登入；正式來源提示入口不需要CLI登入，不啟動模型、不退回Notebook情節抽取。

操作與限制以 `docs/EPISODE_FACTS.md` 為準。部署前依VM runbook核對目前檔案、空閒佇列，備份原檔，只替換這些指定模組並跑測試。這些模組不自動重做已交付書籍，也不直接修改Drive。
