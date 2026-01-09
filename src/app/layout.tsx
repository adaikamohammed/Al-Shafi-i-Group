import type { Metadata } from 'next';
import './globals.css';
import { AuthWrapper } from '@/components/ui/AuthWrapper';

export const metadata: Metadata = {
  title: 'مدير مدرسة الشافعي',
  description: 'إدارة مدرسة الإمام الشافعي القرآنية',
  manifest: '/manifest.json',
  themeColor: '#808000',
  viewport: 'width=device-width, initial-scale=1.0',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <AuthWrapper>{children}</AuthWrapper>
      </body>
    </html>
  );
}
