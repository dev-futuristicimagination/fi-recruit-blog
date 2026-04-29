/**
 * /api/generate-dev-blog
 * 毎週木曜 10:00 JST — AI開発実績を採用向けブログ記事に自動変換
 */
import { NextResponse } from 'next/server';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

async function notifyDiscord(msg: string) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (url) await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:msg})}).catch(()=>{});
}

const DEV_BLOG_TOPICS = [
  '18サイト自動運用を支える記事品質Wチェックシステムの設計',
  'Next.js Cron + GitHub API で作るゼロ手動コンテンツパイプライン',
  'Gemini APIで記事生成→文字化け検出→自動修正まで全自動化した話',
  'JSON-LD スキーマ自動注入でSEO評価を改善した実装レポート',
  'Vercel Cron と Discord Webhook で作る運用監視ダッシュボード',
  '10言語同時展開の多言語メディア自動運用アーキテクチャ解説',
  'E-E-A-T対応の著者バイオ自動挿入で全記事品質を底上げした話',
];

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== 'Bearer '+process.env.CRON_SECRET) return NextResponse.json({error:'Unauthorized'},{status:401});

  const geminiKey = process.env.GEMINI_API_KEY || '';
  const ghToken = process.env.RECRUIT_GITHUB_TOKEN || '';
  if (!geminiKey || !ghToken) return NextResponse.json({error:'missing env'},{status:500});

  // Rotate topics by week number
  const weekNum = Math.floor(Date.now() / (7*24*3600*1000));
  const topic = DEV_BLOG_TOPICS[weekNum % DEV_BLOG_TOPICS.length];
  const today = new Date(Date.now()+9*3600000).toISOString().split('T')[0];

  const prompt = `あなたはFuturistic Imagination LLCのシニアエンジニアです。
採用候補者（エンジニア志望）に向けた技術ブログ記事を書いてください。

テーマ: ${topic}

要件:
- 技術的に正確で具体的な内容
- 「なぜこの設計にしたか」という意思決定プロセスを含める
- コードスニペットを最低1箇所
- 読者に「この会社で働きたい」と思わせる内容
- 末尾に「Futuristic Imagination LLCでは一緒に働くエンジニアを募集中」CTAを追加
- URL: https://recruit.futuristicimagination.co.jp/
- 1500文字以上、Markdownで出力`;

  const gemRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig:{temperature:0.7,maxOutputTokens:3000}}) });
  const gd = await gemRes.json() as {candidates?:{content:{parts:{text:string}[]}}[]};
  const body = gd.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!body || body.length < 400) return NextResponse.json({error:'generation failed'},{status:500});

  const titleMatch = body.match(/^#s+(.+)$/m);
  const title = titleMatch?.[1] || topic;
  const slug = today+'-dev-blog-'+String(weekNum%DEV_BLOG_TOPICS.length);

  const frontMatter = `---
title: '${title}'
slug: ${slug}
publishedAt: '${today}T10:00:00+09:00'
category: '開発ブログ'
excerpt: '${body.replace(/[#*`]/g,'').slice(0,120)}...'
---

`;
  const finalContent = frontMatter + body;

  // Save to fi-recruit-blog
  const savePath = `content/articles/${slug}.md`;
  const ex = await fetch(`https://api.github.com/repos/dev-futuristicimagination/fi-recruit-blog/contents/${savePath}?ref=master`,
    {headers:{Authorization:'token '+ghToken,Accept:'application/vnd.github+json'}});
  const exD = ex.ok ? await ex.json() as {sha?:string} : {};
  const putB: Record<string,unknown> = { message:'feat: auto dev-blog '+slug, content:Buffer.from(finalContent,'utf8').toString('base64'), committer:{name:'Dev Blog Bot',email:'ta-sato@futuristicimagination.co.jp'} };
  if (exD.sha) putB.sha = exD.sha;
  const saveRes = await fetch(`https://api.github.com/repos/dev-futuristicimagination/fi-recruit-blog/contents/${savePath}`,
    {method:'PUT',headers:{Authorization:'token '+ghToken,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify(putB)});
  if (!saveRes.ok) return NextResponse.json({error:'save failed'},{status:500});

  await notifyDiscord(`✅ 採用ブログ記事生成完了\n📄 ${title}\nhttps://recruit.futuristicimagination.co.jp/blog/${slug}`);
  return NextResponse.json({ok:true, slug, title});
}
