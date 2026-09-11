import type { Metadata } from 'next';
import './globals.css';
import './chat-refinement.css';
import './mobile.css';
import './visual-polish.css';
export const metadata: Metadata = { title: 'SYORA — Private conversations. Real connection.', description: 'A thoughtful space for your inner circle. SYORA frontend preview.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
