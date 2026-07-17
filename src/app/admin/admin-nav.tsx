import Link from "next/link";

type AdminSection = "dashboard" | "comments" | "wishes" | "devices";

const adminLinks: { key: AdminSection; href: string; label: string; description: string }[] = [
  { key: "dashboard", href: "/admin", label: "總覽", description: "管理入口" },
  { key: "comments", href: "/admin/comments", label: "留言管理", description: "感想與錯誤回報" },
  { key: "wishes", href: "/admin/wishes", label: "許願池", description: "想聽書單" },
  { key: "devices", href: "/admin/devices", label: "設備監控", description: "匿名設備活動" },
];

export function AdminNav({ active }: { active: AdminSection }) {
  return (
    <nav className="admin-nav" aria-label="後台導覽">
      <Link href="/" className="admin-nav-player">
        <span>回播放器</span>
        <small>前台收聽頁</small>
      </Link>
      {adminLinks.map((item) => (
        <Link key={item.key} href={item.href} className={item.key === active ? "active" : ""} aria-current={item.key === active ? "page" : undefined}>
          <span>{item.label}</span>
          <small>{item.description}</small>
        </Link>
      ))}
    </nav>
  );
}
