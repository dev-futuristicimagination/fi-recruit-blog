// 採用ブログ 一括記事生成スクリプト v2 - 固定トピックリスト方式
// 使用方法: node bulk-generate.mjs
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env.local を読み込む
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.+)$/);
    if (m) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const REPO = 'dev-futuristicimagination/fi-recruit-blog';

if (!GITHUB_TOKEN) { console.error('GITHUB_TOKEN not set'); process.exit(1); }
if (!GEMINI_KEY) { console.error('GEMINI_API_KEY not set'); process.exit(1); }

// ─── 正規トピックリスト（固定順序）────────────────────────────
const TOPICS = [
  { topic: 'SESからAIスタートアップへ。佐藤琢也の起業ストーリー', category: '代表ストーリー' },
  { topic: 'なぜ「AIオウンドメディア自動化」に賭けたのか。FIの原点', category: '代表ストーリー' },
  { topic: '「自動化への執念」が私の核心。佐藤琢也の価値観と哲学', category: '代表ストーリー' },
  { topic: '1人で11サイトを自動運営するまで。AIと過ごした1年間', category: '実績・事例' },
  { topic: 'FIが目指す「1人で1億円」の完全自動化ビジネスモデル', category: 'ビジョン' },
  { topic: 'FIエンジニアの1日。バイブコーディングで何を作っているか', category: '開発文化' },
  { topic: 'Gemini APIで記事生成パイプラインを0から作った話', category: '技術ブログ' },
  { topic: 'Next.js + Vercel + GitHub APIで作る完全自動メディアの全貌', category: '技術ブログ' },
  { topic: '「完璧じゃなくていい、動かせ」FIの開発哲学とその理由', category: '開発文化' },
  { topic: '404エラーと6時間格闘した話。スタートアップ開発の泥臭さ', category: '開発文化' },
  { topic: 'AIメディアを3日で立ち上げる。FIのスピード感の秘密', category: '実績・事例' },
  { topic: 'バイブコーディングとは何か？AIと「ノリ」で開発するとはどういうことか', category: '開発文化' },
  { topic: 'Vercel Cronで完全自動化。「寝ている間に記事が増える」仕組み', category: '技術ブログ' },
  { topic: '「採用コンテンツをAIで自動化する」を自社で実験している話', category: '実績・事例' },
  { topic: 'AIに仕事を奪われる前に、AIを使う側になる方法', category: '成長・キャリア' },
  { topic: 'スタートアップのエンジニアに求められる「思考速度」とは', category: '成長・キャリア' },
  { topic: '「泥臭く学ぶ力」がFIで最も評価される理由', category: '採用基準' },
  { topic: 'フルリモート・フルフレックス。時間の主人公として働くということ', category: '働き方' },
  { topic: '1人でどこまで裁量があるか。スタートアップの「責任と自由」', category: '働き方' },
  { topic: '「管理される」のが苦手な人こそFIに向いている理由', category: '働き方' },
  { topic: '会議ゼロ・報告書ゼロ。FIの非同期コミュニケーション文化', category: '働き方' },
  { topic: '代表が毎日6時間コードを書く会社。それがFIです', category: 'カルチャー' },
  { topic: 'AIスタートアップで働くリアル。良いことも大変なことも正直に', category: 'カルチャー' },
  { topic: '「今は1人」だからこそ、最初の仲間が最も重要な話', category: 'カルチャー' },
];

