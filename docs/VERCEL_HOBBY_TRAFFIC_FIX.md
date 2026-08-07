# Vercel Hobby 流量修正與交付手冊

最後核對：2026-08-07。此文件記錄唯讀診斷結果、已實作架構、免費額度邊界與尚未套用到正式環境的設定。

## 實際診斷結果

Vercel Team `chianwu-4755s-projects` 的 Last 30 Days（2026-07-08 12:00 至 2026-08-07）顯示：

- Fast Origin Transfer：7.55 GB / 10 GB；Incoming 2.29 GB、Outgoing 5.26 GB。
- 專案占比：`ai-narrator-web-player` 7.55 GB（99.9%）；`rental-dates` 910.92 kB。
- Function Invocations：321,100；`ai-narrator-web-player` 320,793（99.9%），且 Usage 顯示成功率 100%。
- 同期尚有 Fast Data Transfer 6.17 GB、Edge Requests 325K、Fluid Active CPU 2h45m、Fluid Provisioned Memory 177.1 GB-Hrs。

Hobby 的 Usage 頁保留 30 天總量，但 Runtime Logs 頁只允許最近 1 小時；12 小時／1 天選項會要求升級 Pro。Observability Functions 可見的最近 12 小時樣本共 256 invocations：

| route | invocations | 樣本占比 |
|---|---:|---:|
| `/api/sync/state` | 189 | 73.8% |
| `/api/audio/[fileId]` | 24 | 9.4% |
| `/api/stats/play` | 14 | 5.5% |
| `/api/activity` | 13 | 5.1% |
| 其他 | 16 | 6.3% |

Route 明細提供了第二組交叉證據：`/api/sync/state` 的 189 requests 全為 2XX，Incoming 3 MB、Outgoing 956 kB、平均回應 5.1 kB；`/api/audio/[fileId]` 的 24 requests 全為 2XX，Outgoing 51 MB、Incoming 36 kB、平均回應 2.1 MB，Error/Timeout 都是 0%。同步 route 的大量 request body 與程式 PUT 進度的行為一致。

這證實目前主要 invocation 來源是同步狀態，不是音訊。程式原本每 5 秒保存一次播放進度，而 SyncControls 對每次 `localState` 變更約 1.2 秒後 PUT `/api/sync/state`，形成播放期間約每 5 秒一次的遠端寫入。320,793 / 30 天約 7.43 次/分鐘，與這個寫入放大量級一致。

音訊也無法解釋 321K：以 5.26 GB Fast Origin Outgoing 除以 320,793，平均每次 invocation 只有約 16.4 kB，遠小於最近樣本的 2.1 MB 平均音訊回應。以 2.1 MB 推估，5.26 GB 約需 2,500 次 Range，仍不到 320,793 的 1%；若完整使用 4 MiB Range則約 1,254 次。

30 天的 HTTP method、User-Agent、逐路徑 status 與完整時間分布已超出 Hobby 事後保留窗口，無法誠實還原；不能把 12 小時占比硬套成 30 天精確占比。Route 頁雖可選 User Agent，但表格明確標示 Demo Data，不能當成此專案流量。可確認的 12 小時 Observability 樣本都是 2XX，Vercel 的 7 天 Runtime Errors 也沒有錯誤群組。正式切換後應在警報發生當天立即匯出最近 1 小時 Logs，或在 Cloudflare Analytics 查看 Worker 的 method/status/time/UA 維度。

## 已實作架構

```text
已登入瀏覽器
  └─ GET /api/library ──> Vercel：驗證 HttpOnly session、列私人 Drive 書庫、簽 HMAC URL
       └─ 回傳每集 6 小時有效的 https://<worker>/audio/<fileId>?exp=...&sig=...

HTML audio
  └─ Range GET 簽章 URL ──> Cloudflare Worker：驗 HMAC／期限／Origin
       ├─ 約每個 Worker isolate 每小時 POST 一次 Vercel token broker
       │    └─ Vercel 使用既有 service account 簽發短效 drive.readonly token
       └─ Range GET 私人 Google Drive ──> 206 串流回瀏覽器
```

安全設計：

