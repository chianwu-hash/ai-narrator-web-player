# Supabase Disk IO 唯讀查核與跨機交接

記憶鍵：`MEMKEY:Supabase-DiskIO-同步服務查核`

日期：2026-10-06，Asia/Taipei；查核機器：家裡 Windows，`D:\projects\nblm-book-audio`。
校內來源 Thread：`codex-01a10e1e-bfeb-7c91-9ca8-408130688db3`；交接 Memory：`91193457-32ec-42a2-9ece-66f15ebc33c1`。

## 最新：已授權並套用本機最小修正（2026-10-06，未部署）

### Claude review 與提交授權（2026-10-06）

使用者追加授權「改完給 Claude review，沒問題就 commit push」。以 chat-mode supervisor／Claude Code 2.1.288／訂閱 OAuth 執行唯讀 review，session `20261006-sync-bug-review`；兩輪都 completed，Git baseline 不變，viewer 啟動已核對。第一輪查四份 diff、React effect／播放事件／merge／activity API；第二輪補讀 PROJECT_MEMORY 前段、types、sync-server、state route、progress-store 及真 timer 結果。Claude 最終結論：**沒有阻擋 commit 的缺陷**。Codex 核對推演與已完成測試後接受。

非阻擋事項保留：既有 pairing 與在途 PUT 交錯的競態；sync-controls／activity 的 React 隔離 harness 目前在 gitignored work，尚未納入 CI；server 無條件 upsert／last_seen_at 與 CAS、真瀏覽器／iOS／DB 驗收仍待處理。此次不擴充修正範圍。Claude 沒有親自執行測試，讀取的是 Codex 的測試證據。

審查原文與 run record 位於本機 `.chat-mode/sessions/20261006-sync-bug-review/` 的 `turn-0001.response.md`／`turn-0002.response.md` 及對應 `.run.json`；不納入 Git。只提交這次同步 bug 的程式、測試及對應文件；其他 dirty 內容保留。push 授權不包含 production promote 或正式 DB 變更。

使用者追加「既然找到 bug 就先修正這個錯誤」，已修改播放器本機原碼；下方「候選尚未套用」為歷史查核狀態。本輪未部署、停服務、變更正式 DB／環境或升級。

- `src/components/sync-controls.tsx:107`：成功後以該次送出的 `payload` 作 ack，避免 DB JSON key 重排或 server 合併額外進度觸發無變更重送。沒有以最新 local ref 作 ack，因此請求期間新增變更仍待補傳。
- 同檔 `:42/:85/:92/:108/:114`：以 in-flight ref 限制單筆 PUT；成功、disabled、error 釋放。保持原有 60 秒節流及失敗停止行為，不引入自動重試。
- `src/lib/progress-model.ts:16`：進度、時長、完成、書及最後集數都相同且沒有明確外部時間戳時，返回原 state；倒帶、完成、切集與明確時間戳仍保存。
- `src/components/audio-library-app.tsx:221`：hidden 且音訊實際暫停時跳過 activity；背景真播放仍送 heartbeat。可見頁面原有五分鐘活動節奏保留；未做跨分頁 leader 或 server heartbeat 降頻。
- `tests/progress.test.ts` 新增三項回歸測試，涵蓋 no-op、倒帶／完成／切回集數、明確時間戳。

原碼隔離驗證命令：`node work/supabase-night-audit-20261006/reproduce.cjs --real-react --fixed-source`。讀取修正後的真正 source，不套用候選字串轉換；fetch 全 mock，沒有正式請求。15 情境／14 組斷言通过，結果與 SHA256：`work/supabase-night-audit-20261006/results-fixed-source.json`。

| 情境 | 修正前 | 修正後實際原碼 |
| --- | ---: | ---: |
| 一次改設定後暫停，JSONB key 重排，1h | 60 PUT／59 重複 | 1 PUT |
| 最後一集 ended 後，1h | 60 PUT | 1 PUT |
| server 額外合併遠端進度，1h | 60 PUT | 1 PUT |
| 兩個獨立 component，1h | 120 PUT | 2 PUT |
| 同位置每分鐘 hidden 事件，1h | 60 timestamp-only PUT | 0 PUT |
| hidden idle heartbeat，1h（含 mount） | 13 POST | 1 POST |
| 慢回應 90s＋每 5s 進度，5min | 20 PUT／最高 19 在途 | 2 PUT／最高 1 在途 |
| 慢回應後暫停，排空待傳 | 最後進度需確認 | 3 PUT，最後 position=300 保留 |
| 真背景播放，30min | 30 PUT／30 實質變更 | 30 PUT／30 實質變更 |

