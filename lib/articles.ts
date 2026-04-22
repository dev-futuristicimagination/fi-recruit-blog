import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  readingTime: number;
  content: string;
}

const ARTICLES_DIR = path.join(process.cwd(), 'content', 'articles');

export async function getAllArticles(): Promise<Article[]> {
  if (!fs.existsSync(ARTICLES_DIR)) return [];
  const files = fs.readdirSync(ARTICLES_DIR).filter(f => f.endsWith('.md'));
  const articles = files.map(file => {
    try {
      const raw = fs.readFileSync(path.join(ARTICLES_DIR, file), 'utf8');
      const { data, content } = matter(raw);
      if (!data.slug || !data.title) return null;
      const wordCount = content.replace(/[#*`>]/g, '').length;
      return {
        slug: data.slug as string,
        title: data.title as string,
        excerpt: (data.excerpt || content.slice(0, 120).replace(/\n/g, ' ')) as string,
        category: (data.category || '採用') as string,
        publishedAt: data.publishedAt ? String(data.publishedAt).slice(0, 10) : '',
        readingTime: Math.max(1, Math.ceil(wordCount / 400)),
        content,
      } satisfies Article;
    } catch { return null; }
  }).filter(Boolean) as Article[];

  return articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const articles = await getAllArticles();
  return articles.find(a => a.slug === slug) ?? null;
}
