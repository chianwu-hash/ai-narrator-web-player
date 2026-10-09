# 每集來源情節抽取與回查

適用：Gemini Notebook 書籍／教材說書產線。正式入口位於 news-vm `/home/vboxuser/nblm-audio/book_audio/episode_facts.py`，由 `pipeline.py` 的語音提交與指定集重生流程呼叫。2026-10-09 新版入口改接同VM的 `codex_facts.py`；Notebook仍負責語音摘要，原書情節不再由Notebook聊天抽取。

## 流程

1. 送出語音前取得本機唯一的 `epNN_content.pdf` 或 `.txt`，導覽、context及其他集不參與閱讀。PDF用pdftoppm完整轉成2400px掃描圖，TXT完整傳入，不以未核實OCR代替原頁。
2. 第一輪由news-vm Codex CLI固定通用提問，抽取故事／案例／小說情節：角色分工、事件順序、間隔、否定、轉折、更正、澄清與短原句位置。使用全新ephemeral session，不給歷史答案。
3. 第二輪另開全新session重新讀同一份完整原圖／全文回查，草稿不是證據。除完整修正紀錄外，同次輸出每案voice_notes；保留必要關係，移除重複引文及一般概念清單。不能無聲漏掉草稿案例；刪除非案例須給理由。單純來源未交代與確實辨讀困難分開；後者未解決則停止。
4. 保留完整核對JSON，另將voice_notes附在既有語音提示詞後，保存 `audio_prompts.json`。原三份語音來源及說書模式、開場、自訂要求維持。允許主持人分析推論，但不把推論改成原書事件，不偏離作者原意。

每集首次多兩次VM CLI模型查詢，第二輪同時編排語音提示，不新增第三次查詢。模型固定gpt-6.1-sol/high；隔離CLI0.161.0位於 `~/.local/share/nblm-codex-cli/node_modules/.bin/codex`，沿用VM ChatGPT登入，不改全域CLI／其他用途預設模型。忽略使用者設定，不使用API key，不自動改用Notebook或其他模型。回查是模型第二次核對，不等於逐字引文已由程式證實，也不等於語音必然忠實。

## 快取、重生與失敗

- 資料在書目錄 `episode_facts/EPnn/<key>/`；CLI版key包含流程版本、原內容雜湊、模型、推理設定、CLI版本／路徑、圖片尺寸、兩輪提示詞與voice預算。語音基底prompt不放入閱讀key；只改語音風格就重新編排，不重讀原書。多帳號／跨日仍共用原書目錄及原EP號。
- 保存原來源快照、原圖雜湊清單、兩輪實際提問／答案／events／用量收據、草稿、完整reviewed.json、voice_notes.txt、audio_prompt.txt與獨立prompt_receipt.json。receipt標示 `cli_model_source_recheck`、`audio_quality_verified=false`；服務端cached input是input子集，不能重複計算。
- 完整紀錄及階段答案的SHA256檢查成功才重用。來源或閱讀規格改變使快取失效；不同語音基底可重用相同完整情節。舊Notebook快取版本不同，不會重用曾有錯誤的抽取稿。已交付舊書不批次回填／重製，下次生成或 `/book_regen` 才套用。
- 重生先完成所有指定集的情節準備，再刪除舊tile；準備失敗保留原音訊。既有核對結果可直接重用。
- 完整紀錄不再受2600字元的Notebook聊天卡片限制，安全上限120000字元；voice_notes連同標題上限2400，整份語音prompt本地保護上限12000（不是宣稱Google UI上限）。若無法保留必要情節，模型須明報voice_budget_ok=false；超出則停止，不直接截尾。畫面填入值及立即提交前須與完整prompt相符，不符就不點生成。
- 來源不唯一、JSON不合法、缺引用／案例、未解疑義、登入／模型／查詢失敗、快取損毀或來源處理中改變，停止語音並保存attention／`episode_facts_failed`，不默默降級。
- 成功階段答案可重用；已送出的CLI請求若失敗／逾時／取消，stage receipt標needs_reconciliation，先人工核對events、answer、stderr及用量，不能把刪receipt當作一般自動重試。未知是否已完成不能重複提交。跨程序flock防同集同key重複讀書。草稿不可代替回查稿。
- 除EP當前提示詞外不改其他集；不新增Notebook来源，不改原始PDF／TXT，不修改Drive或自行發訊。既有正常交付與通知仍按原產線執行。

