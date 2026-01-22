import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'مدير مدرسة الشافعي',
  description: 'إدارة مدرسة الإمام الشافعي القرآنية',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  themeColor: '#808000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <ErrorBoundary>
          <AuthWrapper>
            {children}
          </AuthWrapper>
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
