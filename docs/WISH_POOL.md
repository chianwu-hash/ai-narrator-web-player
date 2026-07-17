# 許願池設定紀錄

## 前台入口

播放器登入後，左側導覽與手機底部導覽會出現「許願池」。

使用者可不記名填寫：

- 想聽的書名
- 作者，可不填
- 推薦理由

前台也會公開顯示所有未刪除願望，讓其他使用者看得到大家想聽的書。

顯示方式：

- SVG 許願池
- 書籍以封面卡片形式散落在池內
- 下方另有文字清單，確保手機與無法 hover 的裝置也能閱讀完整內容

封面來源：

- 伺服器使用 Open Library Search API 以書名與作者查詢 `cover_i`
- 若找到封面，使用 Open Library Covers API 產生封面圖網址
- 若找不到封面，顯示站內預設書封
- 封面不下載、不儲存在本站資料庫

## 後台入口

```text
https://ai-narrator-web-player.vercel.app/admin/wishes
```

後台可依狀態管理願望：

```text
new        新願望
reviewing  考慮中
accepted   已採納
rejected   暫不製作
done       已完成
```

## Supabase 資料表

需要執行：

```text
supabase/migrations/202607170004_book_wishes.sql
```

資料表：

```text
book_wishes
- id
- title
- author
- reason
- status
- created_at
- updated_at
- deleted_at
```

## 隱私原則

許願池不要求登入者填姓名，也不記錄使用者聽了什麼書。

目前只保存願望內容本身，作為管理者規劃下一批製書的參考。願望內容會在前台公開顯示，因此使用者不應填入私人資訊。
