import { getArticleBySlug, getAllArticles } from '@/lib/articles';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export async function generateStaticParams() {
  const articles = await getAllArticles();
  return articles.map(a => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return {};
  return { title: article.title, description: article.excerpt };
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hublp])/gm, '')
    .replace(/^(.+)(?<!>)$/gm, (m) => m.startsWith('<') ? m : `<p>${m}</p>`);
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  return (
    <>
      <div style={{ borderBottom: '1px solid var(--border)', padding: '32px 24px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link href="/blog" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
            ← 採用ブログ一覧
          </Link>
        </div>
      </div>

      <article className="article-page">
        <span className="card-tag">{article.category}</span>
        <h1>{article.title}</h1>
        <div className="article-meta">
          <span>{article.publishedAt}</span>
          <span>·</span>
          <span>{article.readingTime}分で読める</span>
          <span>·</span>
          <span>AI自動生成</span>
        </div>
        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
        />

        <div style={{ marginTop: 64, padding: 36, background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 8 }}>この記事を読んで、気になりましたか？</p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem' }}>まずはカジュアルに話しましょう。選考なし・30分。</p>
          <a href="https://forms.gle/Vw1PBQefXRLvTw459" target="_blank" rel="noopener" className="btn-primary">
            カジュアル面談を申し込む →
          </a>
        </div>
      </article>
    </>
  );
}
