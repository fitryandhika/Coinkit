"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flame, ListFilter, ShieldCheck, Bot, History as HistoryIcon, TrendingUp } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/opportunities", label: "Opportunities", icon: Flame },
  { href: "/scanner", label: "Scanner", icon: ListFilter },
  { href: "/risk", label: "Risk Planner", icon: ShieldCheck },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/history", label: "History", icon: HistoryIcon },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="app-sidebar">
      <Link href="/" className="app-sidebar-logo">C</Link>
      <div className="app-sidebar-nav">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={pathname === href ? "app-sidebar-item active" : "app-sidebar-item"} title={label}>
            <Icon size={20} />
          </Link>
        ))}
      </div>
      <Link href="/performance" className={pathname === "/performance" ? "app-sidebar-item app-sidebar-bottom active" : "app-sidebar-item app-sidebar-bottom"} title="Performance">
        <TrendingUp size={20} />
      </Link>
    </nav>
  );
}
