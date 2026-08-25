import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata = {
  title: "Coinkit",
  description: "Bitget market analysis & screener untuk trading manual",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