function toSlug(text) {
  return text.toLowerCase().replace(/[^\w\u3040-\u9fff]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

async function getExistingSlugs() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/content/articles`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) return new Set();
  const files = await res.json();
  return new Set(files.map(f => f.name.replace('.md', '')));
}

async function callGemini(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 4096 }
      })
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.candidates[0].content.parts[0].text.trim();
}

async function generateAndSave(topic, category, personaText, existingSlugs) {
  const slug = toSlug(topic);
  if (existingSlugs.has(slug)) {
    console.log(`⏭ SKIP: ${topic.slice(0, 40)}`);
    return false;
  }

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  const prompt = `あなたはFuturistic Imagination 代表・佐藤琢也として採用ブログ記事を書きます。

【ペルソナ・価値観】
${personaText}

【今日書く記事のトピック】
${topic}

【カテゴリ】${category}

【会社基本情報】
- 社名: Futuristic Imagination LLC（代表: 佐藤琢也）
- 元SES出身、AI自動化オタク、フルリモート・フルフレックス推進者
- 事業: AIオウンドメディア自動運営（11サイト）・Gemini APIパイプライン開発
- 特徴: バイブコーディング・週6時間以上コードを書く代表

【文章スタイル（必ず守ること）】
- 一人称「私」で等身大に書く
- 「正直に言うと〜」「実は〜」スタイルで本音ベース
- 大手採用ブログっぽい建前・きれいごとは一切不要
- 読んだ人が「この人と働きたい」と感じる温度感
- AIっぽい箇条書き連発・強調（**）は禁止

【出力形式】（コードブロック不要、以下の順序で出力）
TITLE: {40〜60文字のタイトル}
EXCERPT: {100〜120文字の概要文}
{2000〜2500文字の記事本文。見出しH2(##)を3〜4本}`;

  const rawText = (await callGemini(prompt))
    .replace(/^```(?:markdown)?\n?/, '').replace(/\n?```$/, '');

  const lines = rawText.split('\n');
  let title = topic.slice(0, 60);
  let excerpt = '';
  let bodyStart = 0;

  for (let i = 0; i < Math.min(6, lines.length); i++) {
    if (lines[i].startsWith('TITLE:')) { title = lines[i].replace('TITLE:', '').trim(); bodyStart = i + 1; }
    else if (lines[i].startsWith('EXCERPT:')) { excerpt = lines[i].replace('EXCERPT:', '').trim(); bodyStart = i + 1; }
  }

  const body = lines.slice(bodyStart).join('\n').trim();
  if (!excerpt) excerpt = body.replace(/^#+.+\n/gm, '').trim().slice(0, 120).replace(/\n/g, ' ');

  const content = `---\nslug: "${slug}"\ntitle: "${title}"\nexcerpt: "${excerpt}"\ncategory: "${category}"\npublishedAt: "${today}"\n---\n\n${body}`;

  const filename = `${slug}.md`;
  const putRes = await fetch(
    `https://api.github.com/repos/${REPO}/contents/content/articles/${encodeURIComponent(filename)}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `feat: add recruit article "${slug}"`,
        content: Buffer.from(content).toString('base64'),
        committer: { name: 'FI Recruit Bot', email: 'ta-sato@futuristicimagination.co.jp' },
      }),
    }
  );

  if (!putRes.ok) {
    console.error(`❌ GitHub save failed: ${putRes.status} - ${(await putRes.text()).slice(0, 150)}`);
    return false;
  }

  existingSlugs.add(slug);
  console.log(`✅ [${category}] ${title}`);
  return true;
}

async function main() {
  console.log('🚀 FI採用ブログ 一括生成 v2 開始\n');

  const personaText = fs.readFileSync(
    path.join(__dirname, '..', 'satotaku-agent', 'persona.md'), 'utf8'
  ).slice(0, 1200);

  const existingSlugs = await getExistingSlugs();
  console.log(`📚 既存記事数: ${existingSlugs.size}\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const { topic, category } of TOPICS) {
    try {
      const ok = await generateAndSave(topic, category, personaText, existingSlugs);
      if (ok) { created++; await new Promise(r => setTimeout(r, 6000)); }
      else skipped++;
    } catch (e) {
      console.error(`❌ Error for "${topic.slice(0, 30)}": ${e.message.slice(0, 100)}`);
      failed++;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  console.log(`\n🎉 完了: 生成${created} / スキップ${skipped} / 失敗${failed}`);
}

main().catch(console.error);
