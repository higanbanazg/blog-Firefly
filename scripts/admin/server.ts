// 本地内容后台 —— pnpm admin
//
// 起一个只监听 127.0.0.1 的小服务，在浏览器里增删改「文章 / 动态 / 友链」，
// 直接读写仓库里的源文件，最后一键 git 提交推送触发 Cloudflare 部署。
//
// 为什么是独立脚本而不是 Astro 路由：
//   1. 站点部署在 Cloudflare Workers，Workers 运行时没有 fs。后台要是长在
//      src/pages/ 下就会被打进产线包，构建直接失败；放在 scripts/ 下对构建
//      零影响，也绝不可能被公网访问到。
//   2. 正文用原生 textarea 存「原始 Markdown」，一个字符都不重新序列化。
//      本项目有 15 个自定义 remark/rehype 插件（Mermaid、PlantUML、KaTeX、
//      wiki 链接、提醒框……），任何富文本编辑器都会把这些语法解析成自己的
//      AST 再吐回来，必然改坏。
//
// 安全：只绑 127.0.0.1（外网和局域网都进不来）；所有接口要求带上启动时随机
// 生成的 token，并校验 Origin，防止别的网页在你浏览器里偷偷 POST 到本机。

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { pinyin } from "pinyin-pro";
import sharp from "sharp";
import { siteConfig } from "../../src/config/siteConfig";
import type { AdSlot } from "../../src/types/sidebarConfig";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const POSTS_DIR = path.join(ROOT, "src", "content", "posts");
const POST_IMAGES_DIR = path.join(POSTS_DIR, "images");
const DYNAMIC_DIR = path.join(ROOT, "src", "content", "dynamic");
// 动态的图片必须放 public/：src/utils/dynamic-data.ts 把正文里的 ![alt](src)
// 抽出来，src 原样塞进 <img src>，不经过 Astro 图片优化，所以只有以 / 开头的
// 站内绝对路径或外链才显示得出来。
// 目录名不能叫 public/dynamic —— 那会和 /dynamic/ 页面路由撞车。
const DYNAMIC_IMAGES_DIR = path.join(ROOT, "public", "dynamic-images");
const FRIENDS_JSON = path.join(ROOT, "src", "config", "friends.json");
const ADS_JSON = path.join(ROOT, "src", "config", "ads.json");
// 广告图和动态图一样要走 public/，不经过 Astro 优化——广告素材经常是动图，
// 而且换图比换文章勤，不值得为它触发图片重新编译。
// 目录名故意不叫 ads/banner/promo：uBlock 这类拦截器的规则直接按路径里的
// 这些词命中，图会被读者的浏览器拦掉，而你本地一切正常，根本查不出来。
const AD_IMAGES_DIR = path.join(ROOT, "public", "slot-images");
const UI_HTML = path.join(HERE, "ui.html");
const UI_JS = path.join(HERE, "ui.js");

const PORT = Number(process.env.ADMIN_PORT || 4322);
const BIND = "127.0.0.1";
const TOKEN = randomUUID();
const MAX_BODY = 32 * 1024 * 1024;
const ALLOWED_ORIGINS = new Set([
	`http://127.0.0.1:${PORT}`,
	`http://localhost:${PORT}`,
]);

/* ---------------------------------- YAML ---------------------------------- */

