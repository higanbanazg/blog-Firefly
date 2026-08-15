// Pagefind 索引构建后脚本
// pagefind 的 --site 必须指向"最终对外服务的根目录"：指错了，索引会落在服务目录
// 之外根本传不上去，而且索引里记录的页面 URL 会多出一层路径前缀，搜索结果全是 404。
// 产物布局会随 Cloudflare 适配器开关变化（dist/ ↔ dist/client/），所以这里动态解析。

import { spawnSync } from "node:child_process";
import { DIST_DIR } from "./dist-dir";

console.log(`🔎 Building Pagefind index for ${DIST_DIR}/ ...`);

// shell: true 是为了在 Windows 上能解析 node_modules/.bin 里的 pagefind.cmd
const result = spawnSync("pagefind", ["--site", DIST_DIR], {
	stdio: "inherit",
	shell: true,
});

if (result.error) {
	console.error("✗ Failed to run pagefind:", result.error.message);
	process.exit(1);
}

process.exit(result.status ?? 1);
