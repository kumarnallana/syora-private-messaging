import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@/styles/chat-refinement.css';
import '@/styles/mobile.css';
import '@/styles/visual-polish.css';
export const metadata: Metadata = { title: 'SYORA — Private conversations. Real connection.', description: 'A thoughtful space for your inner circle. SYORA frontend preview.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