// 这些字符出现在标量开头会被 YAML 当成语法记号，必须加引号。
const YAML_UNSAFE_START = /^[-?:,[\]{}#&*!|>'"%@`]/;
const YAML_RESERVED = /^(?:true|false|null|yes|no|on|off|~)$/i;

function needsQuote(value: string): boolean {
	if (value === "") return true;
	if (value !== value.trim()) return true;
	if (value.includes("\n")) return true;
	if (YAML_UNSAFE_START.test(value)) return true;
	// ": " 会被解析成键值分隔，" #" 会被当成行内注释的起点。
	if (value.includes(": ") || value.includes(" #")) return true;
	if (YAML_RESERVED.test(value)) return true;
	// 纯数字裸写会被解析成 number，标题写成 "2026" 时会出问题。
	if (!Number.isNaN(Number(value))) return true;
	return false;
}

// JSON 的双引号转义规则和 YAML 双引号标量兼容，直接借用。
function yamlQuoted(value: string): string {
	return JSON.stringify(value);
}

function yamlAuto(value: string): string {
	return needsQuote(value) ? JSON.stringify(value) : value;
}

// tags 用行内流式写法 [a, b, c]，和现有文章保持一致。
function yamlFlowList(items: string[]): string {
	const parts = items.map((item) => {
		const s = item.trim();
		return needsQuote(s) || /[,[\]{}]/.test(s) ? JSON.stringify(s) : s;
	});
	return `[${parts.join(", ")}]`;
}

/* ---------------------------------- 时间 ---------------------------------- */

function tzParts(now: Date): Record<string, string> {
	const parts: Record<string, string> = {};
	for (const part of new Intl.DateTimeFormat("en-CA", {
		timeZone: siteConfig.timezone || "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(now)) {
		if (part.type !== "literal") parts[part.type] = part.value;
	}
	return parts;
}

// 和 scripts/new-dynamic.js 的逻辑保持一致，注意必须带时区偏移量：
// content.config.ts 里 published 是 z.date()，YAML 解析不带偏移量的
// "2026-08-20 17:09:41" 时按 UTC 处理，页面再转回 Asia/Shanghai 显示，
// 结果每条动态都会比实际写的时间晚 8 小时。
function isoWithOffset(now: Date): string {
	const p = tzParts(now);
	const label =
		new Intl.DateTimeFormat("en-US", {
			timeZone: siteConfig.timezone || "Asia/Shanghai",
			timeZoneName: "longOffset",
		})
			.formatToParts(now)
			.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
	const offset = label.replace(/^GMT/, "") || "+00:00";
	return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${offset}`;
}

function todayLocal(): string {
	const p = tzParts(new Date());
	return `${p.year}-${p.month}-${p.day}`;
}

function stampFileName(now: Date): string {
	const p = tzParts(now);
	return `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}${p.second}.md`;
}

/* ---------------------------------- 工具 ---------------------------------- */

// 中文转拼音，其余字符原样保留，规则对齐 scripts/new-post.js。
function toSlug(input: string): string {
	const parts: string[] = [];
	let buf = "";
	for (const ch of [...input.trim()]) {
		if (/[一-鿿]/.test(ch)) {
			if (buf) {
				parts.push(buf);
				buf = "";
			}
			parts.push(pinyin(ch, { toneType: "none", type: "array" })[0]);
		} else {
			buf += ch;
		}
	}
	if (buf) parts.push(buf);
	return parts
		.join("-")
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
}

function insideDir(base: string, target: string): boolean {
	const rel = path.relative(base, target);
	return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function safeFileName(name: string): string {
	const base = path.basename(name).replace(/[^\w.\-一-鿿]/g, "-");
	return base.replace(/^[.-]+/, "") || "file";
}

function uniquePath(dir: string, fileName: string): string {
	const ext = path.extname(fileName);
	const stem = path.basename(fileName, ext);
	let candidate = path.join(dir, fileName);
	let n = 1;
	while (fs.existsSync(candidate)) {
		candidate = path.join(dir, `${stem}-${n}${ext}`);
		n += 1;
	}
	return candidate;
}

function walkMarkdown(dir: string): string[] {
	if (!fs.existsSync(dir)) return [];
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name === "images") continue;
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walkMarkdown(full));
		else if (/\.(md|mdx)$/i.test(entry.name)) out.push(full);
	}
	return out;
}

function asString(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return String(value);
}

function asDateOnly(value: unknown): string {
	// gray-matter 解析出的 Date 是 UTC 零点，取 UTC 日期部分才不会偏一天。
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	const matched = asString(value).match(/^(\d{4}-\d{2}-\d{2})/);
	return matched ? matched[1] : asString(value);
}

function asIsoStamp(value: unknown): string {
	if (value instanceof Date) return value.toISOString();
	return asString(value);
}

/* -------------------------------- 文章读写 -------------------------------- */

type PostPayload = {
	slug: string;
	originalSlug: string;
	title: string;
	published: string;
	updated: string;
	description: string;
	image: string;
	tags: string[];
	category: string;
	draft: boolean;
	lang: string;
	pinned: boolean;
	author: string;
	sourceLink: string;
	licenseName: string;
	licenseUrl: string;
	comment: boolean;
	password: string;
	passwordHint: string;
	body: string;
};

// 字段顺序对齐现有文章：前 7 个总是写出，其余只在非默认值时才写，
// 免得每篇文章都拖着一串空字符串。
function buildPostFrontmatter(fm: PostPayload): string {
	const lines: string[] = [];
	lines.push(`title: ${yamlAuto(fm.title)}`);
	lines.push(`published: ${fm.published}`);
	if (fm.updated) lines.push(`updated: ${fm.updated}`);
	lines.push(`description: ${yamlQuoted(fm.description)}`);
	lines.push(`image: ${yamlQuoted(fm.image)}`);
	lines.push(`tags: ${yamlFlowList(fm.tags)}`);
	lines.push(`category: ${yamlQuoted(fm.category)}`);
	lines.push(`draft: ${fm.draft}`);
	if (fm.lang) lines.push(`lang: ${yamlQuoted(fm.lang)}`);
	if (fm.pinned) lines.push("pinned: true");
	if (fm.author) lines.push(`author: ${yamlQuoted(fm.author)}`);
	if (fm.sourceLink) lines.push(`sourceLink: ${yamlQuoted(fm.sourceLink)}`);
	if (fm.licenseName) lines.push(`licenseName: ${yamlQuoted(fm.licenseName)}`);
	if (fm.licenseUrl) lines.push(`licenseUrl: ${yamlQuoted(fm.licenseUrl)}`);
	if (fm.comment === false) lines.push("comment: false");
	if (fm.password) lines.push(`password: ${yamlQuoted(fm.password)}`);
	if (fm.passwordHint) {
		lines.push(`passwordHint: ${yamlQuoted(fm.passwordHint)}`);
	}
	return `---\n${lines.join("\n")}\n---\n`;
}

type PostSummary = {
	slug: string;
	file: string;
	title: string;
	published: string;
	draft: boolean;
	pinned: boolean;
	category: string;
	tags: string[];
	words: number;
};

function listPosts(): PostSummary[] {
	return walkMarkdown(POSTS_DIR)
		.map((file) => {
			const parsed = matter(fs.readFileSync(file, "utf8"));
			const rel = path.relative(POSTS_DIR, file).replace(/\\/g, "/");
			const d = parsed.data as Record<string, unknown>;
			return {
				slug: rel.replace(/\.(md|mdx)$/i, ""),
				file: rel,
				title: asString(d.title),
				published: asDateOnly(d.published),
				draft: d.draft === true,
				pinned: d.pinned === true,
				category: asString(d.category),
				tags: Array.isArray(d.tags) ? d.tags.map(asString) : [],
				words: parsed.content.replace(/\s+/g, "").length,
			};
		})
		.sort((a, b) => (a.published < b.published ? 1 : -1));
}

function readPost(slug: string): PostPayload {
	const md = path.join(POSTS_DIR, `${slug}.md`);
	const mdx = path.join(POSTS_DIR, `${slug}.mdx`);
	const target = fs.existsSync(md) ? md : mdx;
	if (!insideDir(POSTS_DIR, target) || !fs.existsSync(target)) {
		throw new Error(`文章不存在：${slug}`);
	}
	const parsed = matter(fs.readFileSync(target, "utf8"));
	const d = parsed.data as Record<string, unknown>;
	return {
		slug,
		originalSlug: slug,
		title: asString(d.title),
		published: asDateOnly(d.published) || todayLocal(),
		updated: d.updated ? asDateOnly(d.updated) : "",
		description: asString(d.description),
		image: asString(d.image),
		tags: Array.isArray(d.tags) ? d.tags.map(asString) : [],
		category: asString(d.category),
		draft: d.draft === true,
		lang: asString(d.lang),
		pinned: d.pinned === true,
		author: asString(d.author),
		sourceLink: asString(d.sourceLink),
		licenseName: asString(d.licenseName),
		licenseUrl: asString(d.licenseUrl),
		comment: d.comment !== false,
		password: asString(d.password),
		passwordHint: asString(d.passwordHint),
		body: parsed.content.replace(/^\n+/, ""),
	};
}

function savePost(payload: PostPayload): { slug: string; file: string } {
	const slug = (payload.slug || toSlug(payload.title)).trim();
	if (!slug) throw new Error("缺少 slug（文件名），也无法从标题推导");
	if (!payload.title.trim()) throw new Error("标题不能为空");
	if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.published)) {
		throw new Error("发布日期格式必须是 YYYY-MM-DD");
	}
	const target = path.join(POSTS_DIR, `${slug}.md`);
	if (!insideDir(POSTS_DIR, target)) throw new Error("非法的 slug 路径");

	const original = (payload.originalSlug || "").trim();
	const isRename = original !== "" && original !== slug;
	if ((original === "" || isRename) && fs.existsSync(target)) {
		throw new Error(`已存在同名文件：${slug}.md`);
	}

	fs.mkdirSync(path.dirname(target), { recursive: true });
	const body = payload.body.replace(/\s+$/, "");
	fs.writeFileSync(
		target,
		`${buildPostFrontmatter(payload)}\n${body}\n`,
		"utf8",
	);

	if (isRename) {
		for (const ext of [".md", ".mdx"]) {
			const old = path.join(POSTS_DIR, `${original}${ext}`);
			if (insideDir(POSTS_DIR, old) && fs.existsSync(old)) fs.rmSync(old);
		}
	}
	return { slug, file: path.relative(ROOT, target).replace(/\\/g, "/") };
}

function deletePost(slug: string): { removed: number } {
	let removed = 0;
	for (const ext of [".md", ".mdx"]) {
		const file = path.join(POSTS_DIR, `${slug}${ext}`);
		if (insideDir(POSTS_DIR, file) && fs.existsSync(file)) {
			fs.rmSync(file);
			removed += 1;
		}
	}
	if (removed === 0) throw new Error(`文章不存在：${slug}`);
	return { removed };
}

/* -------------------------------- 动态读写 -------------------------------- */

type DynamicPayload = {
	file: string;
	published: string;
	pinned: boolean;
	location: string;
	body: string;
};

type DynamicSummary = {
	file: string;
	published: string;
	pinned: boolean;
	location: string;
	excerpt: string;
};

function listDynamics(): DynamicSummary[] {
	if (!fs.existsSync(DYNAMIC_DIR)) return [];
	return fs
		.readdirSync(DYNAMIC_DIR)
		.filter((name) => name.endsWith(".md"))
		.map((name) => {
			const raw = fs.readFileSync(path.join(DYNAMIC_DIR, name), "utf8");
			const parsed = matter(raw);
			const d = parsed.data as Record<string, unknown>;
			const text = parsed.content.trim();
			return {
				file: name,
				published: asIsoStamp(d.published),
				pinned: d.pinned === true,
				location: asString(d.location),
				excerpt: text.length > 60 ? `${text.slice(0, 60)}…` : text,
			};
		})
		.sort((a, b) => (a.published < b.published ? 1 : -1));
}

function readDynamic(file: string): DynamicPayload {
	const target = path.join(DYNAMIC_DIR, path.basename(file));
	if (!insideDir(DYNAMIC_DIR, target) || !fs.existsSync(target)) {
		throw new Error(`动态不存在：${file}`);
	}
	const raw = fs.readFileSync(target, "utf8");
	const parsed = matter(raw);
	const d = parsed.data as Record<string, unknown>;
	// published 原样回填，不经 Date 往返，否则时区偏移量会丢。
	const stamp = raw.match(/^published:\s*(.+)$/m);
	return {
		file: path.basename(target),
		published: stamp ? stamp[1].trim() : asIsoStamp(d.published),
		pinned: d.pinned === true,
		location: asString(d.location),
		body: parsed.content.replace(/^\n+/, "").replace(/\s+$/, ""),
	};
}

function saveDynamic(payload: DynamicPayload): { file: string } {
	const body = payload.body.trim();
	if (!body) throw new Error("动态内容不能为空");

	const isNew = !payload.file;
	const now = new Date();
	const published = payload.published?.trim() || isoWithOffset(now);
	const name = isNew ? stampFileName(now) : path.basename(payload.file);
	const target = path.join(DYNAMIC_DIR, name);
	if (!insideDir(DYNAMIC_DIR, target)) throw new Error("非法的动态文件名");
	if (isNew && fs.existsSync(target)) {
		throw new Error(`已存在同名文件：${name}`);
	}

	const lines = [`published: ${published}`];
	if (payload.pinned) lines.push("pinned: true");
	if (payload.location?.trim()) {
		lines.push(`location: ${yamlQuoted(payload.location.trim())}`);
	}

	fs.mkdirSync(DYNAMIC_DIR, { recursive: true });
	fs.writeFileSync(
		target,
		`---\n${lines.join("\n")}\n---\n\n${body}\n`,
		"utf8",
	);
	return { file: name };
}

function deleteDynamic(file: string): { removed: number } {
	const target = path.join(DYNAMIC_DIR, path.basename(file));
	if (!insideDir(DYNAMIC_DIR, target) || !fs.existsSync(target)) {
		throw new Error(`动态不存在：${file}`);
	}
	fs.rmSync(target);
	return { removed: 1 };
}

/* -------------------------------- 友链读写 -------------------------------- */

type FriendPayload = {
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string[];
	weight: number;
	enabled: boolean;
};

function readFriends(): FriendPayload[] {
	if (!fs.existsSync(FRIENDS_JSON)) return [];
	return JSON.parse(fs.readFileSync(FRIENDS_JSON, "utf8")) as FriendPayload[];
}

// 按 Biome 的 JSON 风格逐字段拼，而不是 JSON.stringify(x, null, "\t")。
// 后者会把 "tags": ["Blog"] 拆成三行，Biome 却要求短数组保持单行——于是每存
// 一次友链都多出一个假 diff，跑一次 pnpm lint 又被改回去，来回抖。
// 友链就固定这七个字段，写死比模拟 Biome 的折行算法省事得多。
// （tags 长到超过行宽时 Biome 仍会折行，但友链标签都很短，真遇上跑 lint 即可。）
function serializeFriends(list: FriendPayload[]): string {
	if (list.length === 0) return "[]\n";
	const items = list.map((f) => {
		const lines = [
			`\t\t"title": ${JSON.stringify(f.title)},`,
			`\t\t"imgurl": ${JSON.stringify(f.imgurl)},`,
			`\t\t"desc": ${JSON.stringify(f.desc)},`,
			`\t\t"siteurl": ${JSON.stringify(f.siteurl)},`,
			`\t\t"tags": ${JSON.stringify(f.tags)},`,
			`\t\t"weight": ${f.weight},`,
			`\t\t"enabled": ${f.enabled}`,
		];
		return `\t{\n${lines.join("\n")}\n\t}`;
	});
	return `[\n${items.join(",\n")}\n]\n`;
}

function saveFriends(list: FriendPayload[]): { count: number } {
	if (!Array.isArray(list)) throw new Error("友链数据必须是数组");
	const cleaned = list.map((f, i) => {
		if (!f.title?.trim()) throw new Error(`第 ${i + 1} 条友链缺少站名`);
		if (!f.siteurl?.trim()) throw new Error(`第 ${i + 1} 条友链缺少站点地址`);
		return {
			title: f.title.trim(),
			imgurl: (f.imgurl || "").trim(),
			desc: (f.desc || "").trim(),
			siteurl: f.siteurl.trim(),
			tags: Array.isArray(f.tags)
				? f.tags.map((t) => String(t).trim()).filter(Boolean)
				: [],
			weight: Number.isFinite(Number(f.weight)) ? Number(f.weight) : 0,
			enabled: f.enabled !== false,
		};
	});
	fs.writeFileSync(FRIENDS_JSON, serializeFriends(cleaned));
	return { count: cleaned.length };
}

/* ---------------------------------- 广告 ---------------------------------- */

// 广告数据和友链一样单独放 JSON，理由见 CLAUDE.md：sidebarConfig.ts 是带满行
// 注释的嵌套 TS 字面量，脚本解析再拼回来很容易改坏，而它还管着侧边栏其它所有
// 组件。ads.json 里存的是扁平字段，翻译成主题原本那个 AdConfig 的活儿在
// src/config/sidebarConfig.ts 里做，广告组件本身没动过。
const AD_SIDES = new Set<AdSlot["side"]>(["left", "right", "mobile"]);

function readAds(): AdSlot[] {
	if (!fs.existsSync(ADS_JSON)) return [];
	return JSON.parse(fs.readFileSync(ADS_JSON, "utf8")) as AdSlot[];
}

// 逐字段拼的理由同 serializeFriends：JSON.stringify 的折行和 Biome 对不上。
function serializeAds(list: AdSlot[]): string {
	if (list.length === 0) return "[]\n";
	const items = list.map((a) => {
		const lines = [
			`\t\t"note": ${JSON.stringify(a.note)},`,
			`\t\t"enabled": ${a.enabled},`,
			`\t\t"side": ${JSON.stringify(a.side)},`,
			`\t\t"position": ${JSON.stringify(a.position)},`,
			`\t\t"showTitle": ${a.showTitle},`,
			`\t\t"title": ${JSON.stringify(a.title)},`,
			`\t\t"content": ${JSON.stringify(a.content)},`,
			`\t\t"imgSrc": ${JSON.stringify(a.imgSrc)},`,
			`\t\t"imgAlt": ${JSON.stringify(a.imgAlt)},`,
			`\t\t"imgLink": ${JSON.stringify(a.imgLink)},`,
			`\t\t"linkText": ${JSON.stringify(a.linkText)},`,
			`\t\t"linkUrl": ${JSON.stringify(a.linkUrl)},`,
			`\t\t"closable": ${a.closable},`,
			`\t\t"fullBleed": ${a.fullBleed}`,
		];
		return `\t{\n${lines.join("\n")}\n\t}`;
	});
	return `[\n${items.join(",\n")}\n]\n`;
}

function saveAds(list: AdSlot[]): { count: number; enabled: number } {
	if (!Array.isArray(list)) throw new Error("广告数据必须是数组");
	const cleaned = list.map((a, i) => {
		const ad: AdSlot = {
			note: (a.note || "").trim(),
			enabled: a.enabled === true,
			side: AD_SIDES.has(a.side) ? a.side : "right",
			position: a.position === "sticky" ? "sticky" : "top",
			showTitle: a.showTitle === true,
			title: (a.title || "").trim(),
			content: (a.content || "").trim(),
			imgSrc: (a.imgSrc || "").trim(),
			imgAlt: (a.imgAlt || "").trim(),
			imgLink: (a.imgLink || "").trim(),
			linkText: (a.linkText || "").trim(),
			linkUrl: (a.linkUrl || "").trim(),
			closable: a.closable !== false,
			fullBleed: a.fullBleed === true,
		};
		// 只卡已上线的那几条。标题、文案、图片全空会渲染成一张空卡片挂在侧边栏
		// 上；但没上线的广告压根不会出现在页面里，草稿写一半就存很正常，不拦。
		const n = i + 1;
		if (ad.enabled) {
			if (!ad.title && !ad.content && !ad.imgSrc) {
				throw new Error(`第 ${n} 条广告已上线，但标题、文案、图片全是空的`);
			}
			if (ad.showTitle && !ad.title) {
				throw new Error(`第 ${n} 条广告勾了显示标题，但标题是空的`);
			}
			if (ad.linkText && !ad.linkUrl) {
				throw new Error(`第 ${n} 条广告填了按钮文字，但没填按钮链接`);
			}
			if (ad.linkUrl && !ad.linkText) {
				throw new Error(`第 ${n} 条广告填了按钮链接，但没填按钮文字`);
			}
		}
		return ad;
	});
	fs.writeFileSync(ADS_JSON, serializeAds(cleaned));
	return {
		count: cleaned.length,
		enabled: cleaned.filter((a) => a.enabled).length,
	};
}

/* ---------------------------------- 图片 ---------------------------------- */

type UploadPayload = {
	kind: string;
	slug: string;
	dir?: string;
	filename: string;
	data: string;
};

type UploadResult = {
	markdown: string;
	rawBytes: number;
	outBytes: number;
	converted: boolean;
};

// 粘进来的截图动辄几百 KB PNG，而站上现有的图全是 AVIF（那 81 张平均 31 KB），
// 所以统一转一道再落盘。三类不碰：
//   gif  —— sharp 默认只取第一帧，转完动图就死了
//   svg  —— 矢量转位图等于作废
//   avif —— 已经是目标格式，再编一次纯粹是有损叠有损
const KEEP_AS_IS = new Set([".gif", ".svg", ".avif"]);
const MAX_IMAGE_WIDTH = 1600;

async function encodeUpload(
	raw: Buffer,
	name: string,
): Promise<{ bytes: Buffer; name: string; converted: boolean }> {
	const rawExt = path.extname(name);
	if (KEEP_AS_IS.has(rawExt.toLowerCase())) {
		return { bytes: raw, name, converted: false };
	}
	try {
		const out = await sharp(raw)
			// 手机照片的方向记在 EXIF 里，得先烤进像素再编码，否则会躺倒
			.rotate()
			.resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
			.avif({ quality: 60 })
			.toBuffer();
		// 本来就压得很狠的小图，转 AVIF 反而更大，那就留原图
		if (out.length >= raw.length) return { bytes: raw, name, converted: false };
		return {
			bytes: out,
			name: `${path.basename(name, rawExt)}.avif`,
			converted: true,
		};
	} catch {
		// 编码失败（罕见格式、文件损坏）不该让整个上传挂掉，退回原图
		return { bytes: raw, name, converted: false };
	}
}

async function uploadImage(payload: UploadPayload): Promise<UploadResult> {
	const raw = Buffer.from(payload.data.split(",").pop() || "", "base64");
	if (raw.length === 0) throw new Error("图片内容为空");
	const enc = await encodeUpload(raw, safeFileName(payload.filename));

	if (payload.kind === "post") {
		// dir 由前端决定：新文章跟着 slug 走，老文章沿用正文里已经在用的那个
		// 目录——比如 3x-ui-vless-reality 这篇，slug 和图片目录 3x-ui 本来就
		// 不一样，按 slug 推会凭空多出个新文件夹。
		const sub = toSlug(payload.dir || payload.slug || "") || "misc";
		const dir = path.join(POST_IMAGES_DIR, sub);
		if (!insideDir(POST_IMAGES_DIR, dir)) throw new Error("非法的图片目录");
		fs.mkdirSync(dir, { recursive: true });
		const target = uniquePath(dir, enc.name);
		fs.writeFileSync(target, enc.bytes);
		// 文章正文用相对路径，这样 Astro 才会接手做优化压缩。
		return {
			markdown: `./images/${sub}/${path.basename(target)}`,
			rawBytes: raw.length,
			outBytes: enc.bytes.length,
			converted: enc.converted,
		};
	}

	if (payload.kind === "ad") {
		fs.mkdirSync(AD_IMAGES_DIR, { recursive: true });
		const target = uniquePath(AD_IMAGES_DIR, enc.name);
		fs.writeFileSync(target, enc.bytes);
		return {
			markdown: `/slot-images/${path.basename(target)}`,
			rawBytes: raw.length,
			outBytes: enc.bytes.length,
			converted: enc.converted,
		};
	}

	fs.mkdirSync(DYNAMIC_IMAGES_DIR, { recursive: true });
	const target = uniquePath(DYNAMIC_IMAGES_DIR, enc.name);
	fs.writeFileSync(target, enc.bytes);
	// 动态的图不过 Astro 优化，必须是站内绝对路径。
	return {
		markdown: `/dynamic-images/${path.basename(target)}`,
		rawBytes: raw.length,
		outBytes: enc.bytes.length,
		converted: enc.converted,
	};
}

/* ----------------------------------- Git ---------------------------------- */

function git(args: string[]): { ok: boolean; out: string } {
	const r = spawnSync("git", args, {
		cwd: ROOT,
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
	});
	return {
		ok: r.status === 0,
		out: `${r.stdout || ""}${r.stderr || ""}`.trim(),
	};
}

// 只提交内容相关的路径，不用 git add -A，免得把仓库里其它半成品改动一起带上线。
const CONTENT_PATHS = [
	"src/content",
	"src/config/friends.json",
	"src/config/ads.json",
	"public/dynamic-images",
	"public/slot-images",
];

// git add 的 pathspec 只要有一个匹配不上，整条命令就 fatal 退出，一个文件都不
// 会被暂存。public/dynamic-images 要等第一次上传动态配图才会出现，在那之前发
// 布任何东西都会被它带崩——报的还是 "did not match any files"，跟你改的内容毫
// 无关系，很难往这上面想。所以先把 git 根本匹配不到的路径筛掉。
// 不能只看磁盘：目录被整个删空时它已从工作区消失，但这个删除本身还得提交，
// 所以再问一次 git ls-files，只要索引里还有记录就保留。
function resolvedContentPaths(): string[] {
	return CONTENT_PATHS.filter(
		(p) =>
			fs.existsSync(path.join(ROOT, p)) ||
			git(["ls-files", "--", p]).out.trim() !== "",
	);
}

type GitStatus = {
	branch: string;
	content: string[];
	others: string[];
	clean: boolean;
};

function toLines(text: string): string[] {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

function gitStatus(): GitStatus {
	const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
	const all = git(["status", "--porcelain"]);
	const scoped = git([
		"status",
		"--porcelain",
		"--",
		...resolvedContentPaths(),
	]);
	const content = toLines(scoped.out);
	// 「发布上线」按钮不会带上的改动，单独列出来提醒一下。
	const others = toLines(all.out).filter((line) => !content.includes(line));
	return {
		branch: branch.out,
		content,
		others,
		clean: content.length === 0,
	};
}

function gitPublish(message: string): {
	files: string[];
	commit: string;
	push: string;
} {
	const msg = message.trim();
	if (!msg) throw new Error("提交信息不能为空");

	const add = git(["add", "--", ...resolvedContentPaths()]);
	if (!add.ok) throw new Error(`git add 失败：${add.out}`);

	const staged = git(["diff", "--cached", "--name-only"]);
	if (!staged.out) throw new Error("没有需要提交的内容改动");

	const commit = git(["commit", "-m", msg]);
	if (!commit.ok) throw new Error(`git commit 失败：${commit.out}`);

	const push = git(["push"]);
	if (!push.ok) throw new Error(`git push 失败：${push.out}`);

	return {
		files: staged.out.split("\n").filter(Boolean),
		commit: commit.out,
		push: push.out,
	};
}

/* ---------------------------------- HTTP ---------------------------------- */

function sendJson(res: ServerResponse, status: number, body: unknown): void {
	res.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
		"Cache-Control": "no-store",
	});
	res.end(JSON.stringify(body));
}

async function readBody(
	req: IncomingMessage,
): Promise<Record<string, unknown>> {
	const chunks: Buffer[] = [];
	let size = 0;
	for await (const chunk of req) {
		const buf = chunk as Buffer;
		size += buf.length;
		if (size > MAX_BODY) throw new Error("请求体过大（上限 32 MB）");
		chunks.push(buf);
	}
	if (chunks.length === 0) return {};
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// token 防的是「别的网页在你浏览器里偷偷 POST 本机端口」这类攻击，
// 它拿不到页面里的 token，也过不了 Origin 校验。
function authorized(req: IncomingMessage): boolean {
	const origin = req.headers.origin;
	if (typeof origin === "string" && !ALLOWED_ORIGINS.has(origin)) return false;
	return req.headers["x-admin-token"] === TOKEN;
}

async function route(url: URL, req: IncomingMessage): Promise<unknown> {
	const p = url.pathname;

	if (req.method === "GET") {
		if (p === "/api/state") {
			return {
				site: siteConfig.site_url,
				today: todayLocal(),
				posts: listPosts(),
				dynamics: listDynamics(),
				friends: readFriends(),
				ads: readAds(),
				git: gitStatus(),
			};
		}
		if (p === "/api/post") return readPost(url.searchParams.get("slug") || "");
		if (p === "/api/dynamic") {
			return readDynamic(url.searchParams.get("file") || "");
		}
		if (p === "/api/git") return gitStatus();
		if (p === "/api/slug") {
			return { slug: toSlug(url.searchParams.get("title") || "") };
		}
		throw new Error(`未知接口：${p}`);
	}

	const body = await readBody(req);
	if (p === "/api/post/save") return savePost(body as unknown as PostPayload);
	if (p === "/api/post/delete") return deletePost(String(body.slug || ""));
	if (p === "/api/dynamic/save") {
		return saveDynamic(body as unknown as DynamicPayload);
	}
	if (p === "/api/dynamic/delete") {
		return deleteDynamic(String(body.file || ""));
	}
	if (p === "/api/friends/save") {
		return saveFriends(body.friends as FriendPayload[]);
	}
	if (p === "/api/ads/save") {
		return saveAds(body.ads as AdSlot[]);
	}
	if (p === "/api/upload") {
		return uploadImage(body as unknown as UploadPayload);
	}
	if (p === "/api/git/publish") return gitPublish(String(body.message || ""));
	throw new Error(`未知接口：${p}`);
}

const server = http.createServer((req, res) => {
	const url = new URL(req.url || "/", `http://${BIND}:${PORT}`);

	if (url.pathname === "/" || url.pathname === "/index.html") {
		const html = fs
			.readFileSync(UI_HTML, "utf8")
			.replace("__ADMIN_TOKEN__", TOKEN);
		res.writeHead(200, {
			"Content-Type": "text/html; charset=utf-8",
			"Cache-Control": "no-store",
		});
		res.end(html);
		return;
	}

	if (url.pathname === "/ui.js") {
		res.writeHead(200, {
			"Content-Type": "text/javascript; charset=utf-8",
			"Cache-Control": "no-store",
		});
		res.end(fs.readFileSync(UI_JS, "utf8"));
		return;
	}

	if (!url.pathname.startsWith("/api/")) {
		sendJson(res, 404, { ok: false, error: "Not found" });
		return;
	}

	if (!authorized(req)) {
		sendJson(res, 403, { ok: false, error: "token 校验失败，请刷新后台页面" });
		return;
	}

	route(url, req)
		.then((data) => sendJson(res, 200, { ok: true, data }))
		.catch((err: unknown) => {
			const message = err instanceof Error ? err.message : String(err);
			sendJson(res, 400, { ok: false, error: message });
		});
});

// 最常见的启动失败是端口还被上一个没关干净的后台占着。默认的
// unhandled 'error' 事件会甩一整页 Node 栈，对本地小工具来说没必要。
server.on("error", (err: NodeJS.ErrnoException) => {
	if (err.code === "EADDRINUSE") {
		process.stderr.write(
			`\n  端口 ${PORT} 已被占用，多半是上一个后台还开着。\n` +
				"  关掉那个终端，或换个端口：ADMIN_PORT=4323 pnpm admin\n\n",
		);
		process.exit(1);
	}
	throw err;
});

server.listen(PORT, BIND, () => {
	process.stdout.write(
		[
			"",
			"  本地内容后台已启动",
			`    地址： http://${BIND}:${PORT}/`,
			"    只监听本机，外网和局域网都访问不到；关掉这个终端即停止。",
			"    建议同时开着 pnpm dev（localhost:4321）以便实时预览。",
			"",
			"",
		].join("\n"),
	);
});
