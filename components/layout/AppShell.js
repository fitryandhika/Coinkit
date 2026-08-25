"use client";

import Sidebar from "./Sidebar";

export default function AppShell({ children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-shell-content">{children}</main>
    </div>
  );
}
