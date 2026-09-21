# iOS 背景自動續播手冊

最後核對：2026-09-22

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
