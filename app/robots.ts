import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/api/article-batch', '/api/generate-recruit-article'],
      },
    ],
    sitemap: 'https://recruit.futuristicimagination.co.jp/sitemap.xml',
  };
}
