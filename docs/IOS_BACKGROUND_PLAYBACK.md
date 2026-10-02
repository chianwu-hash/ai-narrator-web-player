# iOS 背景自動續播手冊

最後核對：2026-10-02

## 問題特徵

- iPhone 或 iPad 鎖定畫面、切到背景後，單集結束時介面與 Media Session 會切到下一集，但聲音不會開始。
- 回到播放器並按播放後，同一個下一集可以正常播放。
- 如果手動播放可以成功，通常不是 Drive 權限、Cloudflare Worker 簽章或檔案格式錯誤，而是 iOS / WebKit 在兩段音訊之間暫停了背景 media session。

## 2026-09-22 根因與修正

播放器原本在 `ended` 事件中先把 `navigator.mediaSession.playbackState` 設為 `paused`，接著透過 React 更新下一集來源，等 `loadedmetadata` 或 `canplay` 後才呼叫 `play()`。這會在兩集之間形成明確的暫停空檔；iOS 背景執行時可能趁此空檔掛起網頁音訊工作階段。

目前修正：

1. 還有下一集時，換集期間維持 Media Session 的 `playing` 意圖；只有整本播放完畢才標記 `paused`。
2. 對書庫已附帶且尚未過期的 Cloudflare 簽名網址，在 `ended` 同一輪直接沿用原本的 `<audio>` 元素更換 `src`、`load()` 並呼叫 `play()`，避免等待 React 後續事件才開始播放。
3. 距離結尾 30 秒時，從下一集的 Worker 簽名網址預取前 64 KiB，用來提前建立瀏覽器到 Worker、Worker token 與 Drive 的連線。這段資料不經 Vercel，且刻意限制為小範圍，不恢復舊版 1 MiB 預抓。
4. 換來源所引發的暫停事件不再清除仍在進行中的播放請求。
5. `play()` 失敗時，瀏覽器 console 只記錄錯誤名稱、可見狀態及 media ready/network state，不記錄書名、集數、檔案 ID 或使用者資料；`NotAllowedError` 會顯示明確的手動續播提示。

## 2026-10-02 再次核對與競態修正

正式網域當時仍指向 `c529c637`（8 月 8 日版本）；9 月 22 日的 `45bfe5a` 只在功能分支，未上正式站。Vercel CLI 登入已重新完成；以 CLI 登入成功不能當作部署成功，必須另外核對正式網域的部署與 Git SHA。

同時發現 9 月修正存在新的換集競態：直接更換 `src`、`load()`、`play()` 後，依賴集數的 React effect 又呼叫 `load()`，可能中斷正在等待的播放。`play` 事件過早清除續播意圖，及上一來源的 Promise 回呼，都可能使下一集停住。

本次調整：

1. `applyAudioSource` 是唯一更換來源與呼叫 `load()` 的入口；移除 React 的 `src` 屬性與集數切換後的第二次載入。
2. 新來源的 `play()` 仍在換集同一輪呼叫；到真正 `playing` 或播放 Promise 成功才清除續播意圖。
3. 使用播放世代編號，忽略已被換集或手動暫停淘汰的 Promise 結果。
4. 手動暫停明確取消續播；更新簽名網址完成時尊重當下意圖，避免等待網址期間按暫停後又被啟動。
5. 恢復位置綁定已套用的來源，不使用可能尚未更新的上一集 render 資料。

音訊仍由 Cloudflare Worker 直接傳輸，沒有恢復 Vercel 音訊代理。這些是程式競態修正，不代表能保證所有 iOS/WebKit 版本的鎖屏續播；仍需以下真機測試。

### 本次部署與驗證紀錄

- 程式提交：`5602c24078d6b065a9f4ce53ac0d6ce4c9c900a0`，已推送 `codex/vercel-hobby-traffic-fix`。
- 從獨立乾淨 worktree 執行 `vercel deploy --prod --skip-domain --yes`，完成檢查後以 `vercel promote` 切換正式站，沒有混入原工作目錄的其他未提交文件。
- Deployment：`dpl_As8h3526RqL3yxLGEh3yJZZb6dBv`；正式網域解析出的部署狀態為 `READY`，`meta.gitCommitSha` 與以上程式提交相符。
- 型別、37 項單元測試、應用程式 ESLint 與 Vercel 正式建置通過；其中 3 項新增測試驗證換集順序、一次載入與沿用同一音訊元素。這些不是 iOS 真機或完整 React 事件競態測試。
- 正式站 `/login` 回應 `200`，未登入 `/api/library` 回應 `401`。本機設定無法通過正式站驗證，CLI 也不提供 Sensitive 值，因此未完成登入後音訊 Range 與鎖屏續播驗證；不得把部署成功描述成真機播放已確認修復。
- Windows 的 `vercel.ps1` 會吞掉轉交子命令用的 `--`；使用 `vercel.cmd` 執行 `env run`、`curl` 等需要轉交參數的命令。不要因此改用不安全的字串拼接，也不要輸出密鑰。

## 驗證方式

正式環境必須用真實 iPhone 測試，桌面瀏覽器無法完整模擬 iOS 背景 media session：

1. 選擇一個至少有兩集的書籍，從倒數 45 秒以前開始播放。
2. 鎖定螢幕，等待第一集自然播完。
3. 確認鎖定畫面曲目切到下一集，且下一集不需解鎖或點擊即可出聲。
4. 分別測試 Safari 分頁與加入主畫面的版本；兩者在 WebKit 上可能有不同結果。
5. 再測一次前景換集、手動下一集、暫停／恢復、倍速與耳機按鍵。

若仍失敗，使用 Safari Web Inspector 讀取 `Audio playback did not start` 紀錄：

- `NotAllowedError`：iOS 拒絕程式啟動播放。
- Promise 成功、`paused=false`，但 `currentTime` 不前進：屬於 WebKit 背景播放掛起，網頁層無法完全保證修復。
- `networkState` 顯示來源錯誤或觸發 `onError`：再查 Worker `206`、Range、簽章期限與 Drive 回應。

## 架構邊界

- 不得為了續播把正式音訊改回 Vercel Function 代理。
- 不得把私人 Drive 音訊改為公開連結。
- 不以靜音音檔無限播放來規避 iOS 背景限制；這類 workaround 不穩定，也可能增加耗電。
- 若 WebKit 版本仍無法可靠換軌，下一級方案是伺服器端 HLS／連續播放清單，或原生 iOS App 的 AVFoundation 背景音訊能力，而不是不受控地重試 `play()`。
