import type { APIRoute } from "astro";

/**
 * 不再 Disallow /_astro/：Astro 把打包后的 CSS/JS 和经过图片管线优化的文章配图
 * 全放在这个目录下。屏蔽它会让 Googlebot 抓不到渲染页面所需的样式和脚本
 * （Google 明确不建议屏蔽 CSS/JS），文章配图也进不了图片搜索。
 */
const robotsTxt = `
User-agent: *
Allow: /

Sitemap: ${new URL("sitemap-index.xml", import.meta.env.SITE).href}
`.trim();

export const GET: APIRoute = () => {
	return new Response(robotsTxt, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
