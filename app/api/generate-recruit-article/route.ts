import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 300;

// ─── 採用ブログの黄金テーマ全カバー ───────────────────────────────
const TOPICS = [
  // 📌 会社・代表を知る
  { topic: 'SESからAIスタートアップへ。佐藤琢也の起業ストーリー', category: '代表ストーリー' },
  { topic: 'なぜ「AIオウンドメディア自動化」に賭けたのか。FIの原点', category: '代表ストーリー' },
  { topic: '副業からフリーランス、そして起業。FIが歩んできた道', category: '代表ストーリー' },
  { topic: '「自動化への執念」が私の核心。佐藤琢也の価値観と哲学', category: '代表ストーリー' },
  { topic: '1人で11サイトを自動運営するまで。AIと過ごした1年間', category: '実績・事例' },
  { topic: 'FIが目指す「1人で1億円」の完全自動化ビジネスモデル', category: 'ビジョン' },

  // 💼 仕事の中身を知る
  { topic: 'FIエンジニアの1日。バイブコーディングで何を作っているか', category: '開発文化' },
  { topic: 'Gemini APIで記事生成パイプラインを0から作った話', category: '技術ブログ' },
  { topic: 'Next.js + Vercel + GitHub APIで作る完全自動メディアの全貌', category: '技術ブログ' },
  { topic: '「完璧じゃなくていい、動かせ」FIの開発哲学とその理由', category: '開発文化' },
  { topic: '404エラーと6時間格闘した話。スタートアップ開発の泥臭さ', category: '開発文化' },
  { topic: 'TypeScript Strict Modeにこだわる理由。品質と速度の両立', category: '技術ブログ' },
  { topic: 'AIメディアを3日で立ち上げる。FIのスピード感の秘密', category: '実績・事例' },
  { topic: '失敗したシステムの話。それでも諦めなかった理由', category: '開発文化' },
  { topic: 'バイブコーディングとは何か？AIと「ノリ」で開発するとはどういうことか', category: '開発文化' },
  { topic: 'Vercel Cronで完全自動化。「寝ている間に記事が増える」仕組み', category: '技術ブログ' },
  { topic: '「採用コンテンツをAIで自動化する」を自社で実験している話', category: '実績・事例' },

  // 🌱 成長できるか確認する
  { topic: '未経験からAI開発者になれるか？FIが本当に求める「素養」', category: '採用基準' },
  { topic: 'FIで3ヶ月働いたら何が身につくか。正直に書く', category: '成長・キャリア' },
  { topic: 'AIに仕事を奪われる前に、AIを使う側になる方法', category: '成長・キャリア' },
  { topic: 'スタートアップのエンジニアに求められる「思考速度」とは', category: '成長・キャリア' },
  { topic: '「泥臭く学ぶ力」がFIで最も評価される理由', category: '採用基準' },

  // 💰 条件・環境を知る
  { topic: 'フルリモート・フルフレックス。時間の主人公として働くということ', category: '働き方' },
  { topic: 'FIの報酬・契約形態について正直に話す', category: '働き方' },
  { topic: '1人でどこまで裁量があるか。スタートアップの「責任と自由」', category: '働き方' },
  { topic: '「管理される」のが苦手な人こそFIに向いている理由', category: '働き方' },
  { topic: '会議ゼロ・報告書ゼロ。FIの非同期コミュニケーション文化', category: '働き方' },

  // 🤝 一緒に働く人を知る
  { topic: '代表が毎日6時間コードを書く会社。それがFIです', category: 'カルチャー' },
  { topic: 'AIスタートアップで働くリアル。良いことも大変なことも正直に', category: 'カルチャー' },
  { topic: '「今は1人」だからこそ、最初の仲間が最も重要な話', category: 'カルチャー' },
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

  // 既存記事のslugを取得
  const existingSlugs = await getExistingSlugs(githubToken);

  // 未使用トピックを絞り込む
  const unused = TOPICS.filter(t => !existingSlugs.has(toSlug(t.topic)));

  // クエリパラメータで固定トピック指定（一括生成用）
  const url = new URL(req.url);
  const forcedTopic = url.searchParams.get('topic');
  const forcedCategory = url.searchParams.get('category');

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];

  // ─── persona + session_log を取得 ────────────────────────────
  let personaText = '';
  let sessionLogText = '';

  try {
    const personaRes = await fetch(
      'https://api.github.com/repos/dev-futuristicimagination/satotaku-agent/contents/persona.md',
      { headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' }
    );
    if (personaRes.ok) {
      const d = await personaRes.json() as { content: string };
      personaText = Buffer.from(d.content, 'base64').toString('utf8').slice(0, 1500);
    }
  } catch { /* 取得失敗時はスキップ */ }

  try {
    const logRes = await fetch(
      'https://api.github.com/repos/dev-futuristicimagination/satotaku-agent/contents/session_log.md',
      { headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' }, cache: 'no-store' }
    );
    if (logRes.ok) {
      const d = await logRes.json() as { content: string };
      sessionLogText = Buffer.from(d.content, 'base64').toString('utf8').slice(0, 2000);
    }
  } catch { /* 取得失敗時はスキップ */ }

  // ─── Geminiでトピック選定 ─────────────────────────────────────
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const unusedList = unused.map((t, i) => `${i + 1}. [${t.category}] ${t.topic}`).join('\n');
  const categoryCount = getCategoryCount(existingSlugs);

  const topicPrompt = `あなたはFuturistic Imagination（FI）の採用ブログ編集長です。

【今日の日付】${today}
【最近の佐藤琢也の活動ログ】
${sessionLogText || '（取得できませんでした）'}

【未投稿のトピック候補】
${unusedList || '（すべて投稿済み）'}

【各カテゴリの投稿数】
${JSON.stringify(categoryCount)}

以下のルールで「今日書く記事のトピックとカテゴリ」を1つ選んでください：
1. 活動ログに採用ブログとして書けるネタがあれば、それを優先してオリジナルトピックを作る
2. ない場合は未投稿候補から投稿数の少ないカテゴリを優先して選ぶ
3. 出力は必ず以下のJSON形式のみ（他のテキスト不要）:
{"topic": "...", "category": "...", "source": "activity"|"list"}`;

  let cfg: { topic: string; category: string; source?: string } =
    unused.length > 0 ? unused[Math.floor(Math.random() * unused.length)] : TOPICS[0];

  // クエリパラメータ指定時は動的選択をスキップ
  if (forcedTopic && forcedCategory) {
    cfg = { topic: forcedTopic, category: forcedCategory, source: 'forced' };
  } else {
    // ─── Geminiでトピック選定 ───────────────────────────────────
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const unusedList = unused.map((t, i) => `${i + 1}. [${t.category}] ${t.topic}`).join('\n');
    const categoryCount = getCategoryCount(existingSlugs);
    const topicPrompt = `あなたはFuturistic Imagination（FI）の採用ブログ編集長です。
【今日の日付】${today}
【最近の佐藤琢也の活動ログ】${sessionLogText || '（取得できませんでした）'}
【未投稿のトピック候補】${unusedList || '（すべて投稿済み）'}
【各カテゴリの投稿数】${JSON.stringify(categoryCount)}
ルール: 未投稿候補から投稿数の少ないカテゴリを優先して選ぶ（活動ログは参考程度）。
出力は必ず以下のJSON形式のみ: {"topic": "...", "category": "...", "source": "list"}`;
    try {
      const topicResult = await model.generateContent(topicPrompt);
      const raw = topicResult.response.text().trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(raw) as { topic: string; category: string; source: string };
      if (parsed.topic && parsed.category) cfg = parsed;
    } catch { /* パース失敗時はデフォルト維持 */ }
  }

  const slug = toSlug(cfg.topic);

  // 既に存在するslugならスキップ
  if (existingSlugs.has(slug)) {
    return NextResponse.json({ message: `Already exists: ${slug}` });
  }

  // ─── 記事生成 ─────────────────────────────────────────────────
  const articlePrompt = `あなたはFuturistic Imagination 代表・佐藤琢也として採用ブログ記事を書きます。
採用候補者に「この会社で働いてみたい」と思わせる記事を、本人の言葉で書いてください。

【ペルソナ（このトーン・価値観で書く）】
${personaText || '元SES出身、AI自動化オタク、本音ベースで語る、フルリモート・フルフレックス推進者'}

【今日のトピック】${cfg.topic}
【カテゴリ】${cfg.category}
【会社基本情報】
- 社名: Futuristic Imagination LLC
- 代表: 佐藤琢也（元SES→AI起業）
- 事業: AIオウンドメディア構築・Gemini APIパイプライン開発受託
- 特徴: バイブコーディング・フルリモート・1人で11サイト自動運営

【文章スタイル】
- 一人称「私」で、等身大に書く
- 「正直に言うと〜」「実は〜」スタイルで本音ベース
- 大手採用ブログっぽい建前は一切不要
- 読んだ人が「この人と働きたい」と感じる温度感

【出力形式】（この順で出力、コードブロック不要）
TITLE: {40〜60文字のタイトル}
EXCERPT: {100〜120文字の概要}
{2000〜2500文字の記事本文。見出しはH2（##）を3〜4本}`;

  const result = await model.generateContent(articlePrompt);
  const rawText = result.response.text().trim()
    .replace(/^```(?:markdown)?\n/, '').replace(/\n```$/, '');

  const lines = rawText.split('\n');
  let title = cfg.topic.slice(0, 60);
  let excerpt = '';
  let bodyStart = 0;

  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].startsWith('TITLE:')) { title = lines[i].replace('TITLE:', '').trim(); bodyStart = i + 1; }
    else if (lines[i].startsWith('EXCERPT:')) { excerpt = lines[i].replace('EXCERPT:', '').trim(); bodyStart = i + 1; }
  }

  const body = lines.slice(bodyStart).join('\n').trim();
  if (!excerpt) excerpt = body.replace(/^#+.+\n/gm, '').trim().slice(0, 120).replace(/\n/g, ' ');

  const content = `---\nslug: "${slug}"\ntitle: "${title}"\nexcerpt: "${excerpt}"\ncategory: "${cfg.category}"\npublishedAt: "${today}"\n---\n\n${body}`;

  // ─── GitHub に保存 ─────────────────────────────────────────────
  const filename = `${slug}.md`;
  const githubUrl = `https://api.github.com/repos/dev-futuristicimagination/fi-recruit-blog/contents/content/articles/${filename}`;
  const saveRes = await fetch(githubUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
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

  // Deploy Hook
  const deployHook = process.env.VERCEL_DEPLOY_HOOK;
  if (deployHook) await fetch(deployHook, { method: 'POST' }).catch(() => {});

  // Discord
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (webhook) {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{ title: '✅ FI採用ブログ 記事生成完了', color: 0x6366f1,
          description: `**${title}**`,
          fields: [
            { name: 'カテゴリ', value: cfg.category, inline: true },
            { name: 'ソース', value: (cfg as { source?: string }).source === 'activity' ? '📋 活動ログから' : '📋 固定リストから', inline: true },
          ],
          footer: { text: 'fi-recruit-blog cron' }, timestamp: new Date().toISOString() }],
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, slug, title, category: cfg.category });
}

function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^\w\u3040-\u9fff]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

function getCategoryCount(slugs: Set<string>): Record<string, number> {
  const counts: Record<string, number> = {};
  TOPICS.forEach(t => { counts[t.category] = (counts[t.category] || 0); });
  // 簡易カウント（実際は記事frontmatterを読む必要があるが、slugから推定）
  return counts;
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
