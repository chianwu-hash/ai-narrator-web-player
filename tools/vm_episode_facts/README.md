# news-vm 情節閱讀模組

這裡保存正式 VM 模組的可追蹤來源；網站本機不執行 Codex 讀書。

- `episode_facts.py` → VM `book_audio/episode_facts.py`：共同入口；文字來源接CLI，掃描影像PDF跳過CLI並加入主持人開場警語提示。舊Notebook函式僅保留歷史相容測試，無自動fallback。
- `codex_facts.py` → VM `book_audio/codex_facts.py`：兩輪原圖／全文閱讀、完整紀錄、語音摘要編排、快取及失敗停止。
- `test_*.py` → VM `tests/`：情節流程、既有入口保護及離線DOM文字完整性測試。
- `cdp_prompt_integrity.patch`：VM `book_audio/cdp.py` 的小幅修改，填入後及送出前必須符合完整提示詞，防止截短。

執行條件：news-vm既有ChatGPT登入，獨立安裝Codex CLI0.161.0於 `~/.local/share/nblm-codex-cli`；固定gpt-6.1-sol/high。不改VM全域Codex版本或其他用途的模型。PDF需pdftoppm，TXT直接將完整UTF-8文字傳給兩輪。不能改用API key或Notebook抽取fallback。

操作與限制以 `docs/EPISODE_FACTS.md` 為準。部署前依VM runbook核對目前檔案、空閒佇列，備份原檔，只替換這些指定模組並跑測試。這些模組不自動重做已交付書籍，也不直接修改Drive。
