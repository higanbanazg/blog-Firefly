import { getCollection } from "astro:content";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import {
	dynamicSearchText,
	dynamicSlug,
	sortDynamics,
} from "@/utils/dynamic-utils";

export interface DynamicImage {
	alt: string;
	src: string;
	title?: string;
}

export interface DynamicEntryData {
	id: string;
	published: number;
	html: string;
	images: DynamicImage[];
	searchText: string;
	pinned: boolean;
	location: string;
}

const markdownImagePattern = /!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g;

// 动态条目的唯一数据来源。
// 以前这段逻辑只长在 src/pages/api/dynamic.json.ts 里，页面必须先加载 JS
// 再 fetch 这个接口才能拿到内容，首屏只有一个转圈。现在抽成共享函数，
// /dynamic/ 页面在构建期直接调用它把条目渲进 HTML，接口本身保留不变
// （dynamicConfig.apiUrl 允许别人指向它，而且是对外的公开数据源）。
export async function getDynamicEntries(): Promise<DynamicEntryData[]> {
	const processor = await createMarkdownProcessor();
	const dynamics = sortDynamics(await getCollection("dynamic"));
	return Promise.all(
		dynamics.map(async (entry) => {
			const images: DynamicImage[] = [];
			const markdown = (entry.body || "").replace(
				markdownImagePattern,
				(_match, alt: string, src: string, title?: string) => {
					images.push({ alt, src, ...(title ? { title } : {}) });
					return "";
				},
			);
			const rendered = await processor.render(markdown);

			return {
				id: dynamicSlug(entry.id),
				published: entry.data.published.getTime(),
				html: rendered.code,
				images,
				searchText: dynamicSearchText(entry),
				pinned: entry.data.pinned || false,
				location: entry.data.location.trim(),
			};
		}),
	);
}
