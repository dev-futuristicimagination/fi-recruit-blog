import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

const GA_ID = 'G-4KWG9DXVVH';

export const metadata: Metadata = {
  title: {
    template: '%s | Futuristic Imagination 採用',
    default: 'Futuristic Imagination 採用情報 | AI開発スタートアップ',
  },
  description: 'Futuristic Imaginationの採用情報・社員ブログ。AIと共に働く環境、バイブコーディング文化、フルリモートの働き方を紹介。',
  metadataBase: new URL('https://recruit.futuristicimagination.co.jp'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta name="google-site-verification" content="NhSqVizPqiZ0-iBXVXx31ALrmwTg1Oj2OkqCU5PLiVw" />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
        </Script>
      </head>
      <body>
        <nav>
          <div className="nav-inner">
            <a href="/" className="nav-logo">FI Recruit</a>
            <div className="nav-links">
              <a href="/blog">採用ブログ</a>
              <a href="https://www.futuristicimagination.co.jp/recruit/" target="_blank" rel="noopener">採用情報</a>
              <a href="https://www.futuristicimagination.co.jp/" target="_blank" rel="noopener">会社HP</a>
            </div>
            <a href="https://forms.gle/Vw1PBQefXRLvTw459" target="_blank" rel="noopener" className="nav-cta">
              応募する →
            </a>
          </div>
        </nav>
        {children}
        <footer>
          <p>© 2026 Futuristic Imagination LLC — <a href="https://www.futuristicimagination.co.jp/" target="_blank" rel="noopener">会社HP</a></p>
        </footer>
      </body>
    </html>
  );
}
