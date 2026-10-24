import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Condovery — Tudo de bom mora aqui',
  description: 'Compre e venda com quem mora pertinho. O marketplace exclusivo do seu condomínio.',
  applicationName: 'Condovery',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Condovery' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FBE248' };
export default function RootLayout({ children }: Readonly<{children:React.ReactNode}>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
