import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthWrapper } from '@/components/ui/AuthWrapper';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { NotificationPrompter } from '@/components/ui/NotificationPrompter';

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
  const isDev = process.env.NODE_ENV === 'development';
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet" />
        {isDev && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    var unregisteredAny = false;
                    var promises = [];
                    for (var i = 0; i < registrations.length; i++) {
                      promises.push(
                        registrations[i].unregister().then(function(success) {
                          if (success) {
                            console.log('Unregistered stale service worker in dev mode.');
                            unregisteredAny = true;
                          }
                        })
                      );
                    }
                    if (promises.length > 0) {
                      Promise.all(promises).then(function() {
                        if (unregisteredAny) {
                          console.log('Reloading page after unregistering service workers...');
                          window.location.reload();
                        }
                      });
                    }
                  });
                }
              `
            }}
          />
        )}
      </head>
      <body className="font-body antialiased">
        <ErrorBoundary>
          <AuthWrapper>
            <NotificationPrompter />
            {children}
          </AuthWrapper>
        </ErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
