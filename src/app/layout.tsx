import type { Metadata, Viewport } from 'next';
import { DM_Sans, Outfit } from 'next/font/google';
import './globals.css';

const outfit=Outfit({
  subsets:['latin'],
  display:'swap',
  variable:'--font-outfit',
  weight:['400','500','600','700','800','900']
});
const dmSans=DM_Sans({
  subsets:['latin'],
  display:'swap',
  variable:'--font-dm-sans',
  weight:['400','500','600','700','800']
});
export const metadata: Metadata = {
  title: 'Condovery — Tudo de bom mora aqui',
  description: 'Compre e venda com quem mora pertinho. O marketplace exclusivo do seu condomínio.',
  applicationName: 'Condovery',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Condovery' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#FC6741' };
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>) {
  return <html lang="pt-BR"><body className={outfit.variable+' '+dmSans.variable}>{children}</body></html>;
}
