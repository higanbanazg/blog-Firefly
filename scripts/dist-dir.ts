// 构建产物根目录解析
// 启用 Cloudflare 适配器（CF_WORKERS=1）后，Astro 会把静态产物拆进 dist/client、
// 服务端入口拆进 dist/server；不启用适配器时仍然是扁平的 dist/。
// 构建后脚本一律从这里取"最终对外服务的根目录"，避免各自写死 "dist" 而在
// 适配器模式下静默失效（写到服务目录之外、或扫不到文件）。

import { existsSync } from "node:fs";

export const DIST_DIR: string = existsSync("dist/client")
	? "dist/client"
	: "dist";
