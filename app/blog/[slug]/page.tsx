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
  youtubeId?: string;
  audience?: string;
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
    youtubeId: get('youtubeId') || undefined,
    audience: get('audience') || undefined,
  };
}

function renderMarkdown(md: string): string {
  // Replace YouTube embed markers
  let html = md.replace(
    /<!-- YOUTUBE_EMBED:(\S+) -->/g,
    (_match, videoId) => `<div class="youtube-embed-wrapper"><iframe class="youtube-embed" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
  );

  // Part separators
  html = html.replace(
    /^---$/gm,
    '<hr class="part-separator" />'
  );

  html = html
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^```[\s\S]*?```/gm, (s) => {
      const code = s.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
      return `<pre><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
    })
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .split('\n\n')
    .map(block => {
      if (/^<[hublpcpd]/.test(block.trim())) return block;
      const t = block.trim();
      return t ? `<p>${t}</p>` : '';
    })
    .join('\n');

  return html;
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

// Detect if the article has a dual-audience structure
function hasDualAudience(content: string): boolean {
  return content.includes('PART 1') && content.includes('PART 2');
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  console.log(`[ArticlePage] slug="${slug}" len=${slug.length}`);

  const article = await fetchArticle(slug);

  if (!article) {
    notFound();
  }

  const isDualAudience = hasDualAudience(article.content);
  const hasVideo = !!article.youtubeId;

  return (
    <>
      {/* Inline styles for new components */}
      <style>{`
        .youtube-embed-wrapper {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          border-radius: 12px;
          margin: 28px 0;
          background: #000;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
        }
        .youtube-embed {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          border-radius: 12px;
        }
        .audience-nav {
          display: flex;
          gap: 10px;
          margin: 28px 0 36px;
          background: #f0f0f8;
          padding: 6px;
          border-radius: 10px;
          border: 1px solid #e2e2ee;
        }
        .audience-tab {
          flex: 1;
          padding: 10px 16px;
          border-radius: 7px;
          font-size: 0.82rem;
          font-weight: 600;
          text-align: center;
          cursor: pointer;
          color: #555570;
          transition: all 0.2s;
          border: none;
          background: transparent;
          text-decoration: none;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .audience-tab.active {
          background: #fff;
          color: #5b4fcf;
          box-shadow: 0 2px 8px rgba(91,79,207,0.12);
        }
        .audience-tab:hover:not(.active) {
          background: rgba(255,255,255,0.6);
          color: #1a1a2e;
        }
        .part-separator {
          border: none;
          border-top: 2px dashed #e2e2ee;
          margin: 48px 0;
        }
        .article-body pre {
          background: #1a1a2e;
          color: #e8e8f0;
          padding: 20px 24px;
          border-radius: 10px;
          overflow-x: auto;
          font-size: 0.82rem;
          line-height: 1.7;
          margin: 20px 0;
          font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
        }
        .article-body code {
          background: #f0f0f8;
          color: #5b4fcf;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.82em;
          font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
        }
        .article-body pre code {
          background: none;
          color: inherit;
          padding: 0;
        }
        .cta-triple {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-top: 28px;
        }
        .cta-card {
          padding: 24px 20px;
          border-radius: 12px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          transition: transform 0.2s, box-shadow 0.2s;
          text-decoration: none;
        }
        .cta-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.12);
        }
        .cta-card.cta-hire {
          background: linear-gradient(135deg, #5b4fcf, #7b6fe8);
          color: #fff;
          border: none;
        }
        .cta-card.cta-biz {
          background: #fff;
          border: 2px solid #5b4fcf;
          color: #5b4fcf;
        }
        .cta-card.cta-doc {
          background: #f5f3ff;
          border: 1px solid rgba(91,79,207,0.25);
          color: #1a1a2e;
        }
        .cta-card-icon { font-size: 1.6rem; }
        .cta-card-title { font-size: 0.9rem; font-weight: 700; }
        .cta-card-sub { font-size: 0.75rem; opacity: 0.8; }
        .video-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #fff0f0;
          border: 1px solid #ffcccc;
          color: #cc0000;
          padding: 4px 12px;
          border-radius: 100px;
          font-size: 0.74rem;
          font-weight: 700;
          margin-bottom: 16px;
        }
        .audience-section-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 14px;
          border-radius: 100px;
          font-size: 0.74rem;
          font-weight: 700;
          margin-bottom: 12px;
        }
        .label-engineer {
          background: #eef2ff;
          border: 1px solid #c7d2fe;
          color: #4338ca;
        }
        .label-business {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          color: #15803d;
        }
        @media (max-width: 600px) {
          .cta-triple { grid-template-columns: 1fr; }
          .audience-nav { flex-direction: column; }
        }
      `}</style>

      <div style={{ borderBottom: '1px solid var(--border)', padding: '32px 24px 0' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <Link href="/blog" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
            ← 採用ブログ一覧
          </Link>
        </div>
      </div>

      <article className="article-page">
        <span className="card-tag">{article.category}</span>

        {/* Video badge */}
        {hasVideo && (
          <div style={{ marginTop: 12, marginBottom: 4 }}>
            <span className="video-badge">
              ▶ 動画あり
            </span>
          </div>
        )}

        <h1>{article.title}</h1>
        <div className="article-meta">
          <span>{article.publishedAt}</span>
          <span>·</span>
          <span>{article.readingTime}分で読める</span>
          <span>·</span>
          <span>AI自動生成</span>
          {hasVideo && (
            <>
              <span>·</span>
              <span>📹 動画付き</span>
            </>
          )}
        </div>

        {/* Dual audience navigation */}
        {isDualAudience && (
          <div style={{ marginBottom: 0 }}>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              📖 この記事は2つのパートで構成されています
            </p>
            <div className="audience-nav">
              <a href="#part-engineer" className="audience-tab active">
                ⚡ エンジニア向け
                <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>実装詳細</span>
              </a>
              <a href="#part-business" className="audience-tab">
                📈 経営者・パートナー向け
                <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>ビジネス価値</span>
              </a>
            </div>
          </div>
        )}

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

        {/* Triple CTA block */}
        <div style={{ marginTop: 64, padding: '36px 32px', background: 'linear-gradient(135deg, #f5f3ff, #eef9f4)', borderRadius: 16, border: '1px solid rgba(91,79,207,0.15)' }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            次のアクション
          </p>
          <p style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: 6, color: 'var(--text)' }}>
            この記事を読んで、気になりましたか？
          </p>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: '0.9rem' }}>
            あなたの目的に合わせて、最適な方法でFIに接触してください。
          </p>

          <div className="cta-triple">
            {/* CTA 1: 採用 */}
            <a
              id="cta-casual-interview"
              href="https://forms.gle/Vw1PBQefXRLvTw459"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-card cta-hire"
            >
              <span className="cta-card-icon">🤝</span>
              <span className="cta-card-title">カジュアル面談</span>
              <span className="cta-card-sub">選考なし・30分・一緒に働く話</span>
            </a>

            {/* CTA 2: 受託相談 */}
            <a
              id="cta-business-inquiry"
              href="mailto:ta-sato@futuristicimagination.co.jp?subject=AIパイプライン開発のご相談&body=FIの採用ブログを拝見しました。受託についてご相談したいです。"
              className="cta-card cta-biz"
            >
              <span className="cta-card-icon">💼</span>
              <span className="cta-card-title">受託相談</span>
              <span className="cta-card-sub">AIパイプライン・動画自動化</span>
            </a>

            {/* CTA 3: 会社情報 */}
            <a
              id="cta-company-info"
              href="https://www.futuristicimagination.co.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-card cta-doc"
            >
              <span className="cta-card-icon">🏢</span>
              <span className="cta-card-title">会社情報を見る</span>
              <span className="cta-card-sub">FI公式サイト・事業内容</span>
            </a>
          </div>
        </div>
      </article>
    </>
  );
}
