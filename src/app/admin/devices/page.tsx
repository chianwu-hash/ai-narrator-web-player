import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { deviceActivityAvailable, listAdminDeviceActivity } from "@/lib/device-activity-server";
import { AdminNav } from "../admin-nav";
import { AdminLogoutButton } from "../comments/admin-comment-actions";
import "../admin.css";

type DeviceActivity = Awaited<ReturnType<typeof listAdminDeviceActivity>>;
type DeviceItem = DeviceActivity["devices"][number];

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function deviceKindLabel(kind: string): string {
  if (kind === "mobile") return "手機";
  if (kind === "tablet") return "平板";
  if (kind === "desktop") return "電腦";
  return "未知";
}

function relativeTime(value: string): string {
  const diff = Date.now() - Date.parse(value);
  if (!Number.isFinite(diff) || diff < 0) return "";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function DeviceRow({ device, index }: { device: DeviceItem; index: number }) {
  return (
    <article className="admin-device-row">
      <div>
        <b>設備 {index + 1}</b>
        <span>{deviceKindLabel(device.deviceKind)} · {device.browserFamily}</span>
      </div>
      <div>
        <small>首次出現</small>
        <span>{formatDateTime(device.firstSeenAt)}</span>
      </div>
      <div>
        <small>最後活動</small>
        <span>{formatDateTime(device.lastSeenAt)} · {relativeTime(device.lastSeenAt)}</span>
      </div>
    </article>
  );
}

export default async function AdminDevicesPage() {
  if (!await isAdminAuthenticated()) redirect("/admin/login");
  let activity: DeviceActivity = { total: 0, active24h: 0, active7d: 0, devices: [] };
  let error = "";

  if (!deviceActivityAvailable()) {
    error = "設備監控尚未設定 Supabase。";
  } else {
    try {
      activity = await listAdminDeviceActivity();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "設備活動讀取失敗。";
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">DEVICES</p>
          <h1>設備使用監控</h1>
          <p>只統計匿名設備活動，不記錄書名、單集或播放進度。</p>
        </div>
        <AdminLogoutButton />
      </header>

      <AdminNav active="devices" />

      <section className="admin-device-stats" aria-label="設備統計">
        <div><b>{activity.total}</b><span>總設備數</span></div>
        <div><b>{activity.active24h}</b><span>24 小時活躍</span></div>
        <div><b>{activity.active7d}</b><span>7 天內活躍</span></div>
      </section>

      <section className="admin-panel">
        <div className="admin-panel-heading">
          <h2>匿名設備列表</h2>
          <span>{activity.devices.length} 台</span>
        </div>
        {error && <div className="admin-warning">{error}</div>}
        {!error && activity.devices.length === 0 && <div className="admin-empty">目前還沒有設備活動紀錄。</div>}
        <div className="admin-device-list">
          {activity.devices.map((device, index) => <DeviceRow key={device.id} device={device} index={index} />)}
        </div>
      </section>
    </main>
  );
}
