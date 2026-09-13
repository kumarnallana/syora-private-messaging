import type { Metadata, Viewport } from 'next';
import { ThemeController } from '@/components/theme-controller';
import '@/styles/globals.css';
export const metadata: Metadata = { title: 'SYORA — Private conversations. Real connection.', description: 'A thoughtful space for your inner circle. SYORA frontend preview.' };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', interactiveWidget: 'resizes-content' };
const themeBoot = `(function(){try{var p=JSON.parse(localStorage.getItem('syora:preferences')||'{}').appearance||'dark';document.documentElement.dataset.theme=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p}catch(e){document.documentElement.dataset.theme='dark'}})()`;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><body><script id="syora-theme" dangerouslySetInnerHTML={{ __html: themeBoot }}/><ThemeController/>{children}</body></html>; }
