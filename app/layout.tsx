import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { other: { 'google-adsense-account': 'ca-pub-9965214582265857' }, manifest: '/manifest.webmanifest', appleWebApp: { capable: true, title: '설비노트', statusBarStyle: 'default' }, icons: { apple: '/icons/icon-180.png' }, title: '설비노트 | 현장부터 견적까지', description: '주거·상가 수도배관 현장 관리, 견적서, 사진·음성 작업 기록' };
export default function RootLayout({ children }: {
    children: React.ReactNode;
}) { return <html lang="ko"><body>{children}</body></html>; }

