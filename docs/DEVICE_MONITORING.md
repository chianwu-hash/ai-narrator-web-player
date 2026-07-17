# 設備使用監控設定紀錄

## 入口

```text
https://ai-narrator-web-player.vercel.app/admin/devices
```

## 目的

讓管理者知道目前大概有幾台設備在使用播放器，用於邀請碼管理與風險控管。

## 隱私原則

設備監控不記錄：

- 使用者姓名
- 書名
- 單集
- 播放進度
- 搜尋或瀏覽內容

目前只記錄：

- 匿名設備雜湊
- 粗略設備類型：手機、平板、電腦、未知
- 粗略瀏覽器類型：Chrome、Safari、Edge、Firefox、Unknown
- 首次出現時間
- 最後活動時間

## 前台回報規則

使用者登入播放器後：

- 頁面載入時回報一次
- 每 5 分鐘最多回報一次
- 分頁重新回到可見狀態時補回報

## Supabase 資料表

需要執行：

```text
supabase/migrations/202607170005_device_activity.sql
```

資料表：

```text
device_activity
- id
- device_hash
- device_kind
- browser_family
- first_seen_at
- last_seen_at
```

## 後台顯示

後台顯示：

- 總設備數
- 最近 24 小時活躍設備數
- 最近 7 天活躍設備數
- 匿名設備列表與最後活動時間
