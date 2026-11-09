import type { Metadata, Viewport } from 'next';
import { env } from '../env';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: 'UAMP HQ — Reliability Monitoring',
    template: '%s — UAMP HQ'
  },
  description: 'Website, API, DNS, TLS and domain reliability monitoring by VUNVAULT.',
  applicationName: 'UAMP HQ',
  robots: { index: false, follow: false }
};

export const viewport: Viewport = {
  themeColor: '#0b1220'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
