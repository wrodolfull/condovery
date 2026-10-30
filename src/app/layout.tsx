import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/outfit/wght.css';
import '@fontsource-variable/dm-sans/wght.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Elevadoor — Tudo de bom mora aqui',
  description: 'Compre e venda com quem mora pertinho. O marketplace exclusivo do seu condomínio.',
  applicationName: 'Elevadoor',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Elevadoor' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FC6741' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