型別檢查、全部 40 項 node tests 及 `npm run build` 通過；lint 0 error，既有 work/yt-dlp vendor 一個 unused-var warning。`--real-react --fixed-source --wall-clock` 真 timer 跑 125.309 秒、保持 paused，只在 60.086 秒送出一筆 PUT，沒有第二次重送（原版同長度兩筆）；結果 `results-wall-clock-fixed.json`。React renderer 已棄用，只作隔離診斷；未完成真瀏覽器／iOS、真 DB 或跨設備 CAS 驗收。

下一步由校內機接續：正式仍為舊部署；先核對本機 diff／此報告，後續部署需另依使用者指示。server 的無條件 full-state upsert、每次認證寫 last_seen_at 尚未改；multi-tab leader、原子 merge、撤銷／離線恢復驗收仍待做。找到並修正可重現背景 bug，不等於證明 IO 根因或正式減量生效；需部署後才比較同負載 gateway、實際 UPDATE／WAL、IO budget 時序。

## 歷史：夜間背景同步 bug 查核與重現（2026-10-06 約17時，家裡機）

**已證實程式 bug：一次成功上傳後，即使沒有新的播放、進度、時間戳或使用者事件，也能因回傳 state 與本機 JSON 字串不同而持續每分鐘重送。** 找到這個 bug 不等於證明其造成全部 Disk IO 耗盡；未把夜間活動解釋為真人整晚收聽。

本節取代下方歷史報告「閒置通常不會持續 PUT」的適用範圍：**初始化且尚未觸發問題的閒置狀態不會固定傳；已成功上傳的閒置狀態可以進入成功回應驅動的循環。** 舊報告只有靜態碼／helper查核，沒有完整effect重現，因此漏掉此機制。

### 最新校內時序（來源為 Nowledge 最新交接，非本機重新量測）

- 臺灣午夜00–05時gateway每小時197／187／197／201／192／202筆，沒有夜間暴增。
- IO額度從前晚持續下降；03:10尚餘48%，10:55首次歸零，10:59:48開始sync_devices GET504。
- 00–08時sync_states GET415／POST405、sync_devices GET397／PATCH412、activity POST78；識別聚合只有一個profile、兩個device驗證值，不能當成兩位真人、兩個常駐分頁或兩者一直同時活躍。
- 故障前swap峰值458,379,264 bytes；重啟後系統盤讀／swap樣本、archive_timeout=120等為其他線索，不能由這些數值直接把因果歸給播放器。
- 這些更新已補上原交接的歷史資料缺口；下面仍保留早晨查核紀錄，但「03:10尖峰未取得」不是目前最新全貌。

### 可重現根因與檔案行號

**A. 成功回應觸發無限重送（最主要可證實bug）**

1. `src/components/sync-controls.tsx:84–85` 用 `JSON.stringify(localState)` 與 `lastUploadedJson` 作raw字串判斷。
2. `:101` 成功後把 `JSON.stringify(data.state)` 存成lastUploadedJson，而非剛才真正送出的payload快照。
3. `:104` 切回linked；`:111` effect依賴status，所以成功回應會再執行effect。
4. server `src/lib/sync-server.ts:149–153` 合併後upsert；`:87–98` 直接回傳DB row的state，沒有正規化回應。欄位 `supabase/migrations/202607170001_sync.sql:20` 為jsonb。
5. PostgreSQL jsonb不保留object key順序；因此内容相同的回傳state也能與UI順序不同。官方文件：https://www.postgresql.org/docs/17/datatype-json.html 。mock採遞迴短key優先順序；這是契約允許的回傳形狀，未讀正式state body來確認該次排序。
6. raw字串不等 → 下一個60秒timer → PUT成功 → linked → effect又認為dirty。**重送的lastPlayedAt、position及整份payload可以完全不變**，不需要timeupdate、playing=true或背景事件。
7. 即使改用canonical equality，server合併了其他裝置episode而本機沒那筆，也會持續不等。PUT回應没有applySyncedState，是第二個可重現入口。最小止血應ack已送出snapshot，不能只canonicalize伺服器回應。

**B. 慢請求引發重疊PUT**

- `sync-controls.tsx:83` syncing狀態仍允許排新timer；`:89` 送出前清掉timer ref，沒有in-flight ref；`:102` 只有成功才刷新節流起算時間。
- 回應未到時，新的5秒progress更新可在舊節流期限已過後用1.2秒debounce再送。90秒延遲mock，5分鐘20次PUT、最多19個未完成請求，破壞「最多每分鐘一次」的實際保證。
- 失敗mock只傳1次後error，未找到自動重試迴圈。B是**慢成功請求＋新事件**造成重疊，不應誤稱網路錯誤重試風暴。與故障504時段的放大作用尚未逐筆驗證。

