# AI 說書人通用網頁播放器

一個獨立於 Telegram bot 的私人說書音訊播放器。以 Next.js + TypeScript 建置，目標部署平台為 Vercel，書庫來源為指定的 Google Drive 根目錄。

## MVP 已包含

- 共用邀請碼登入、HttpOnly cookie、錯誤嘗試限制，以及邀請碼／版本變更後舊 session 失效
- 僅掃描指定 Drive 根目錄及「每本書一個子資料夾」的可預測索引
- `EP01`、`第 1 集`、數字開頭等集數解析與真正的數字排序
- 排除開場／結尾音樂、測試、暫存、工作檔等非書籍音訊
- 播放、暫停、上一集、下一集、倒退 15 秒、快轉 30 秒、拖曳與速度調整
- IndexedDB 本機進度、續聽、已完成判定、整本與單集最愛
- Media Session 鎖定畫面資訊與控制（瀏覽器支援時）
- 手機單手操作介面、底部迷你播放器與完整播放器
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

更完整的資料流、安全界線與部署步驟請見 `docs/ARCHITECTURE.md` 與 `docs/VERCEL.md`。

## MVP 限制

- 未開啟同步前，進度與最愛只存在目前瀏覽器；開啟同步後可透過配對碼連結其他設備。無痕模式或清除網站資料後需要重新配對。
- 共用邀請碼是有限度的私人存取控制，不是 DRM。
- 音訊經 Vercel Functions 分段代理，會產生 Functions 執行與資料傳輸用量；若日後大量使用，應評估能保留私密授權的 CDN／物件儲存方案。
- 不會修改、移動、重新命名或刪除 Drive 檔案，也不會操作現有 Telegram bot。
