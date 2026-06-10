import './globals.css';
import './mobile.css';
import ShellChrome from '@/components/ShellChrome';

export const metadata = {
  title: 'Tabularium',
  description: 'Gestionale interno per incassi, spese, fornitori e report mensili',
  manifest: '/manifest.webmanifest',
  themeColor: '#0b2f66',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="it"><body><main className="shell">
    <ShellChrome slot="header" />

    <script dangerouslySetInnerHTML={{ __html: `
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
      }
    ` }} />
    {children}{/* dms-root-suspense-boundary */}
    <ShellChrome slot="footer" />
  </main></body></html>;
}
