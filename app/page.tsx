import { getAllArticles } from '@/lib/articles';
import Link from 'next/link';

export default async function Home() {
  const articles = await getAllArticles();
  const latest = articles.slice(0, 3);

  return (
    <>
      {/* HERO */}
      <section className="hero">
        <div className="hero-badge">✦ AI × 採用コンテンツ 自動化実証中</div>
        <h1>
          AIと共に働く仲間を、<br />
          <span>AIが探してくる。</span>
        </h1>
        <p className="hero-sub">
          Futuristic Imaginationは「AIを作る会社」です。<br />
          この採用ブログ自体も、AIが毎週自動生成しています。
        </p>
        <div className="hero-actions">
          <Link href="/blog" className="btn-primary">採用ブログを読む →</Link>
          <a href="https://forms.gle/Vw1PBQefXRLvTw459" target="_blank" rel="noopener" className="btn-secondary">
            応募・問い合わせ
          </a>
        </div>
      </section>

      {/* STATS */}
      <div className="stats">
        <div className="stats-grid">
          <div>
            <div className="stat-num">100%</div>
            <div className="stat-label">フルリモート勤務</div>
          </div>
          <div>
            <div className="stat-num">0円</div>
            <div className="stat-label">Indeed費用（自動採用）</div>
          </div>
          <div>
            <div className="stat-num">週1本</div>
            <div className="stat-label">AIが採用記事を自動公開</div>
          </div>
          <div>
            <div className="stat-num">∞</div>
            <div className="stat-label">バイブコーディングの可能性</div>
          </div>
        </div>
      </div>

      {/* LATEST ARTICLES */}
      {latest.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-header">
              <div className="section-tag">Latest Posts</div>
              <h2 className="section-title">最新の採用ブログ</h2>
              <p className="section-sub">AIが毎週生成・公開しています</p>
            </div>
            <div className="article-grid">
              {latest.map(article => (
                <Link key={article.slug} href={`/blog/${article.slug}`} className="article-card">
                  <span className="card-tag">{article.category}</span>
                  <h3 className="card-title">{article.title}</h3>
                  <p className="card-excerpt">{article.excerpt}</p>
                  <div className="card-meta">
                    <span>{article.publishedAt}</span>
                    <span className="card-dot" />
                    <span>{article.readingTime}分で読める</span>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 36 }}>
              <Link href="/blog" className="btn-secondary">全ての記事を見る →</Link>
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <div className="container">
        <div className="cta-banner">
          <h2>一緒に「AIで世界を変える」仲間を募集中</h2>
          <p>職種・経験不問。AIと向き合い、本気でプロダクトを作れる人を待っています。</p>
          <a href="https://forms.gle/Vw1PBQefXRLvTw459" target="_blank" rel="noopener" className="btn-primary">
            応募・カジュアル面談を申し込む →
          </a>
        </div>
      </div>
    </>
  );
}
