const REPO = 'dev-futuristicimagination/fi-recruit-blog';
const ARTICLES_PATH = 'content/articles';

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  readingTime: number;
  content: string;
}

interface GithubFile {
  name: string;
  download_url: string;
}

async function fetchFromGitHub(url: string): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    next: { revalidate: 300 }, // 5分キャッシュ
  });
}

function parseArticle(raw: string, filename: string): Article | null {
  try {
    // frontmatter を手動パース（gray-matterの依存を維持しつつフォールバック）
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!fmMatch) return null;
    const [, frontmatter, body] = fmMatch;

    const get = (key: string): string => {
      const m = frontmatter.match(new RegExp(`^${key}:\\s*"?([^"\\n]+)"?`, 'm'));
      return m ? m[1].trim() : '';
    };

    const slug = get('slug') || filename.replace('.md', '');
    const title = get('title');
    const excerpt = get('excerpt') || body.slice(0, 120).replace(/\n/g, ' ');
    const category = get('category') || '採用';
    const publishedAt = get('publishedAt').slice(0, 10);

    if (!slug || !title) return null;

    const wordCount = body.replace(/[#*`>]/g, '').length;
    return {
      slug,
      title,
      excerpt,
      category,
      publishedAt,
      readingTime: Math.max(1, Math.ceil(wordCount / 400)),
      content: body.trim(),
    };
  } catch {
    return null;
  }
}

export async function getAllArticles(): Promise<Article[]> {
  try {
    const res = await fetchFromGitHub(
      `https://api.github.com/repos/${REPO}/contents/${ARTICLES_PATH}`
    );
    if (!res.ok) return [];
    const files: GithubFile[] = await res.json();
    const mdFiles = files.filter(f => f.name.endsWith('.md'));

    const articles = await Promise.all(
      mdFiles.map(async (file) => {
        try {
          const r = await fetchFromGitHub(file.download_url);
          if (!r.ok) return null;
          const raw = await r.text();
          return parseArticle(raw, file.name);
        } catch {
          return null;
        }
      })
    );

    return (articles.filter(Boolean) as Article[])
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  } catch {
    return [];
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const articles = await getAllArticles();
  return articles.find(a => a.slug === slug) ?? null;
}
