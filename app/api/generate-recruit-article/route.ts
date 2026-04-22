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
  { topic: 'SESからAIスタートアップへ。佐藤卓也の転職エピソード', category: '代表ストーリー' },
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

  // Generate
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const prompt = `あなたはFuturistic Imagination（futuristicimagination.co.jp）の広報担当です。
採用候補者に「この会社で働いてみたい」と思わせる採用ブログ記事を書いてください。

【トピック】${cfg.topic}
【カテゴリ】${cfg.category}
【会社情報】
- 社名: Futuristic Imagination LLC
- 代表: 佐藤卓也（元SES→AI起業）
- 事業: AIオウンドメディア構築・Gemini APIパイプライン開発受託
- 特徴: バイブコーディング・フルリモート・1人で11サイト自動運営

【文章スタイル】
- 一人称で、等身大に書く（「私たちは〜」よりも「正直に言うと〜」スタイル）
- 大手っぽい建前は一切不要。本音ベースで
- 採用担当者が書いたのではなく、代表やエンジニアが書いた雰囲気

【構成】2,000〜2,500文字
- 共感できる書き出し（問いかけ・エピソード）
- H2×3〜4本の本文
- まとめ（カジュアル面談への誘い）

【Front Matter（このまま出力）】
---
slug: "${slug}"
title: "{40〜60文字のタイトル}"
excerpt: "{100〜120文字の概要}"
category: "${cfg.category}"
publishedAt: "${today}"
---

Front Matterから始めて、Markdown形式で出力してください。コードブロックで囲まないでください。`;

  const result = await model.generateContent(prompt);
  let content = result.response.text().trim()
    .replace(/^```(?:markdown)?\n/, '').replace(/\n```$/, '');

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
