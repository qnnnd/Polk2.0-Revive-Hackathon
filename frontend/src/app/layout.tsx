import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Revive Bounty Board",
  description: "Decentralized bounty task platform on Revive/Polkadot EVM",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <ToastProvider>
            <div className="mx-auto max-w-[1100px] p-6">
              <Header />
              <main className="mt-5">{children}</main>
            </div>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  );
}
