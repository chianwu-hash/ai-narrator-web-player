# 許願池設定紀錄

## 前台入口

播放器登入後，左側導覽與手機底部導覽會出現「許願池」。

使用者可不記名填寫：

- 想聽的書名
- 作者，可不填
- 推薦理由

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

目前只保存願望內容本身，作為管理者規劃下一批製書的參考。
