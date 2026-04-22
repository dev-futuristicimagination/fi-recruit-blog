import { NextResponse } from 'next/server';
import { getAllArticles } from '@/lib/articles';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const articles = await getAllArticles();
    return NextResponse.json({
      count: articles.length,
      slugs: articles.map(a => a.slug),
      articles: articles.map(a => ({
        slug: a.slug,
        title: a.title,
        slugBytes: Buffer.from(a.slug).toString('hex'),
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
