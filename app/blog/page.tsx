import { getAllArticles } from '@/lib/articles';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '採用ブログ',
  description: 'Futuristic Imaginationの採用ブログ。AIと共に働く環境、バイブコーディング文化、リモートワークの実態を発信中。',
};

export default async function BlogPage() {
  const articles = await getAllArticles();

  return (
    <>
      <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), transparent)', padding: '60px 24px 48px', borderBottom: '1px solid var(--border)' }}>
        <div className="container">
          <div className="section-tag" style={{ marginBottom: 8 }}>Recruit Blog</div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.4rem)', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 8 }}>採用ブログ</h1>
          <p style={{ color: 'var(--text-muted)' }}>全 {articles.length} 記事 — AIが毎週自動生成・公開</p>
        </div>
      </div>

      <section className="section">
        <div className="container">
          {articles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
              <p style={{ fontSize: '2rem', marginBottom: 12 }}>🤖</p>
              <p>記事を生成中です。しばらくお待ちください。</p>
            </div>
          ) : (
            <div className="article-grid">
              {articles.map(article => (
                <Link key={article.slug} href={`/blog/${article.slug}`} className="article-card">
                  <span className="card-tag">{article.category}</span>
                  <h2 className="card-title">{article.title}</h2>
                  <p className="card-excerpt">{article.excerpt}</p>
                  <div className="card-meta">
                    <span>{article.publishedAt}</span>
                    <span className="card-dot" />
                    <span>{article.readingTime}分で読める</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="container">
        <div className="cta-banner">
          <h2>一緒に作りませんか？</h2>
          <p>職種・経験より「熱量」を重視しています。まずはカジュアルに話しましょう。</p>
          <a href="https://forms.gle/Vw1PBQefXRLvTw459" target="_blank" rel="noopener" className="btn-primary">応募・カジュアル面談 →</a>
        </div>
      </div>
    </>
  );
}