**C. 同position仍更新lastPlayedAt**

- `progress-model.ts:16–22` 同position／duration／completed亦刷新lastPlayedAt；`audio-library-app.tsx:335–344` commitProgress未判斷實質變更。
- pause`:1056`、hidden/pagehide`:346–352`都可commit；重複hidden事件mock會持續產生timestamp-only寫入，但**沒有事件時lastPlayedAt不是自己每分鐘更新**。A的循環不依賴它。

**D. hidden idle活動heartbeat不停止**

- `audio-library-app.tsx:220–224,231` 五分鐘interval只看stopped與4分鐘門檻，不查document.hidden／audio.paused。已登入留在背景、不播放，亦持續activity寫入。
- `:232–235` unmount有clearInterval；`:109` 同步effect也有clearTimeout。隔離卸載後10分鐘沒有新請求，未重現卸載timer漏清理。
- pauseAudio`:430–438`取消pendingAutoplay、播放世代並setPlaying(false)；onPause`:1056`及最後集ended`:573–581`亦清理。mock確認最後一集playing=false／pendingAutoplay=false，但A仍60次PUT，**不用假設playing卡住**。
- 有下一集時`:583–587`會自動啟動下一集，`nextEpisodeOf:509–512`只有下一index，沒有整本循環重播；可在沒有新點擊下續播到書末。這是程式背景續播能力，不是夜間真人／實際音訊成功播放的證明。

### 隔離mock方法、重現步驟與量測

產物：`work/supabase-night-audit-20261006/`。`reproduce.cjs`直接transpile目前source、用真正React19.2.4 test renderer跑SyncControls的state/effect；另由TypeScript AST抽取原始audio事件／activity effect，並執行真正sync-server的currentDevice/getState/mergeDeviceState。

所有fetch硬限制在同程序mock `/api/*`／`https://mock.invalid/rest/v1/*`；未mock的URL直接throw。無正式cookie、DB、network、測試裝置或資料。Node vm中的Date/timer為假時鐘；media事件人工送入、JSONB排序模擬，並非完整瀏覽器／PostgreSQL／iOS凍結測試。React test renderer有官方deprecation警告，本輪僅作隔離診斷工具，未加進app dependency。

重現A：①以linked的相同初始state載入，②只改一次倍速或pause/ended commit，③mock PUT回覆JSONB重排但語義相同state，④不再送任何local/media事件，⑤推進一小時並量測。GET依原碼會讀裝置／PATCH心跳／讀state；PUT依原碼四步。server mock另外統計state POST、包含timestamp的語義變更、去timestamp的實質變更、相同PUT payload及事件原因。

| 情境 | 原碼PUT | 候選PUT | 證據 |
|---|---:|---:|---|
| 初始閒置、尚未觸發上傳，一小時 | 0 | 0 | 不是載入後必定立刻進循環 |
| 改一次倍速、回應保留相同key順序，一小時 | 1 | 1 | 對照組 |
| 改一次倍速、JSONB重排，一小時 | 60 | 1 | 59次相同payload；只有1次state實質變更 |
| pause後hidden，一小時 | 60 | 1 | playing=false也持續 |
| 最後一集ended後，一小時 | 60 | 1 | pending=false、沒有下一集，仍循環 |
| 回應多一筆其他裝置progress，一小時 | 60 | 1 | 即使保留key順序仍可重現 |
| 同position每分鐘人工送hidden，共60次 | 60 | 0 | 60次timestamp變更、0次實質進度變更；非自然timer自己產生 |
| 2個閒置component先各改一次，一小時 | 120 | 2 | 無跨tab協調；mock2個component不是正式2個裝置證明 |
| 90秒回應延遲＋5秒進度commit，5分鐘 | 20 | 2 | 原碼max in-flight19，候選1 |
| 慢請求後pause、再等5分鐘 | 22 | 3 | 候選最終300秒position保留，沒有丟掉in-flight期間更新 |
| hidden但實際送timeupdate播放，30分鐘 | 30 | 30 | 真實進度更新，候選保留背景播放同步 |
| fetch failure，一小時 | 1 | 1 | 無自動重試風暴 |