## 維護

固定通用提示詞由 `codex_facts.py` 的 `EXTRACT_PROMPT`、`RECHECK_PROMPT` 提供；不填逐集正確答案。更動規格須更新VERSION或提示詞指紋以失效舊快取。本地可追蹤模組來源在 `tools/vm_episode_facts/`，只能在news-vm執行。`prepare_notebook_episode_facts` 僅保留歷史相容測試，正式入口不呼叫。

人工重製或診斷時先讀對應原始提問、回答及receipt，不要將模型回查標籤當作人工驗收。成功率需觀察正式新書，不以一次測試宣稱普遍穩定。

## 2026-10-09 news-vm Codex CLI 讀書基準（當時尚未接正式產線）

- 隔離CLI 0.161.0、同VM ChatGPT登入、gpt-6.1-sol/high，直接讀原書掃描圖兩輪。QBQ EP03（6圖）81,313 token／466.1秒；EP08（11圖）111,993 token／532.4秒。週用量顯示24%→25%，為共用帳號整數觀察，不能精確換算每本成本。
- 兩輪修正稿另由代理目視核對原頁核心情節；回查確實修正數字、字形及心中想法誤記為口頭回答。驗收以不偏離作者原意為準，允許另外標示分析／推論，不要求逐字朗讀。
- 同來源及同抽取規格重跑兩集的兩階段，四次結果快取命中、0新增模型呼叫。雜湊完整性與來源／模型／提示詞／版本等變更失效已驗證。語音風格與情節抽取指紋宜分開，避免僅換聲音風格也重讀原書。
- 九集粗估73–101萬token、70–80分鐘模型閱讀時間，不含音訊生成／重試，不能以兩樣本宣稱全書已驗證。精簡提示詞未做同集A/B，不宣稱大幅省token。
- 紀錄長度2796／3903字元超過當時卡片2600限制；因此完整核對紀錄與語音用關鍵情節提示須分開編排，不能截尾或遺失順序／轉折。基準測試當時正式產線仍為Notebook模組，後續CLI部署見下方。
- 本次完整證據：`work/qbq_codex_benchmark_20261008/ASSESSMENT.md`；VM原始資料：`/home/vboxuser/books/_reading_tests/QBQ_Codex_Benchmark_20261008`。未生成新音訊、替換Drive或部署。

## 2026-10-09 07:52 CLI 正式部署驗證

- 222項部署前測試通過；新版原書EP03真實兩輪82537token、303.8秒，四案例voice887字、完整prompt2433字。第二輪自行修正尺寸、刪未記載咳嗽及補回漏案，沒有在通用提示詞中給此集答案。代理對照六張原頁核對核心情節，非逐字／語音验收。
- 相同內容與只換語音風格重跑均0新增模型呼叫。實際安裝模組另快取重跑0呼叫；部署後222項全測試通過（37.557秒），見 `work/codex_facts_integration_20261009/post_deploy_receipt.json`。
- 備份 `/home/vboxuser/nblm-account-backups/codex_episode_facts_20261009_075238`，bot active、queue空，52本既有prompt保持；本次未生成音訊或改Drive。下次新書／指定重生才套用，不批次重製已交付內容。
- 完整實際通用提示詞在 `tools/vm_episode_facts/codex_facts.py`，每次送出文字與答案另保存於該書快取，不需人工逐集加情節。
