# ElevenMusic 書籍配樂整合

更新：2026-10-04

## 範圍與正式版本

- 使用者接受《原子習慣》開場曲 Small Sparks Growing 的品質，選定 ElevenMusic 替代書籍版 Suno；ACE-Step 自架因硬體成本暫緩。
- 主題版 `nblm-audio` 仍依固定音樂風格使用分類曲庫，不改為每個主題生成音樂。
- 書籍版 `nblm-audio-book` 使用 news-vm Chrome CDP 18801 中手動登入的 ElevenMusic。正式製書 repo `/home/vboxuser/nblm-audio` 已提交並推送 `41f52f9d63a3dce7c49542b47369ae4c9ffcc238` 至 `feature/book-audio`，bot 重啟後 active。
- 本地 repo 是播放器，僅新增可見的「部分書籍配樂：Made with ElevenMusic」署名；不負責音樂生成。

## 製作、用量與恢复

使用 v2.5、單首、60 秒、Instrumental，沿用企劃指定的音樂方向。送出前持久保存精確 prompt 與提交意圖，重跑尋回原請求，無法判定時不再按 Create。已完成舊書保持原配樂。跨程序鎖保護音樂頁面；額度不足、登入失效、人機驗證、介面改動或忙碌時採既有曲庫。

從官方 Download 選單下載，驗證 40–90 秒長度及完整 FFmpeg 解碼，再轉 MP3。原始檔、狀態與來源署名保留；新曲入庫帶 `.credit.json`，借用時仍傳遞署名。書籍保存並上傳 `music_credit.txt`，既有交付訊息及混音 MP3 metadata 加入署名。不自動登入、解驗證、付款、Publish 或多帳號輪換。

生成與下載額度分開，以當下可見 UI 判斷，不硬編免費方案每日量。首次樣本顯示生成 25→24、下載 5→4；最新唯讀檢查顯示生成 22、Download / 3 left / Lossless。這些是實測觀察，不能當作固定方案額度。

免費方案 reference-free New Songs 商用需要醒目署名 Made with ElevenMusic；串流音樂平台發行另有條件。條款及額度若改動需重查：[條款](https://elevenmusic.io/terms-of-use)、[官方 v2.5 公告](https://elevenlabs.io/blog/music-v2-5-model)。

## 驗證與事故修正

- 原授權樣本已完成真實生成與 WAV 下載，48 kHz、16 bit、stereo、60 秒，使用者接受聽感。
- 部署前 190 項隔離 Python 測試通過，包含恢復、不重送、快取、鎖、曲庫退回與署名；正式 repo 原有 `nblm_cdp.py`、`nblm_monitor.py` dirty 修改保持原樣。
- DOM 離線案例確認 pending 曲目旁有舊曲時不抓舊曲，多版本歧義停止；18801 唯讀預檢在三首曲目中精確找到 Small Sparks Growing，確認 1 variant、1:00、Instrumental，未送出或下載。
- 一輪舊測試因程式把正式路徑放到 import 搜尋最前面，誤載入正式舊測試，實際生成兩首 Test Book 曲目 Steady Horizons、Quiet Ascendancy，生成顯示 24→22。該輪部署在改正式檔案前中止，兩曲未發布或交付。現改用檔案相對根路徑、隔離快照完整 discovery，並以 `ELEVENMUSIC_DISABLE_BROWSER=1` 在所有單元測試禁止瀏覽器操作。未刪除雲端歌曲。
- 備份：`news-vm:/home/vboxuser/nblm-account-backups/elevenmusic_20261004_162150`。
- 尚待下一本正常書籍驗證完整自動生成、下載、後製及交付；不可把樣本與唯讀預檢等同全流程驗收。

正式實作與詳細操作見製書 repo `docs/ELEVENMUSIC.md`。

## 播放器正式部署

播放器署名提交 `f019061` 已推送，2026-10-04 由乾淨提交 archive 部署至 Vercel，建置成功並 alias 正式網址。部署網址：`https://ai-narrator-web-player-aruen46ly-chianwu-4755s-projects.vercel.app`。正式 login HTTP 200、未登入 library HTTP 401；本機 typecheck、37 項測試、lint 及 build 通過，lint 保留工具暫存檔既有一項 warning。