單一hidden idle且無activeEpisode的activity：原碼13次（一開始＋300秒到3600秒含邊界），候選1次（切hidden前的初始化），沒有PUT；正常每小時持續heartbeat約12次。兩個component原碼26次。unmount取消尚未發送的PUT及heartbeat，後續10分鐘0新請求。

- 真正React15個情境、14組斷言／檢查通過；另9項既有progress/sync state/upload測試通過。custom hooks另作對照，主要證據用actual React。
- **實時計時複驗**：未修改同步source的60秒常數，actual React、真Node timer跑125.352秒；只改一次設定且paused，60.134與120.136秒送出兩次PUT，第二次語義及實質state無變化。結果 `results-wall-clock.json`。仍是mock媒體／DB，不是正式站請求。
- 詳細baseline／候選：`results-react.json`、`results-candidate.json`，含六檔source SHA256、請求／寫入／重複payload數、playing／pending與trigger欄位；`baseline-stdout.txt`／`candidate-stdout.txt`留執行輸出。

### 最小修正方案（只有副本，尚未套用）

可審查patch：`work/supabase-night-audit-20261006/minimal-proposal.patch`；完整副本在同目錄`candidate/src/`。app `src/`本輪沒有改動。

1. **最小阻斷A**：`sync-controls.tsx:101` 改成 `lastUploadedJson.current = payload;`，ack的是該次送出快照，不能用當下latest ref（會吞掉in-flight期間的新變更）。伺服器已合併儲存，回傳語義與本機不等不代表本機還有新變更。這一行避免key順序／server extra progress造成自發重送，未嘗試解決完整遠端即時接收。
2. **阻斷B**：增加uploadInFlight ref；請求在途時不排新PUT，成功／disabled／error均釋放；成功後依latest local state補傳。先保留既有60秒設定，不盲目延長timer。
3. **減少C**：progress欄位與lastEpisode均未變且沒有明確外部lastPlayedAt時return原state；保留真正倒帶、完成狀態、換集等事件的時間戳。候選尚需產品確認「同一集重新開始但position恰同」的last-play語意。
4. **減少D**：hidden且audio實際paused（不是只看React playing）則skip heartbeat；hidden真正播放仍回報。此候選只加hidden idle gate，沒有做15分鐘降頻或跨tableader。

此最小候選不需要改DB，可先解決本次可重現的自發流量。server no-op／device heartbeat降頻仍建議後續補防線；多分頁leader、CAS／favorites tombstone／可靠離線重試是後續完整性工作，**本patch未做到**。沒有新重試、閒置pull或正式功能變更。

候選不吞掉背景播放；mock慢請求pause後最後位置300秒收斂。尚未完成full app DOM、iOS實機、indexedDB離線恢復、真DB排序與多裝置CAS驗收，不能直接當可部署release。

### 排程、其他來源與舊部署查核

- Repo（tools/config/Cloudflare及source）沒有找到同步／活動API cron caller，也沒有vercel.json cron定義。Vercel唯讀API回傳`crons.definitions=[]`；啟用時間欄位不代表存在排程。
- Windows排程依action含nblm/narrator/sync/state/supabase篩選無命中；這不是完整排除其他名稱的任務或既有開啟分頁。
- news-vm唯讀user timer：nblm-monitor.timer每10分鐘跑`nblm_monitor.py`，另兩個為系統快取／firmware相關。crontab有每分鐘cron test、16:00新聞、23:00daily_report.py、03:00cleanup.sh。讀取03:00完整script，僅檔案／cache清理與Telegram通知，**未執行script**、未找到同步API呼叫；排程與03:10信件相近不等於因果。
- 遠端只讀掃描`/home/vboxuser/nblm-audio`與`news-broadcast-system`118份code檔，未命中sync_states/sync_devices/目標ref/兩個API endpoint；播放器URL的5處命中為交付連結與封面User-Agent等。這是有限scope，未全面稽核第三方worker或全部系統服務。
- Vercel最近清單包含現行及舊production／preview URL。所查最近1h被動日誌去重，sync／activity只出現在現行`dpl_s2g9...`（1筆sync route、16筆activity，受100筆limit／保留期影響）；不足排除夜間舊deployment，沒有對舊站登入／呼叫正式GET。
- 早晨五檔部署source比對沿用；未再次讀正式資料行、cookie或device識別值。production Supabase URL sensitive仍無直接ref證據，逐筆歸因仍保留限制。

### 與夜間流量／IO的關係與校內下一步

