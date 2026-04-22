import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 300;

const TOPICS = [
  { topic: 'バイブコーディングとは何か？AIと「ノリ」で開発するFIの文化', category: '開発文化' },
  { topic: '1人で11サイトを自動運営する話 — AIと1ヶ月でやったこと', category: '実績・事例' },
  { topic: 'フルリモート・フルフレックス。時間の主人公として働く', category: '働き方' },
  { topic: 'AIスタートアップで働くリアル — 良いことも大変なことも', category: 'カルチャー' },
  { topic: '未経験からAI開発者になれるか？FIが求める「素養」の話', category: '採用基準' },
  { topic: 'Gemini APIで記事生成パイプラインを作った話', category: '技術ブログ' },
  { topic: 'スタートアップのエンジニアに求められる「思考速度」とは', category: 'カルチャー' },
  { topic: '「採用コンテンツをAIで自動化する」を自社実験している話', category: '実績・事例' },
  { topic: 'FIが目指す「1人で1億円」の完全自動化ビジネスモデル', category: 'ビジョン' },
  { topic: 'Next.js + Vercel + GitHub APIで作る無人メディアの全貌', category: '技術ブログ' },
  { topic: 'AIに仕事を奪われる前に、AIを使う側になる方法', category: 'キャリア' },
  { topic: 'SESからAIスタートアップへ。佐藤琢也の転職エピソード', category: '代表ストーリー' },
  { topic: '副業からフリーランス、そして起業。FIの歩み', category: '代表ストーリー' },
  { topic: '「完璧じゃなくていい、動かせ」FIの開発哲学', category: '開発文化' },
  { topic: 'AIメディアを3日で立ち上げる — FIのスピード感の秘密', category: '実績・事例' },
];

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) return NextResponse.json({ error: 'GITHUB_TOKEN not set' }, { status: 500 });

  // Pick unused topic
  const existingSlugs = await getExistingSlugs(githubToken);
  const unused = TOPICS.filter(t => {
    const slug = toSlug(t.topic);
    return !existingSlugs.has(slug);
  });
  if (unused.length === 0) return NextResponse.json({ message: 'All topics used' });

  const cfg = unused[Math.floor(Math.random() * unused.length)];
  const slug = toSlug(cfg.topic);
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  // persona.md を satotaku-agent から取得
  let personaContext = '';
  try {
    const personaRes = await fetch(
      'https://api.github.com/repos/dev-futuristicimagination/satotaku-agent/contents/persona.md',
      { headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' } }
    );
    if (personaRes.ok) {
      const personaData = await personaRes.json() as { content: string };
      const raw = Buffer.from(personaData.content, 'base64').toString('utf8');
      personaContext = `\n\n【佐藤琢也のペルソナ情報（このトーン・価値観で書く）】\n${raw.slice(0, 1500)}`;
    }
  } catch { /* persona取得失敗時はデフォルトで続行 */ }

  // Generate article body only (frontmatterはプログラム側で構築)
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `あなたはFuturistic Imagination 代表・佐藤琢也として採用ブログ記事を書きます。
採用候補者に「この会社で働いてみたい」と思わせる記事を、本人の言葉で書いてください。${personaContext}

【トピック】${cfg.topic}
【カテゴリ】${cfg.category}
【会社基本情報】
- 社名: Futuristic Imagination LLC
- 代表: 佐藤琢也（元SES→AI起業）
- 事業: AIオウンドメディア構築・Gemini APIパイプライン開発受託
- 特徴: バイブコーディング・フルリモート・1人で11サイト自動運営

【文章スタイル】
- 一人称「私」で、等身大に書く
- 「正直に言うと〜」「実は〜」スタイルで本音ベース
- 大手企業の採用ブログっぽい建前は一切不要
- 上のペルソナ情報に基づいた口調・価値観で書く

【出力形式】
- 最初の1行目に「TITLE:」で始まるタイトル（40〜60文字）
- 2行目に「EXCERPT:」で始まる概要（100〜120文字）
- 3行目以降に記事本文（2,000〜2,500文字）
- 構成: 共感できる書き出し → H2×3〜4本 → まとめ（カジュアル面談への誘い）
- コードブロックや---で囲まないこと`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim()
    .replace(/^```(?:markdown)?\n/, '').replace(/\n```$/, '');

  // タイトルと概要をパース
  const lines = rawText.split('\n');
  let title = cfg.topic.slice(0, 60);
  let excerpt = '';
  let bodyStart = 0;

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].startsWith('TITLE:')) {
      title = lines[i].replace('TITLE:', '').trim();
      bodyStart = i + 1;
    } else if (lines[i].startsWith('EXCERPT:')) {
      excerpt = lines[i].replace('EXCERPT:', '').trim();
      bodyStart = i + 1;
    }
  }

  const body = lines.slice(bodyStart).join('\n').trim();
  if (!excerpt) {
    excerpt = body.replace(/^#+.+\n/gm, '').trim().slice(0, 120).replace(/\n/g, ' ');
  }

  // frontmatterをプログラム側で確実に構築（Gemini出力に依存しない）
  const content = `---
slug: "${slug}"
title: "${title}"
excerpt: "${excerpt}"
category: "${cfg.category}"
publishedAt: "${today}"
---

${body}`;

  // Save to GitHub
  const filename = `${slug}.md`;
  const url = `https://api.github.com/repos/dev-futuristicimagination/fi-recruit-blog/contents/content/articles/${filename}`;
  const saveRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `feat: add recruit article "${slug}"`,
      content: Buffer.from(content).toString('base64'),
      committer: { name: 'FI Recruit Bot', email: 'ta-sato@futuristicimagination.co.jp' },
    }),
  });

  if (!saveRes.ok) {
    const err = await saveRes.text();
    return NextResponse.json({ error: `GitHub save failed: ${saveRes.status}`, detail: err.slice(0, 200) }, { status: 500 });
  }

  // Trigger redeploy
  const deployHook = process.env.VERCEL_DEPLOY_HOOK;
  if (deployHook) await fetch(deployHook, { method: 'POST' }).catch(() => {});

  // Discord notification
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (webhook) {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '✅ FI採用ブログ 記事生成完了',
          color: 0x6366f1,
          description: `**${cfg.topic}**`,
          fields: [
            { name: 'カテゴリ', value: cfg.category, inline: true },
            { name: 'Slug', value: slug, inline: true },
          ],
          footer: { text: 'fi-recruit-blog cron' },
          timestamp: new Date().toISOString(),
        }],
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, slug, topic: cfg.topic });
}

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u3040-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function getExistingSlugs(token: string): Promise<Set<string>> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/dev-futuristicimagination/fi-recruit-blog/contents/content/articles',
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return new Set();
    const files = await res.json() as Array<{ name: string }>;
    return new Set(files.map(f => f.name.replace('.md', '')));
  } catch { return new Set(); }
}
