import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      // content/articles/*.md をserverless functionバンドルに含める
      // → dynamicParams=trueでの動的記事ルートが正常動作する
      '/blog/[slug]': ['./content/**/*'],
    },
  },
};

export default nextConfig;