- A可解釋「沒有真人持續操作仍留每分鐘級流量」、同state成功寫入與約1:1四步查詢；一個迴圈約4個gateway請求/周期，另activity每5分鐘1筆。校內405次state POST/8h與每小時約200總請求量级相容，不能據此反推所有body相同或哪台裝置觸發。
- mock兩個迴圈同時跑會約雙倍流量，因此校內兩個device驗證值不能解讀為兩個迴圈一直同時跑。背景節流／網路完成延遲會影響間隔，尚未實測正式夜間每台。
- 本輪確認的是程式及自發流量機制，**不是Disk IO全部根因**；持續低流量、WAL歸檔／swap／平台事件可能共同影響，無host credit/latency對照不得定量歸因。
- 校內可用已有唯讀SQL檢查兩裝置最少必要last_seen_at、profile updated_at／state大小、同profile既有內容差異摘要（只留變更數，不保存身分值或收聽明細）；不得用會PATCH心跳的production GET當SELECT測試。
- 下一步先審查最小patch並補完整性測試；取得明確實作／部署授權後才套用。變更前後以相同情境測PUT／actual UPDATE、語義diff、gateway／IO budget時序，驗證不丟最後進度與不影響背景播放；其他同DB負載須分開量測。不要由「找到bug」就宣稱課堂停機根因解決。

---

以下為早晨查核，保留作來源證據；最新結論以本節為準。

本輪未修改應用程式、資料庫或遠端設定，未部署、停服務、升級、建立測試身分或執行會寫入資料的同步 API。只新增本報告、更新交接記憶。原有 dirty worktree 保留。

## 結論與證據強度

1. **確定**：正式播放器部署正在接收約 65 秒一次的同步 PUT，以及約 5 分鐘一次的活動 POST。其實際部署程式能產生校內所見的四步 Supabase 操作。
2. **高度相符但未完成逐筆歸因**：播放器就是校內觀察到的同步流量來源。尚未取得 Vercel production SUPABASE_URL 的可讀值或 Supabase 端逐筆時間／來源連結，不能宣称已排除其他同型服務。
3. **未確認**：播放器導致臺灣 03:10 Disk IO Budget 警告。未取得警告前後 IOPS、throughput、budget、WAL、swap、checkpoint／autovacuum 時序，亦未成功取得凌晨 Vercel 日誌。現有流量不是凌晨尖峰證據。

## 實際部署來源

- Repo：`chianwu-hash/ai-narrator-web-player`；Vercel project：`ai-narrator-web-player`，ID `prj_RzAgmXLu1xKhmjs7kuIFTAb8Twdg`。
- 正式 alias：`https://ai-narrator-web-player.vercel.app`。
- 唯讀 inspect / API 確認 alias 指向 `dpl_s2g9CpnFe6jy3ZGtMrVVU412Yzzq`，Ready／production，2026-10-04 16:23:50 建立。
- Deployment URL：`https://ai-narrator-web-player-aruen46ly-chianwu-4755s-projects.vercel.app`。
- meta 記錄 `gitCommitSha=f01906157682225e51f381cd97b31ec98cec1059`、branch `codex/vercel-hobby-traffic-fix`、`gitDirty=1`。專案 Git 連結的 productionBranch=main；此次部署的 meta 與 Git 自動部署分支不同，不能只凭 main HEAD 推定部署內容。
- 透過部署檔清單及 `/v8/deployments/<id>/files/<uid>` 讀回 source，以下五份實際部署內容與本機一致（統一 CRLF/LF 後比較）：
  - `src/components/sync-controls.tsx`，uid `3b612ccd699e790483b3c415027ca07c4ae2d525`
  - `src/lib/sync-server.ts`，uid `f237e6b89898c1fc47a78a9d46b674e18d8a1a76`
  - `src/lib/sync-upload.ts`，uid `da9e3efca255eaa8b2eaa623eabcd2f3347afb30`
  - `src/components/audio-library-app.tsx`，uid `3b27a0bb8f4a9e08404bb3fe5351bc50668718f8`
  - `src/lib/progress-model.ts`，uid `d439b4f2d927594debe2ff0c344399490a7adda0`
- Supabase 經伺服器 env 存取；`sync-server.ts:52–64` 使用 service credential、no-store。`api/sync/state/route.ts:5` 明定 nodejs runtime，足以解釋 Supabase 日誌 User-Agent=node；不是證明家裡有獨立常駐 Node 同步 daemon。
- production `SUPABASE_URL` 為 sensitive，現有唯讀 API 無法讀回值；未嘗試修改變數或重新部署以揭露它。

## 其他服務與命名核對

