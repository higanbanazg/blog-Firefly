// IndexNow 推送脚本 —— pnpm indexnow [url ...]
//
// 用法：
//   pnpm indexnow                              抓线上 sitemap，把全站页面推一遍
//   pnpm indexnow https://blog.ipfox.cc/posts/foo/   只推指定 URL（发新文章后最常用）
//
// 参与 IndexNow 的是 Bing、Yandex、Seznam、Naver，Google 不参与，
// 所以这个脚本推完不代表 Google 也知道了，Google 那边仍然靠 sitemap + 主动请求收录。
//
// 重要：必须等页面真正部署上线之后再推。IndexNow 的语义是"这个地址有更新，
// 现在就来爬"，推一个还没上线的地址只会让爬虫扑空。

import { siteConfig } from "../src/config";

// IndexNow 的 key 按设计就是公开的：验证方式正是把它明文放在
// https://<host>/<key>.txt 让搜索引擎回读比对，所以写在源码里不算泄露。
// 对应的文件是 public/b4c4b3f54a22496e9bd3bcddde02fe8c.txt，两边必须一致。
const INDEXNOW_KEY = "b4c4b3f54a22496e9bd3bcddde02fe8c";

// 提交到任意一个参与方即可，各家之间会互相同步。
const ENDPOINT = "https://api.indexnow.org/indexnow";

// 协议规定单次最多 10000 条。
const MAX_URLS = 10000;

const SITE_URL = new URL(siteConfig.site_url);
const HOST = SITE_URL.host;
const KEY_LOCATION = new URL(`/${INDEXNOW_KEY}.txt`, SITE_URL).href;

const UA = "Mozilla/5.0 (compatible; blog-indexnow-script/1.0)";

async function fetchText(url: string): Promise<string> {
	const res = await fetch(url, { headers: { "User-Agent": UA } });
	if (!res.ok) {
		throw new Error(`GET ${url} -> HTTP ${res.status}`);
	}
	return await res.text();
}

// sitemap 和 sitemapindex 用的是同一个 <loc> 标签，解析逻辑可以共用。
function extractLocs(xml: string): string[] {
	return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1]);
}

// 故意抓线上而不是读本地 dist/：Workers Builds 是在远端构建的，本地 dist
// 未必等于线上实际部署的内容，而 IndexNow 只应该被告知真正能访问到的地址。
async function collectFromSitemap(): Promise<string[]> {
	const indexUrl = new URL("/sitemap-index.xml", SITE_URL).href;
	console.log(`📥 读取 ${indexUrl}`);
	const indexXml = await fetchText(indexUrl);
	const locs = extractLocs(indexXml);

	// 不是索引文件的话，里面列的就已经是页面地址了。
	if (!indexXml.includes("<sitemapindex")) {
		return locs;
	}

	const urls: string[] = [];
	for (const child of locs) {
		console.log(`📥 读取 ${child}`);
		urls.push(...extractLocs(await fetchText(child)));
	}
	return urls;
}

// key 文件没上线是 403 最常见的原因，先自检一次，省得对着状态码猜。
async function verifyKeyFile(): Promise<void> {
	const res = await fetch(KEY_LOCATION, { headers: { "User-Agent": UA } });
	if (!res.ok) {
		throw new Error(
			`key 文件不可访问：${KEY_LOCATION} -> HTTP ${res.status}\n` +
				"先把 public/<key>.txt 部署上线，再来推送。",
		);
	}
	const body = (await res.text()).trim();
	if (body !== INDEXNOW_KEY) {
		throw new Error(
			`key 文件内容不匹配：${KEY_LOCATION}\n期望 ${INDEXNOW_KEY}，实际 ${body}`,
		);
	}
	console.log(`✅ key 文件校验通过：${KEY_LOCATION}`);
}

function explainStatus(status: number): string {
	switch (status) {
		case 200:
			return "提交成功，URL 已进入索引队列。";
		case 202:
			return "已接收，但 key 还在验证中；确认 key 文件能正常访问即可，通常稍后自动通过。";
		case 400:
			return "请求格式有误（JSON 结构或字段不对）。";
		case 403:
			return "key 无效：key 文件不存在、内容不匹配，或和提交的 host 对不上。";
		case 422:
			return "URL 不属于该 host，或 key 与 host 不匹配。";
		case 429:
			return "提交过于频繁，被限流了，过一会儿再推。";
		default:
			return "未预期的状态码，见下方响应体。";
	}
}

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const urls = args.length > 0 ? args : await collectFromSitemap();

	if (urls.length === 0) {
		console.error("❌ 没有可提交的 URL。");
		process.exit(1);
	}

	// 跨站地址会让整批请求被 422 拒掉，先自己筛出来。
	const foreign = urls.filter((u) => {
		try {
			return new URL(u).host !== HOST;
		} catch {
			return true;
		}
	});
	if (foreign.length > 0) {
		console.error(`❌ 以下 URL 不属于 ${HOST}，无法提交：`);
		for (const u of foreign) console.error(`   ${u}`);
		process.exit(1);
	}

	if (urls.length > MAX_URLS) {
		console.error(`❌ 单次最多 ${MAX_URLS} 条，当前 ${urls.length} 条。`);
		process.exit(1);
	}

	await verifyKeyFile();

	console.log(`\n📤 准备提交 ${urls.length} 条 URL 到 ${ENDPOINT}`);
	for (const u of urls) console.log(`   ${u}`);

	const res = await fetch(ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			"User-Agent": UA,
		},
		body: JSON.stringify({
			host: HOST,
			key: INDEXNOW_KEY,
			keyLocation: KEY_LOCATION,
			urlList: urls,
		}),
	});

	const body = (await res.text()).trim();
	console.log(`\n📨 HTTP ${res.status} ${res.statusText}`);
	console.log(`   ${explainStatus(res.status)}`);
	if (body) console.log(`   响应体：${body}`);

	// 200 和 202 都算提交成功，202 只是 key 还在异步验证。
	if (res.status !== 200 && res.status !== 202) {
		process.exit(1);
	}
}

await main();