- Google service-account email 與 private key 仍只存在既有 Vercel secret store；不需、也不應複製到 Cloudflare。Worker 只在記憶體快取約一小時有效的 `drive.readonly` access token，任何憑證都不進入書庫 JSON或瀏覽器。
- `/api/worker/drive-token` 只接受至少 32 字元的獨立 Bearer secret，回應 `private, no-store`；該 secret 與簽署播放 URL 的 `AUDIO_SIGNING_SECRET` 分離，任一組皆可獨立輪替。
- Vercel 只為已登入者簽 URL；單檔補發前還會確認 MIME 是 audio，且父資料夾是設定之 Drive 根目錄的直接子資料夾。
- HMAC 綁定版本、fileId、到期秒數；Worker 以 constant-time 比對，過期或任何竄改皆回 403。
- URL 預設 6 小時有效，Worker 硬上限 24 小時。播放器在 URL 過期／失效時只補發一次，不把 session cookie送到 Cloudflare。
- Worker 只允許 GET、HEAD、OPTIONS，拒絕 multi-range，單次 Range 上限 4 MiB；保留 `206`、`Content-Range`、`Accept-Ranges`，也支援 suffix range。
- `ALLOWED_ORIGINS` 限制瀏覽器來源；沒有 Origin 的原生媒體／命令列請求仍必須持有未過期簽章。
- Worker 回應 `private, no-store`，不把私人音訊放入共享 CDN cache。Drive 檔案的名稱、位置、內容與分享模式都不變。

當 Worker 尚未設定時，程式保留舊 Vercel 音訊 route 作為 Preview 回退。正式環境只有在 `AUDIO_WORKER_URL` 和至少 32 字元的 `AUDIO_SIGNING_SECRET` 都正確時才會把 Worker URL 放入書庫。

## 立即降量修改

- 完全移除「下一集前 30 秒預抓 1 MiB」。
- 恢復上次單集時不再立刻把 `<audio src>` 指向音訊；只有實際按播放才設定來源，因此 `preload=metadata` 不會在首頁載入時白抓第一個 4 MiB chunk。
- 遠端進度同步仍保留本機每 5 秒續播點，但 PUT 最多每 60 秒一次，理論上將播放期間 sync invocations 降約 91.7%。暫停、pagehide 與下一集仍會更新本機 IndexedDB；遠端同步會合併最新狀態。
- `/api/audio-url/[fileId]` 每個 IP + User-Agent 每分鐘最多補發 60 次；這是 instance-local 的第二層保護，不應取代 Vercel WAF。

## 免費額度與容量判斷

