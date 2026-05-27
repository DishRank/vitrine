/**
 * Diagnostic-only : surface what Bing Image Search actually serves us
 * from the Vercel datacenter IP. The cloud IP gets a different (often
 * degraded) HTML compared to residential IPs, which is why our scraper
 * regex misses everything.
 *
 * Call : GET /api/debug/bing-img?q=tacos+time+lyon
 * Returns : JSON with status, content-type, html length, marker flags,
 * and a head sample so we can see the real shape.
 *
 * Remove or gate this route once we've finished tuning the scraper.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || 'tacos time lyon restaurant';
  const target = `https://www.bing.com/images/search?q=${encodeURIComponent(q)}&form=HDRSC2&first=1`;
  const res = await fetch(target, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  });
  const html = await res.text();
  return NextResponse.json({
    query: q,
    target,
    status: res.status,
    contentType: res.headers.get('content-type'),
    finalUrl: res.url,
    htmlLength: html.length,
    markers: {
      hasIusc: /\biusc\b/.test(html),
      hasMurl: /"murl"/.test(html),
      hasMediaurl: /mediaurl=/i.test(html),
      hasImgurl: /imgurl=/i.test(html),
      hasOgImage: /og:image/.test(html),
      hasCaptcha: /captcha|challenge|are you a human/i.test(html),
      mediaurlCount: (html.match(/mediaurl=/gi) || []).length,
      anchorCount: (html.match(/<a\s/gi) || []).length,
      imgCount: (html.match(/<img\s/gi) || []).length,
    },
    htmlHead: html.slice(0, 3000),
    firstMediaurlAnchor: (html.match(/<a[^>]*mediaurl=[^>]{0,400}/i) || [null])[0],
  });
}
