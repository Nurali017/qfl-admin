import type { Metadata } from 'next';
import { Noto_Sans, Rubik } from 'next/font/google';

import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const headingFont = Rubik({ subsets: ['latin', 'cyrillic'], variable: '--font-heading' });
const bodyFont = Noto_Sans({ subsets: ['latin', 'cyrillic'], variable: '--font-body' });

export const metadata: Metadata = {
  title: 'QFL Admin',
  description: 'QFL admin panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${headingFont.variable} ${bodyFont.variable}`}>
      <body style={{ fontFamily: 'var(--font-body)' }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
