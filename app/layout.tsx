import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Vienna Quest · Notre aventure à deux', description: 'Vienne, du 12 au 16 octobre 2026. Une ville à découvrir, une aventure à partager.', manifest: '/manifest.webmanifest', icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' }, appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Vienna Quest' }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#123e37' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="fr"><body>{children}</body></html>; }
