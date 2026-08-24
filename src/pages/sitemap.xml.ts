import type { APIRoute } from "astro";

/**
 * /sitemap.xml → 301 → /sitemap-index.xml
 *
 * @astrojs/sitemap 产出的索引文件叫 sitemap-index.xml，robots.txt 里也是这么声明的。
 * 但不少爬虫（包括 Cloudflare AI Crawl Control 面板里统计到的那批）会按惯例先直接
 * 探 /sitemap.xml，之前一律吃 404。这里做一次永久跳转，把它们导到真正的索引上。
 *
 * 必须 prerender = false：静态预渲染的端点只会把 Response 的 body 写成文件，
 * 状态码和 Location 头都会丢掉，结果反而是一个空的 sitemap.xml，比 404 更糟。
 */
export const prerender = false;

export const GET: APIRoute = () => {
	return new Response(null, {
		status: 301,
		headers: {
			Location: new URL("sitemap-index.xml", import.meta.env.SITE).href,
			"Cache-Control": "public, max-age=86400",
		},
	});
};