- 搜尋 D:/projects 的表名／專案 ref，排除 node_modules、.git、.next、工作產物／日誌；另只在記憶體搜尋 .env* 的目標 ref，不输出秘密。本輪未找到含目標 ref 的本機 .env。
- 表名命中 `nblm-book-audio`、`nblm-book-audio-night-ink`、`nblm-audio-deploy-20261002`；三者 remote 都是 **ai-narrator-web-player**。後者名稱雖像製作端，實際也是播放器 checkout，不能據目錄名判斷。
- night-ink／deploy 副本同步邏輯與本機相同，原始檔 hash 差異包含換行；未證明兩者另有獨立正式部署。正式 alias 的 source 已直接核對。
- `D:/projects/nblm-audio` 沒有表名命中；本輪不把製作端／news-vm 的製書流程當成同步來源，也未做遠端製作端的全面排除。
- Vercel 帳號清單共10個project（含it-class-tcwu）；逐專案env名稱盤點僅播放器回傳SUPABASE_URL／SUPABASE_SERVICE_ROLE_KEY。這不是全域排除：校內已確認課程站使用此DB，設定亦可能在其他名稱、建置值或其他host；不能由env無命中否定校內證據。
- 未全面稽核所有雲端服務、Preview deployment、舊 alias、瀏覽器舊 bundle 或非本機 repo；不得把搜尋無命中當成全域排除。

## 請求量測（被動日誌，未操作播放器）

`vercel logs --no-follow --no-branch --environment production --since 1h --limit 100 --json`。回傳有重複列，先按 log id 去重，不能按原始列數當成雙倍流量。

- 2026-10-06 06:31:47–06:56:10：23 次 `/api/sync/state` PUT，均 HTTP 200；22 個間隔 min 63.841 s、max 77.004 s、平均 66.483 s。
- 同批一次 `/api/sync/state` GET 200。
- 06:31:02–06:55:42：6 次 `/api/activity` POST 200；間隔 min 278.602 s、max 301.449 s、平均 296.0072 s。
- 另有一次 `/api/stats/play` POST 400；須與校內 Supabase `record_content_play` 404 分開。`play-stats-server.ts:76–98` 確有同名 RPC；不能據此認定兩次错误相同或造成 IO 警告。
- 這是有限且可能受 retention／limit 影響的樣本，不能當作一整小時所有流量、裝置數或實際播放狀態；日誌沒有 state body，不能由 PUT 200 推定有實質變更。
- 歷史 02:30–04:00（UTC 2026-10-05 18:30–20:00）查詢：Vercel connector 403、CLI 400；根因未確認，不把錯誤當成凌晨沒有流量。

## 四項問題逐一核對

### 1. 狀態不變是否仍寫完整 state？

- 前端 `sync-controls.tsx:82–111` 比較 `JSON.stringify(localState)` 與 lastUploadedJson；完全相同就 return，因此沒有固定 65 秒無條件上傳迴圈。
- 但每次有效 PUT：`api/sync/state/route.ts:17–24` → `sync-server.ts:117–128` 驗證裝置、無條件 PATCH last_seen_at → `149–153` GET state、merge、無條件 upsert。
- `sync-server.ts:87–95` POST **整份 state JSON**，並刷新 updated_at；即使 merge 結果與原 state 語義相同，也沒有 server no-op guard。重送／舊狀態／重複 PUT 仍會寫。
- GET state 也呼叫 currentDevice，因此**應用層 GET 會寫 last_seen_at**。本輪沒有主動呼叫它。
- `progress-model.ts:11–24` 每次 upsertProgress 都更新 lastPlayedAt，即使 position 不變。暫停、切背景、開播放列表可因此讓 raw JSON 不同。
- JSON key order 差異亦可能造成前端 raw stringify 不等；驗收和 server guard 必須比較正規化語義，不能只依序列化字串。

### 2. 閒置／暫停／背景／多分頁／重試

