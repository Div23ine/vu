import type { Metadata, Viewport } from 'next';
import { env } from '../env';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: { default: 'UAMP HQ — Uptime & Reliability', template: '%s — UAMP HQ' },
  description: 'Uptime, API, SSL, DNS and domain monitoring by VUNVAULT.',
  applicationName: 'UAMP HQ',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#0b1220' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}