import type { Metadata, Viewport } from 'next';
import { tokens } from '@vunvault/ui';
import { env } from '../env';
import { inter } from '../lib/fonts';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_SITE_URL),
  title: {
    default: 'VUNVAULT — We Find The Cracks Before They Do',
    template: '%s — VUNVAULT',
  },
  description:
    'Africa-rooted, worldwide penetration testing, vulnerability assessments and cybersecurity education.',
  openGraph: {
    siteName: 'VUNVAULT',
  },
};

export const viewport: Viewport = {
  themeColor: tokens.color.paper,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-paper text-ink antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