| 情境 | 程式證據與結論 |
|---|---|
| 完全閒置 | 沒有固定同步輪詢。若 state 相同則無 PUT；活動 heartbeat 仍在。初始化 merge／既有 local 差異可能產生一次補傳。 |
| 播放 | `audio-library-app.tsx:1057` 每逢新 5 秒整數點 commitProgress；`sync-upload.ts:1–5` 1.2 秒 debounce、成功上傳後至少 60 秒再傳。觀察到約 66 秒相符，並非精確固定 timer。 |
| 暫停 | `1056` commitProgress，可能排一次尚未完成的上傳；沒有暫停期間固定同步。但切背景等其他事件仍可能使時間戳變動。 |
| 隱藏但仍播放 | 同步 effect 沒有 visibility／playing 條件；timeupdate 若繼續觸發就繼續寫，瀏覽器凍結／節流可能延遲。不能把背景音訊一律停同步。 |
| 隱藏且不播放 | `346–352` visibilitychange(hidden)/pagehide commitProgress；position 相同也可能刷新時間戳。多次隱藏可反覆產生差異，非固定每分鐘。普通 fetch／延遲 timer 在 pagehide 後不保證送達。 |
| 多分頁 | lastUploadedJson／lastUploadAt／timer 都是 component ref，沒有跨 tab leader／lock。每頁初始化 GET 都寫 heartbeat；有變更的分頁各自可傳。state GET→merge→upsert 非原子，存在 read-modify-write 競態。未量測真人多分頁負載。 |
| 重試 | fetch 失敗 `sync-controls.tsx:106` 設 error；effect 只接受 linked/syncing，**沒有自動重試迴圈／backoff**。已有 in-flight request 無 AbortController／單一飛行鎖，慢請求與 state/status 更新可能排下一次；不是已確認重試風暴。 |
| 接收遠端 | GET 在 ready 初始化（60–80），PUT 成功只更新 refs／時間，沒有 applySyncedState。沒有定期 pull，所以「idle 不寫」不可用取消所有遠端讀取的方式處理；目前也不能保證開著的 B 會及時看到 A 的變更。 |

favorites 採 incoming 替換、初始／配對採 union（player-state-merge.ts）；以 lastPlayedAt 選最新 progress。沒有欄位版本／刪除 tombstone／CAS。 stale favorites、union 復活刪除與併發遺失進度都要列入驗收；本輪沒有證明已在生產發生。

### 3. 裝置時間可否降頻？

- 可以。last_seen_at 不用每次 state read／write 都刷新；裝置驗證（revoked_at）仍需保留，heartbeat 與認證分開。
- `audio-library-app.tsx:216–237` 五分鐘 interval 無 hidden 檢查；可見事件觸發回報，但 lastPingAt 的門檻實為 **4 分鐘**，不是 docs 所稱每 5 分鐘最多一次；每個 tab 各有 lastPingAt，重載也重置。
- `device-activity-server.ts:91–108` 每次 POST 無條件 upsert last_seen_at；沒有 server 去重。
- 建議同步裝置時間每 15 分鐘最多寫一次，活動統計也每 15 分鐘一次；僅可見／實際背景播放時回報，hidden 且 idle 停 heartbeat。回到可見僅過期才補報。使用跨分頁去重＋server 條件更新，不靠 serverless instance 的記憶體限速。
- 在維持 24h／7d 統計下約 15 分鐘的時間精度通常夠，但須使用者接受；不要把精確「在線」語意套到這種低頻欄位。

### 4. 凌晨警告關聯

- 校內交接已看到累計 upsert 約 320,986 次、裝置更新約 321,334 次、state read 約 321,333 次；stats_reset 未知。Query duration 占比不是 Disk IO 占比。
- 現有程式每正常同步產生兩次讀＋兩次寫，與累計近 1:1 比例和 Node UA 相符；多次完整 JSON 更新可能增加 WAL／死列／後續 vacuum 成本，但量化貢獻未取得。
- 以 65 秒假設連續單一分頁，約 55 次同步/h、110 次寫/h，另約 12 次活動寫/h。這只是模型，不能外推全天在線裝置數或認定足以耗盡 IO。
- 03:10 通知時間不是必然的負載尖峰／精確耗盡時間。須對齊 budget 曲線與其他服務、記憶體 swap、DB 維護活動。
- 官方說明：https://supabase.com/docs/guides/troubleshooting/exhaust-disk-io 。小型 compute 可使用 burst，耗盡後回 baseline；IOPS 與 throughput 都需查，99.99% cache hit 不排除 WAL 或 swap。

## 減量方案（提案，未實作）

