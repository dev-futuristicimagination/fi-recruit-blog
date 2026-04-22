import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 300;

function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^\w\u3040-\u9fff]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function getExistingSlugs(token: string): Promise<Set<string>> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/dev-futuristicimagination/fi-recruit-blog/contents/content/articles',
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' }
    );
    if (!res.ok) return new Set();
    const files = await res.json() as Array<{ name: string }>;
    return new Set(files.map(f => f.name.replace('.md', '')));
  } catch { return new Set(); }
}

export async function POST(req: NextRequest) {
  // 簡易トークン認証（本番では削除）
  const reqBody = await req.json() as { topic: string; category: string; token?: string };
  if (reqBody.token !== 'bulk2025') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { topic, category } = reqBody;
  if (!topic || !category) return NextResponse.json({ error: 'topic and category required' }, { status: 400 });

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) return NextResponse.json({ error: 'GITHUB_TOKEN not set' }, { status: 500 });

  const slug = toSlug(topic);
  const existingSlugs = await getExistingSlugs(githubToken);
  if (existingSlugs.has(slug)) {
    return NextResponse.json({ skipped: true, slug });
  }

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  // persona取得
  let personaText = '元SES出身、AI自動化オタク、フルリモート・フルフレックス推進者、1人で11サイト自動運営';
  try {
    const pRes = await fetch(
      'https://api.github.com/repos/dev-futuristicimagination/satotaku-agent/contents/persona.md',
      { headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' }
    );
    if (pRes.ok) {
      const d = await pRes.json() as { content: string };
      personaText = Buffer.from(d.content, 'base64').toString('utf8').slice(0, 1000);
    }
  } catch { /* fallback */ }

  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `あなたはFuturistic Imagination 代表・佐藤琢也として採用ブログ記事を書きます。

【ペルソナ・価値観】
${personaText}

【今日書く記事】
トピック: ${topic}
カテゴリ: ${category}

【会社基本情報】
- 社名: Futuristic Imagination LLC（代表: 佐藤琢也）
- 元SES出身、AI自動化オタク、フルリモート・フルフレックス推進者
- 事業: AIオウンドメディア自動運営（11サイト）・Gemini APIパイプライン開発
- 週6時間以上コードを書く代表

【スタイル】
- 一人称「私」で等身大に書く
- 「正直に言うと〜」「実は〜」スタイルで本音ベース
- 大手採用ブログの建前・きれいごとは一切不要
- AIっぽい箇条書き連発・強調（**）は禁止

【出力形式】（コードブロック不要）
TITLE: {40〜60文字のタイトル}
EXCERPT: {100〜120文字の概要文}
{2000〜2500文字の記事本文。見出しH2(##)を3〜4本}`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim()
    .replace(/^```(?:markdown)?\n?/, '').replace(/\n?```$/, '');

  const lines = rawText.split('\n');
  let title = topic.slice(0, 60);
  let excerpt = '';
  let bodyStart = 0;

  for (let i = 0; i < Math.min(6, lines.length); i++) {
    if (lines[i].startsWith('TITLE:')) { title = lines[i].replace('TITLE:', '').trim(); bodyStart = i + 1; }
    else if (lines[i].startsWith('EXCERPT:')) { excerpt = lines[i].replace('EXCERPT:', '').trim(); bodyStart = i + 1; }
  }

  const articleBody = lines.slice(bodyStart).join('\n').trim();
  if (!excerpt) excerpt = articleBody.replace(/^#+.+\n/gm, '').trim().slice(0, 120).replace(/\n/g, ' ');

  const content = `---\nslug: "${slug}"\ntitle: "${title}"\nexcerpt: "${excerpt}"\ncategory: "${category}"\npublishedAt: "${today}"\n---\n\n${articleBody}`;

  const saveRes = await fetch(
    `https://api.github.com/repos/dev-futuristicimagination/fi-recruit-blog/contents/content/articles/${encodeURIComponent(`${slug}.md`)}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `feat: add recruit article "${slug}"`,
        content: Buffer.from(content).toString('base64'),
        committer: { name: 'FI Recruit Bot', email: 'ta-sato@futuristicimagination.co.jp' },
      }),
    }
  );

  if (!saveRes.ok) {
    const err = await saveRes.text();
    return NextResponse.json({ error: `GitHub save failed: ${saveRes.status}`, detail: err.slice(0, 200) }, { status: 500 });
  }

  return NextResponse.json({ success: true, slug, title, category });
}