- Vercel Hobby 官方上限包含 10 GB Fast Origin Transfer、100 GB Fast Data Transfer、1M Function Invocations；Hobby 多數資源到上限後需等滾動 30 天恢復。參考 [Vercel Limits](https://vercel.com/docs/limits)、[Hobby plan](https://vercel.com/docs/plans/hobby) 與 [CDN usage](https://vercel.com/docs/manage-cdn-usage)。
- Cloudflare Workers Free 為 100,000 requests/day、10 ms CPU/request、50 subrequests/request，response body 無強制大小上限；等待 Drive 與串流不計 CPU，且 Workers 不收資料傳輸費。參考 [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)、[Workers limits](https://developers.cloudflare.com/workers/platform/limits/) 與 [Streams](https://developers.cloudflare.com/workers/runtime-apis/streams/)。
- 4 MiB Range 約 256 requests/GiB；只看 Worker request 額度，100K/day 約可支援 390.6 GiB/day。現有約 6 GB/30 天遠低於此界線。
- 2026-05-01 後的新 Drive API 配額為每 project 每日 1 TB egress、每分鐘 1,000,000 quota units；download 每次 200 units。參考 [Google Drive API usage limits](https://developers.google.com/workspace/drive/api/guides/limits)。既有較舊 Cloud project 可能保留舊配額，應以 Google Cloud Console 實際 quota 為準。
- 未採 R2 搬檔，因 R2 免費儲存只有 10 GB-month；書庫容量一旦超過 10 GB 就不再保證零元。參考 [R2 pricing](https://developers.cloudflare.com/r2/pricing/)。本方案保留 Drive，沒有額外物件儲存容量上限，也不需複製或改動音檔。

## 每播放 1 GB 的 Vercel 用量

以本期實測總量估算，舊架構每 1 GB Fast Data Transfer 會產生約 `7.55 / 6.17 = 1.22 GB` Fast Origin Transfer；若採背景提供的 5.91 GB 數值，則是約 `1.28 GB/GB`。差異來自 Dashboard 取樣時間更新與非音訊小流量。

新架構的音訊本文完全不經 Vercel，因此每播放 1 GB 音訊的 Vercel Fast Origin Transfer 目標是約 0 GB。Vercel 只回傳小型書庫 JSON、簽章字串，以及每個 Worker isolate 約每小時一次、不到 2 kB 的 token JSON；即使保守假設每 1 GB 音訊各發生一次 URL 與 token 回應，也低於約 0.000003 GB/GB。Cloudflare 與 Google Drive 承擔音訊位元流。

## 尚未發布的 Vercel WAF 建議

Hobby 每 project 有 1 條免費 rate-limit rule、1,000,000 allowed requests，counting key 可用 IP 或 JA4。參考 [Vercel WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)；被 WAF deny/challenge/rate-limit 的流量不計 CDN Requests 與 Fast Data Transfer，參考 [Vercel changelog](https://vercel.com/changelog/web-application-firewall-mitigated-traffic-is-free-on-vercel)。

建議規則（先觀察／Preview 驗證，未自動發布）：

- 條件：path 以 `/api/audio/` 或 `/api/audio-url/` 開頭，或 path 等於 `/api/sync/state`、`/api/worker/drive-token`。
- Key：IP。
- Fixed window：60 秒。
- Threshold：120 requests。
- 超過後：deny 10 分鐘。

正常新架構在播放時約每分鐘 1 次 sync，Range 已在 Cloudflare；快速切集也遠低於 120/min。影響主要是同一 NAT IP 下大量裝置同時快速切集時可能共用配額。沒有 30 天 User-Agent 證據，所以不建議現在封鎖特定 UA。

## 設定與驗收順序（不要直接 Production）

1. 在 Cloudflare 建立 Workers Free 專案，複製 `cloudflare/audio-worker/wrangler.toml.example` 為不提交的 `wrangler.toml`。
2. 產生兩組不同且至少 32 字元的隨機值：`AUDIO_SIGNING_SECRET` 與 `AUDIO_TOKEN_BROKER_SECRET`。前者在 Vercel 與 Worker 必須相同，後者也必須在兩端相同；皆不可提交。
3. 以 `wrangler secret put` 在 Worker 設定這兩組 secret，並將 `AUDIO_TOKEN_BROKER_URL` 指向 Vercel origin 的 `/api/worker/drive-token`。不需設定任何 Google email 或 private key。
4. 設定 `ALLOWED_ORIGINS`，先只放 Preview URL；確認後再加入正式 `https://ai-narrator-web-player.vercel.app`。
5. 先部署 Worker；這只建立新的非正式音訊端點，不修改 Drive。
6. 在 Vercel Preview 設定 `AUDIO_WORKER_URL`、`AUDIO_SIGNING_SECRET`、`AUDIO_URL_TTL_SECONDS=21600`、`AUDIO_TOKEN_BROKER_SECRET`。完整 Drive 驗收還需要 token broker 所在環境擁有既有 Google service-account 設定；Vercel 不允許讀回敏感 Production 值，因此在不複製私鑰、也不部署 Production 的限制下，Preview 只能先驗證簽章與拒絕路徑。
7. 由專案擁有者核准後，在一次受控正式切換中：先把 `AUDIO_TOKEN_BROKER_SECRET` 加入 Vercel Production，部署此分支，再設定 Worker 使用相同 broker secret 與正式 broker URL。這不更改帳單、方案、Drive 分享權限或檔案。
8. 在真實 Chrome、Android Chrome、iOS Safari 測播放、背景播放、拖曳、倍速、鎖定畫面／Media Session、跨 URL 到期重取；確認 Worker Analytics 有 206 且 Vercel `/api/audio/[fileId]` 不再出現 Range。此分支不執行 Production deployment。

設定值範例在 `config/audio-delivery.env.example`。請勿把任何真實 secret commit、貼到 PR、或設成 Cloudflare plaintext var。