1. **Server no-op 與認證／heartbeat 分離**：merge 後比較 canonical state；相同時回原狀態及原 updated_at，不 upsert。heartbeat 使用 DB 條件式 UPDATE（只在 last_seen_at 早於門檻更新），讀取裝置資格仍保留。此項需要之後授權實作／DB 變更，本輪只列設計。
2. **前端語義 dirty**：position／completed／lastEpisode／favorites／rate／theme 實質變動才 dirty；position 相同不刷新 progress 的因果時間。canonical comparison 處理物件 key／集合順序，lastPlayedAt 用於真正進度事件，不能任意忽略有效時序。
3. **寫與讀分開**：idle、pause 的 state 寫入目標為 0；保留低頻／visibility resume 的遠端讀取。背景仍播放保留 checkpoint。讀 state 不更新 heartbeat後，poll／etag 才不會額外寫。
4. **播放 checkpoint 可先考慮 120 秒**：pause、seek 完成、切集、ended、favorites／rate 改變立即保存本機並排高優先同步；關頁尽力 flush，以本機 durable pending 作恢復依據，不把 sendBeacon 當成保證送達。若雲端最大落後需維持 ≤60 秒，就先保留60秒只優化 no-op／heartbeat。
5. **多分頁 single leader＋single-flight**：BroadcastChannel／Web Locks 協調，非 leader 保留本機變更並通知 leader；leader 崩潰接手；request id／idempotency＋有上限 exponential backoff/jitter。失败待同步不得因狀態切換遺失。
6. **併發完整性先行**：server 合併改原子交易／revision CAS；progress、偏好與最愛刪除需有可比較版本／tombstone。單純「前端不上傳」或「再拉長timer」不能解決 stale favorites 和 lost update。

試算：120秒 checkpoint=30 state writes/h，兩種15分鐘heartbeat各4/h，約38 writes/h，相較上方122/h模型下降約69%。有事件／讀取／多人時不同；節省寫入比例不是 Disk IO 的降幅承諾。

## 同步完整性與降量驗收（需獨立測試環境，未在 production 執行）

- 使用假 fetch／隔離 DB 記錄端點方法、次數、body byte size、ack revision；不把 token、身分 hash 或收聽內容寫進共用日誌。
- 完全相同 state 重送20次：0次 state UPDATE／updated_at 不動；認證仍有效，heartbeat只按窗更新。同position重複pause／visibility：沒有假 dirty。
- 30分鐘 idle／pause／hidden idle（含2／5分頁）：穩定後 state writes=0，每裝置每15分鐘 heartbeat至多1次；從背景回來不短時間連寫。
- 30分鐘前景及鎖屏背景播放：120秒方案周期checkpoint至多15次，事件flush另計；成功時雲端進度落後≤120秒＋請求延遲，pause／seek／ended event及completed精確不漏。若採60秒方案對應門檻60秒。
- A播放、B已開啟 idle：B依約定pull期限收到A；A/B同時修改不同episode不遺失；同episode前進／倒帶按事件版本正確處理，不以最大position取代使用者倒帶。
- favorites新增／刪除、倍速、主題、lastEpisode：過期B不得覆蓋新值；reload／配對 union 不復活已刪收藏。配對 union 的既有語意需明確決定遷移方式。
- slow response超過checkpoint／斷網／500／429／恢復：single-flight，backoff有上限，離線變更本機durable，回線收斂；舊 response不蓋新 pending。不因error要求重建profile。
- leader被關閉／browser凍結：新leader接手無多重heartbeat，pending保留；關頁前最後事件尽力送達、下次載入可補償。
- 撤銷裝置／listener session失效：任何未授權state寫入仍被拒絕；heartbeat降頻不降低認證效力。
- 以相同流量模型比較baseline／候選的API calls、state bytes、实际UPDATE、WAL／dead tuples差值及延遲；不要只測helper回傳的delay。

## 已執行驗證與下一步

- 五個部署 source 檔正規化比對全數相同；既有 `tests/sync-upload.test.ts` 1項通過。
- 離線 `assert.deepStrictEqual(mergePlayerStates(x,x),x)` 通過；同position換lastPlayedAt會改JSON。初次raw stringify對照看似不同，查明為key order，已修正比較方式，未把它誤報成內容不同。
- 尚未做實際瀏覽器情境／修改前後流量A/B；沒有確認state body不變仍重送的生產個案（只有程式能無條件處理的證據）。
- 校內下一步：在 Supabase 查02:00–04:00及通知前較長區間的Disk IO budget／IOPS／throughput、CPU iowait／memory／swap；讀取既有 stats_reset，查 pg_stat_statements 的 calls／wal_bytes（有權限／版本支持時）、pg_stat_user_tables的更新／dead tuples／vacuum時刻、checkpoint／WAL 指標。只SELECT，不reset統計、不EXPLAIN ANALYZE寫入、不手動vacuum。
- 用 Supabase request time／route pattern 對齊本報告已確認的播放器流量；必要時請使用者從正確專案設定僅確認production Supabase project ref，不揭露service key。無state body時不得聲稱已量測no-op比例。
- 補列其他同 DB 服務及各時段寫入；若歷史指標取不到，明確標為因果未定，先用隔離mock重現、提出修正diff供審查。真正實作／測試資料建立／部署另依使用者下一步授權。
