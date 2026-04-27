import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const REPO = 'dev-futuristicimagination/fi-recruit-blog';
const GITHUB_API = `https://api.github.com/repos/${REPO}/contents/content/articles`;

interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  readingTime: number;
  content: string;
}

function parseMarkdown(raw: string, slug: string): Article | null {
  const text = raw.replace(/^\uFEFF/, '');
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const [, fm, body] = m;
  const get = (k: string) => {
    const r = fm.match(new RegExp(`^${k}:\\s*"?([^"\\r\\n]+)"?`, 'm'));
    return r ? r[1].trim() : '';
  };
  const title = get('title') || slug;
  const wordCount = body.replace(/[#*`>]/g, '').length;
  return {
    slug: get('slug') || slug,
    title,
    excerpt: get('excerpt') || body.slice(0, 120).replace(/\n/g, ' '),
    category: get('category') || '採用',
    publishedAt: get('publishedAt').slice(0, 10),
    readingTime: Math.max(1, Math.ceil(wordCount / 400)),
    content: body.trim(),
  };
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
    .split('\n\n')
    .map(block => {
      if (/^<[hublp]/.test(block.trim())) return block;
      const t = block.trim();
      return t ? `<p>${t}</p>` : '';
    })
    .join('\n');
}

async function fetchArticle(slug: string): Promise<Article | null> {
  try {
    const token = process.env.GITHUB_TOKEN;
    const filename = encodeURIComponent(decodeURIComponent(slug)) + '.md';
    const url = `${GITHUB_API}/${filename}`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.raw+json',
      },
    });
    if (!res.ok) {
      console.error(`[fetchArticle] GitHub API ${res.status} for slug: ${slug}`);
      return null;
    }
    const raw = await res.text();
    return parseMarkdown(raw, slug);
  } catch (e) {
    console.error(`[fetchArticle] Error:`, e);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await fetchArticle(slug);
  if (!article) return {};
  return { title: article.title, description: article.excerpt };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  console.log(`[ArticlePage] slug="${slug}" len=${slug.length}`);

  const article = await fetchArticle(slug);

  if (!article) {
    notFound();
  }

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

        {/* SNS シェアボタン */}
        <div style={{ margin: '40px 0 32px', padding: '20px 24px', background: 'var(--bg3)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>💬 この記事をシェアする</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(`https://recruit.futuristicimagination.co.jp/blog/${article.slug}`)}&hashtags=FI採用,AI開発`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#000', color: '#fff', padding: '8px 16px', borderRadius: 9999, fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none' }}
            >
              𝕏 ポスト
            </a>
            <a
              href={`https://line.me/R/msg/text/?${encodeURIComponent(article.title + '\n' + `https://recruit.futuristicimagination.co.jp/blog/${article.slug}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#06C755', color: '#fff', padding: '8px 16px', borderRadius: 9999, fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none' }}
            >
              💬 LINE
            </a>
            <a
              href={`https://b.hatena.ne.jp/entry/s/recruit.futuristicimagination.co.jp/blog/${article.slug}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#00A4DE', color: '#fff', padding: '8px 16px', borderRadius: 9999, fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none' }}
            >
              B! はてブ
            </a>
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://recruit.futuristicimagination.co.jp/blog/${article.slug}`)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#1877F2', color: '#fff', padding: '8px 16px', borderRadius: 9999, fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none' }}
            >
              f Facebook
            </a>
          </div>
        </div>

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
