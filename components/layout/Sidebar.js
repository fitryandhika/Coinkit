"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Flame, ListFilter, History as HistoryIcon } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/opportunities", label: "Opportunities", icon: Flame },
  { href: "/scanner", label: "Screener", icon: ListFilter },
  { href: "/screener-history", label: "Kalibrasi", icon: HistoryIcon },
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
    </nav>
  );
}
