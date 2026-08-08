# AI 說書人通用網頁播放器

一個獨立於 Telegram bot 的私人說書音訊播放器。以 Next.js + TypeScript 建置並部署於 Vercel，書庫來源為指定的 Google Drive 根目錄。

## 目前功能

- 共用邀請碼登入、HttpOnly cookie、錯誤嘗試限制，以及邀請碼／版本變更後舊 session 失效
- 獨立管理者碼與管理者 session；一般邀請碼不能進入管理後台
- 僅掃描指定 Drive 根目錄及「每本書一個子資料夾」的可預測索引
- `EP01`、`第 1 集`、數字開頭等集數解析與真正的數字排序
- 排除開場／結尾音樂、測試、暫存、工作檔等非書籍音訊
- 播放、暫停、上一集、下一集、倒退 15 秒、快轉 30 秒、拖曳與速度調整
- 自動播放下一集；為降低不必要流量，不在接近結尾時主動預抓下一集音訊
- IndexedDB 本機進度、續聽、已完成判定、整本與單集最愛
- 以匿名收聽檔案與短效配對碼同步進度、最愛、倍速、最後播放單集與播放器風格
- Media Session 鎖定畫面資訊與控制（瀏覽器支援時）
- 手機單手操作介面、底部迷你播放器與完整播放器
- 最近新增、最近播放、匿名熱門書籍與熱門單集
- 公開書籍／單集留言、匿名許願池，以及同一瀏覽器對自有留言的編輯與刪除
- 管理後台：留言、許願、匿名設備活動與 Drive 書封管理
- 無封面、無 metadata、Drive 失敗時的降級顯示

## 本機啟動

1. 複製 `.env.example` 為 `.env.local`。
2. 先保留 `DRIVE_MODE=mock`，填入測試用登入設定。
3. 執行 `npm install`，再執行 `npm run dev`。
4. 打開終端顯示的本機網址。

產生邀請碼 SHA-256：

```bash
node -e "const c=require('node:crypto');const s=process.argv[1];console.log(c.createHash('sha256').update(s).digest('hex'))" "你的邀請碼"
```

產生 session secret：

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 驗證

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

完整資料流、安全界線與部署步驟請見 `docs/ARCHITECTURE.md` 與 `docs/VERCEL.md`。Supabase 功能需要先執行 `supabase/migrations/` 內的 migration。

小說類聲線複製的第一輪能力測試、語速曲線與建議產線規格，請見 `docs/QWEN3_TTS_VOICE_CLONE_MVP.md`。

Gemini TTS 小說有聲書的正式切段、雙聲演播、發音渲染、免費配額、人工 QA 與音樂過門流程，請見 `docs/GEMINI_TTS_FICTION_AUDIOBOOK_SOP.md`。

## 目前限制

- 未開啟同步前，進度與最愛只存在目前瀏覽器；開啟同步後可透過配對碼連結其他設備。無痕模式或清除網站資料後需要重新配對。
- 共用邀請碼是有限度的私人存取控制，不是 DRM。
- 正式音訊 bytes 應透過 Cloudflare Worker 以短效簽章 URL 與 Range request 從私人 Drive 串流；Vercel 只負責登入、書庫 API、簽 URL 與 token broker。未設定 Worker 的環境才回退到 Vercel 音訊 route。
- 一般書庫索引、播放與封面讀取只讀取 Drive。管理員在 `/admin/covers` 明確上傳封面時，系統會新增或更新該書資料夾內的封面檔；不會移動、重新命名或刪除其他 Drive 檔案。
- 網站不會操作 Telegram bot；製書與 Telegram 交付屬於另一條營運流程。
