# 首頁最近新增與匿名播放排行

更新日期：2026-07-18

## 目標

播放器首頁除了個人的續播資訊，也提供內容層級的探索入口：

- 最近新增：依 Google Drive 書籍資料夾的 `modifiedTime` 排序。
- 熱門書籍：依匿名累積播放次數排序。
- 熱門單集：依匿名累積播放次數排序。

## 隱私邊界

播放排行只記錄「哪本書 / 哪一集被播放幾次」，不記錄：

- 使用者名稱
- 設備 ID
- IP
- 播放進度
- 收藏
- 留言

這和 `/admin/devices` 的設備活動監控是兩件事。設備活動只看匿名設備數量與活躍時間；播放排行只看內容熱度。

## Supabase 資料表

Migration：

```text
supabase/migrations/202607180001_content_play_stats.sql
```

主要資料表：

```text
public.content_play_stats
```

主要欄位：

- `target_type`：`book` 或 `episode`
- `book_id` / `book_title`
- `episode_id` / `episode_title`
- `play_count`
- `last_played_at`

寫入透過 Supabase function：

```text
public.record_content_play(...)
```

當播放單集時，系統會同時累積：

- 該單集播放次數
- 所屬書籍播放次數

## API

```text
GET /api/stats/play
POST /api/stats/play
```

兩個端點都需要播放器登入後的 session。若 Supabase 未設定或 migration 尚未執行，首頁仍可正常使用，只是不顯示排行。

## 前台顯示規則

- 有本機播放紀錄時，顯示「最近播放」。
- 永遠顯示「最近新增」。
- 有排行資料時，才顯示「熱門書籍」與「熱門單集」。

這樣首頁在資料量少時不會出現空白排行，也不會把個人資訊和全站匿名統計混在一起。
