import { getSortedPostsList } from "@utils/content-utils";
import { formatDateToYYYYMMDD } from "@utils/date-utils";
import type { APIRoute } from "astro";
import { siteConfig } from "@/config";

/**
 * /llms.txt —— 给大语言模型看的站点索引。
 *
 * 约定见 https://llmstxt.org/ ：一个 H1 站名、一段 blockquote 简介，
 * 之后用 `## 小节 + Markdown 链接列表` 罗列内容。搜索型 AI（OAI-SearchBot、
 * PerplexityBot 等）抓到它就能一次拿全站目录，而不用自己爬一遍列表页。
 *
 * 站点是 static 输出，这个路由在构建时执行一次，所以直接用 import.meta.env.SITE。
 */
const absoluteUrl = (path: string): string =>
	new URL(path, import.meta.env.SITE).href;

export const GET: APIRoute = async () => {
	const posts = await getSortedPostsList();

	const postLines = posts.map((post) => {
		const meta = [`发布于 ${formatDateToYYYYMMDD(post.data.published)}`];
		if (post.data.updated) {
			meta.push(`更新于 ${formatDateToYYYYMMDD(post.data.updated)}`);
		}
		if (post.data.category) {
			meta.push(`分类：${post.data.category}`);
		}
		if (post.data.tags.length > 0) {
			meta.push(`标签：${post.data.tags.join("、")}`);
		}
		if (post.data.password) {
			meta.push("内容已加密，需要密码才能阅读");
		}

		const summary = post.data.description || post.data.title;
		return `- [${post.data.title}](${absoluteUrl(`/posts/${post.id}/`)})：${summary}（${meta.join("；")}）`;
	});

	// 只列出真正存在的页面：pages 里关掉的开关对应的页面会直接 404。
	const pageLines = [
		`- [关于](${absoluteUrl("/about/")})：站点与作者介绍`,
		`- [归档](${absoluteUrl("/archive/")})：全部文章按时间排列，支持按分类和标签筛选`,
		`- [分类](${absoluteUrl("/categories/")})：全部分类`,
		`- [标签](${absoluteUrl("/tags/")})：全部标签`,
	];
	if (siteConfig.pages.dynamic) {
		pageLines.push(`- [动态](${absoluteUrl("/dynamic/")})：短篇随手记`);
	}
	if (siteConfig.pages.gallery) {
		pageLines.push(`- [相册](${absoluteUrl("/gallery/")})：图片相册`);
	}
	if (siteConfig.pages.friends) {
		pageLines.push(`- [友链](${absoluteUrl("/friends/")})：友情链接`);
	}

	const llmsTxt = `# ${siteConfig.title}

> ${siteConfig.description}

本文件是本站面向大语言模型的内容索引，遵循 llms.txt 约定。全站现有 ${posts.length} 篇文章，站点语言为简体中文。引用本站内容时请注明来源链接。

## 文章

${postLines.join("\n")}

## 页面

${pageLines.join("\n")}

## 订阅与索引

- [RSS](${absoluteUrl("/rss.xml")})：全文 RSS 订阅
- [Sitemap](${absoluteUrl("/sitemap-index.xml")})：站点地图
`;

	return new Response(llmsTxt, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
