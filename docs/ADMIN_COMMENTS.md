# 留言管理後台設定紀錄

## 入口

- 後台登入頁：`/admin/login`
- 留言管理頁：`/admin/comments`

正式站範例：

```text
https://ai-narrator-web-player.vercel.app/admin/login
```

## 權限設計

- 一般使用者仍使用「邀請碼」登入播放器。
- 管理者使用獨立的「管理者碼」登入後台。
- 管理者 session 使用獨立 cookie：`ai_narrator_admin_session`。
- 管理者 session 與一般播放器 session 分離，不能互相替代。

## Vercel 環境變數

後台至少需要下列環境變數：

```text
ADMIN_ACCESS_CODE_SHA256
```

可選：

```text
ADMIN_AUTH_VERSION
```

用途：

- `ADMIN_ACCESS_CODE_SHA256`：管理者碼的 SHA256 雜湊值。
- `ADMIN_AUTH_VERSION`：想讓舊的管理者登入狀態失效時，把版本值改掉即可。

若暫時不想手算 SHA256，也可以設定：

```text
ADMIN_ACCESS_CODE
```

但正式環境建議使用 `ADMIN_ACCESS_CODE_SHA256`，避免明文管理者碼放在 Vercel。

## 留言狀態

後台可切換下列狀態：

```text
new        新留言
reviewing  處理中
resolved   已解決
ignored    隱藏
```

前台只顯示：

- 未刪除
- 狀態不是 `ignored`

## 刪除策略

後台的「刪除」是軟刪除：

- 寫入 `deleted_at`
- 前台不顯示
- 後台一般列表也不顯示

這樣保留資料庫層面的追蹤空間，但不讓使用者繼續看到該留言。

## 隱私原則

目前後台只管理留言內容，不記錄使用者聽了什麼書、聽到哪一集或播放進度。

留言會包含：

- 留言對象：整本書或單集
- 書名
- 單集名稱，如果留言針對單集
- 留言類型
- 留言內容
- 建立與更新時間
- 是否有原瀏覽器匿名作者標記

## 舊留言限制

在匿名作者標記功能完成前送出的舊留言，沒有 `author_token_hash`。

結果：

- 可以公開顯示
- 管理者可以在後台處理
- 原使用者不一定能在前台自行編輯或刪除

新留言會自動綁定同一瀏覽器的匿名作者標記。
