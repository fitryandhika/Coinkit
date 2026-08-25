import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata = {
  title: "CryptoAI",
  description: "Bitget market analysis & manual trading assistant",
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
