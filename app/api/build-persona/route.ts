import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) return NextResponse.json({ error: 'GITHUB_TOKEN not set' }, { status: 500 });

  // ── 1. session_log.md + conversation_summaries.md を satotaku-agent から取得 ──
  const fetchFile = async (filename: string): Promise<string> => {
    const res = await fetch(
      `https://api.github.com/repos/dev-futuristicimagination/satotaku-agent/contents/${filename}`,
      { headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return '';
    const data = await res.json() as { content: string };
    return Buffer.from(data.content, 'base64').toString('utf8');
  };

  const [sessionLog, conversationSummaries] = await Promise.all([
    fetchFile('session_log.md'),
    fetchFile('conversation_summaries.md'),
  ]);

  if (!sessionLog) {
    return NextResponse.json({ error: 'Failed to fetch session_log' }, { status: 500 });
  }

  // 直近3,000文字（session_log）+ 全文（conversation_summaries）
  const recentLog = sessionLog.slice(-3000);

  // ── 2. Geminiでペルソナ抽出 ──────────────────────────────────────────
  const genAI = new GoogleGenerativeAI(geminiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const personaPrompt = `以下はFuturistic Imagination LLC 代表・佐藤琢也の実際の作業ログと会話サマリーです。
これらを分析して、佐藤琢也という人物のペルソナプロファイルを作成してください。

【絶対に含めてはいけない情報】
- APIキー・環境変数・Webhook URL・認証情報
- 具体的な売上・収益・報酬の数字
- クライアント名・顧客固有情報
- 他社・他者への批判的内容

【抽出してほしい情報】
- 仕事スタイル（判断の速さ・進め方・こだわり）
- 価値観・大切にしていること
- 得意分野・実際に作ったもの（技術・プロジェクト名）
- 口癖・言い回し・思考の傾向
- ビジョン・目指していること
- どんな人物像か（採用候補者が「この人と働きたい」と感じる要素）

【出力形式】Markdown形式。採用候補者や取引先が読んで「この人はこういう人だ」とわかるように書いてください。

---作業ログ（直近）---
${recentLog}

---全エージェントとの会話サマリー---
${conversationSummaries.slice(0, 2000)}`;


  const result = await model.generateContent(personaPrompt);
  const personaContent = `# 佐藤琢也 ペルソナプロファイル

> 自動生成日: ${new Date(Date.now() + 9*60*60*1000).toISOString().split('T')[0]}
> このファイルはsession_log.mdをもとにGeminiが自動生成します。

---

${result.response.text().trim()}
`;

  // ── 3. persona.md を satotaku-agent に保存 ────────────────────────────
  const existingRes = await fetch(
    'https://api.github.com/repos/dev-futuristicimagination/satotaku-agent/contents/persona.md',
    { headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json' } }
  );
  const existingData = existingRes.ok ? await existingRes.json() as { sha: string } : null;

  const saveBody: Record<string, unknown> = {
    message: `chore: auto-update persona.md from session_log`,
    content: Buffer.from(personaContent).toString('base64'),
    committer: { name: 'satotaku-agent bot', email: 'ta-sato@futuristicimagination.co.jp' },
  };
  if (existingData?.sha) saveBody.sha = existingData.sha;

  const saveRes = await fetch(
    'https://api.github.com/repos/dev-futuristicimagination/satotaku-agent/contents/persona.md',
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(saveBody),
    }
  );
  if (!saveRes.ok) {
    return NextResponse.json({ error: `Failed to save persona: ${saveRes.status}` }, { status: 500 });
  }

  // ── 4. Discord通知 ────────────────────────────────────────────────────
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (webhook) {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '✅ satotaku-agent ペルソナ更新完了',
          color: 0x6366f1,
          description: 'session_log.mdをもとにpersona.mdを自動生成しました。',
          footer: { text: 'fi-recruit-blog / build-persona cron' },
          timestamp: new Date().toISOString(),
        }],
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, message: 'persona.md updated in satotaku-agent' });
}
