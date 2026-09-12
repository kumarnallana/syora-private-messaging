import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
export const metadata: Metadata = { title: 'SYORA — Private conversations. Real connection.', description: 'A thoughtful space for your inner circle. SYORA frontend preview.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', interactiveWidget: 'resizes-content' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
