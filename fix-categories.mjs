// カテゴリを正確に修正するスクリプト
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const articlesDir = path.join(__dirname, 'content', 'articles');

// 正確なカテゴリマッピング（タイトルキーワードベース）
const ACCURATE_CATEGORY_MAP = [
  { keywords: ['SES', '起業', 'SES出身'], category: '代表ストーリー' },
  { keywords: ['AIオウンドメディア自動化', 'オウンドメディア', '原点', '賭けた'], category: '代表ストーリー' },
  { keywords: ['執念', '価値観と哲学', '核心'], category: '代表ストーリー' },
  { keywords: ['11サイトを自動運営', '1人で11サイト', '非常識なAI活用'], category: '実績・事例' },
  { keywords: ['1億円', '1億', 'ビジネスモデル'], category: 'ビジョン' },
  { keywords: ['バイブコーディング', '1日。バイブ', '何を作っているか'], category: '開発文化' },
  { keywords: ['Gemini API', 'Gemini APIで', '記事生成パイプライン'], category: '技術ブログ' },
  { keywords: ['Next.js + Vercel', 'GitHub APIで作', '完全自動メディア'], category: '技術ブログ' },
  { keywords: ['完璧じゃなくていい', '動かせ', '開発哲学'], category: '開発文化' },
  { keywords: ['404エラーと6時間', '6時間格闘', '泥臭さ'], category: '開発文化' },
  { keywords: ['3日で立ち上げ', 'スピード感の秘密', 'スピード'], category: '実績・事例' },
  { keywords: ['バイブコーディングとは何か', '「ノリ」で開発'], category: '開発文化' },
  { keywords: ['Vercel Cron', 'Cronで完全自動化', '寝ている間に記事'], category: '技術ブログ' },
  { keywords: ['採用コンテンツをAI', '自社で実験'], category: '実績・事例' },
  { keywords: ['仕事を奪われる前に', 'AIを使う側', '奪われる'], category: '成長・キャリア' },
  { keywords: ['思考速度', 'スタートアップのエンジニアに求められる'], category: '成長・キャリア' },
  { keywords: ['泥臭く学ぶ力', '泥臭く学ぶ', '最も評価される理由'], category: '採用基準' },
  { keywords: ['フルリモート・フルフレックス', '時間の主人公'], category: '働き方' },
  { keywords: ['裁量があるか', '責任と自由'], category: '働き方' },
  { keywords: ['管理される', '苦手な人こそFI', '苦手な人'], category: '働き方' },
  { keywords: ['会議ゼロ', '報告書ゼロ', '非同期コミュニケーション'], category: '働き方' },
  { keywords: ['毎日6時間コード', '6時間コードを書く', '週6時間'], category: 'カルチャー' },
  { keywords: ['AIスタートアップで働く', '良いことも大変なことも', 'リアル'], category: 'カルチャー' },
  { keywords: ['最初の仲間が最も重要', '「今は1人」', '最初の仲間'], category: 'カルチャー' },
  { keywords: ['未経験からai', '未経験', '素養'], category: '成長・キャリア' },
];

function detectCategoryFromTitle(title) {
  const titleLower = title.toLowerCase();
  for (const { keywords, category } of ACCURATE_CATEGORY_MAP) {
    for (const kw of keywords) {
      if (title.includes(kw) || titleLower.includes(kw.toLowerCase())) {
        return category;
      }
    }
  }
  return null; // 判定不能
}

let fixed = 0;
const files = fs.readdirSync(articlesDir).filter(f => f.endsWith('.md'));

for (const filename of files) {
  const filepath = path.join(articlesDir, filename);
  const raw = fs.readFileSync(filepath, 'utf8');
  
  // タイトルを抽出
  const titleMatch = raw.match(/^title:\s*"?([^"\n]+)"?/m);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  // 現在のカテゴリ
  const catMatch = raw.match(/^category:\s*"?([^"\n]+)"?/m);
  const currentCat = catMatch ? catMatch[1].trim() : '';
  
  // タイトルからカテゴリを判定
  const correctCategory = detectCategoryFromTitle(title);
  
  console.log(`${filename}`);
  console.log(`  Title: ${title.slice(0, 50)}`);
  console.log(`  Current: ${currentCat} → Correct: ${correctCategory || '判定不能'}`);
  
  if (correctCategory && correctCategory !== currentCat) {
    const fixed_raw = raw.replace(
      /^category:\s*"?[^"\n]*"?/m,
      `category: "${correctCategory}"`
    );
    fs.writeFileSync(filepath, fixed_raw, 'utf8');
    console.log(`  ✅ Updated!`);
    fixed++;
  } else if (!correctCategory) {
    console.log(`  ⚠️  Cannot determine category`);
  } else {
    console.log(`  ⏭  Already correct`);
  }
  console.log('');
}

console.log(`\n完了: ${fixed}ファイル更新`);
