# AI 說書人目前製書主線

更新：2026-10-10。正式實作在 news-vm `/home/vboxuser/nblm-audio/book_audio`；本文描述 Telegram `/book`、`/book_capture` 與 `/book_regen` 的 Notebook 說書流程。

| 步驟 | 目前行為 |
|---|---|
| 1. 接收任務 | Telegram 設定模式、聽眾與自訂要求，任務持久保存並進入製書佇列。傳記／史實模式同樣適用來源分流。 |
| 2. 取得來源 | HyRead 擷取全文文字，或下載原書 PDF。原圖 PDF 入口保留，不先用未核實 OCR 稿替代。 |
| 3. 規劃分集 | Notebook 規劃各集主題與範圍；文字線核對章節／段落覆蓋，PDF 線辨識、縫合並驗證章節頁碼。分集規劃尚未改由 Codex 執行。 |
| 4. 準備來源 | 建立每集內容、補充上下文與導覽三份來源，以及原本說書提示詞。 |
| 5. 分流提示 | 文字來源：news-vm Codex CLI 讀每集原文、獨立回查，產出關鍵情節提示。掃描影像 PDF：跳過 Codex 情節抽取／回查，加入開場警語要求。 |
| 6. 生成語音 | Notebook 使用三份来源與完整提示詞生成語音摘要；允許分析、推論，要求不偏離作者原意。 |
| 7. 配樂後製 | 優先製作主題音樂，失敗時使用既有曲庫；加入片頭／片尾，檢查音檔格式、時長與完整性。警語不以後製音訊插入。 |
| 8. 交付上架 | 上傳 Drive、核對檔案，依既有流程回報 Telegram，供書庫播放器收聽。 |
| 9. 回聽重生 | 使用者發現內容問題或警語漏唸時，執行 `/book_regen`。指定集重新套用對應分流，保留文字情節有效快取；準備成功後才刪舊 Notebook 音訊卡片。 |

## 來源分流的實際判斷

共同入口為 `book_audio/episode_facts.py::prepare_episode_facts`，新生成與指定集重生共用。

- `epNN_content.txt`：保留 Codex 情節抽取與回查。
- `epNN_content.pdf`：沿用 `scanpdf.is_text_pdf` 的文字層抽樣判斷。未檢出足量文字層則跳過 Codex；檢出文字層則保留 Codex。
- 文字層判斷只代表抽樣字數達門檻，不是全書文字或 OCR 正確性驗收。可靠全文應優先來自原生文字來源；不能宣稱任意文字層 PDF 已可靠。
- 每集內容來源缺少或不唯一則停止；不在錯誤時默默換成其他抽取方式。

Codex 文字線固定使用 news-vm 已登入的隔離 CLI、`gpt-6.1-sol/high`，首次兩輪讀原來源，回查結果與語音提示分開保存；來源及規格相同可重用快取。詳細規則見 [EPISODE_FACTS.md](EPISODE_FACTS.md)。

## 掃描影像線的警語

每次生成／重生先去除舊的情節附註或掃描警語，再加入一次開場提示。要求一位主持人在開場、正式內容前完整照唸一次，不省略、不改寫：

> 本集由 AI 依原書掃描影像製作，文字辨識與情節轉述可能有誤；涉及人物、事件與細節，請以原書為準。

使用者回聽發現漏唸時用 `/book_regen`；目前不新增自動警語音訊驗收，也不批次重製已交付書籍。掃描跳過收據明記 `verification=skipped_image_pdf`、`codex_calls=0`、`warning_delivery=audio_prompt`、`audio_quality_verified=false`。

## 品質與其他試驗的邊界

情節提示可減少改寫失真，不能保證 Notebook 音訊忠實；技術檢查不等於內容驗收。掃描警語揭露限制，不補救辨讀、分集或轉述錯誤。

agy 全書閱讀、Drive OCR、學校本地 OCR 尚未接入此正式入口。ElevenLabs 原文演繹及其獨立工作流程另見相關 runbook，不改變本文件的 Notebook 主線。
