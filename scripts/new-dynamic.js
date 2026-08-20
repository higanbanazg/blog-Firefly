/* Create a timestamped dynamic markdown file from command-line text. */

import fs from "node:fs";
import path from "node:path";
import { siteConfig } from "../src/config/siteConfig.ts";

const content = process.argv.slice(2).join(" ").trim();

if (!content) {
	console.error(
		"Error: No dynamic content provided\nUsage: pnpm new-dynamic <content>",
	);
	process.exit(1);
}

const now = new Date();
const timezone = siteConfig.timezone || "Asia/Shanghai";
const dateParts = new Intl.DateTimeFormat("en-CA", {
	timeZone: timezone,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hourCycle: "h23",
})
	.formatToParts(now)
	.reduce((parts, part) => {
		if (part.type !== "literal") parts[part.type] = part.value;
		return parts;
	}, {});
const year = dateParts.year;
const month = dateParts.month;
const day = dateParts.day;
const hours = dateParts.hour;
const minutes = dateParts.minute;
const seconds = dateParts.second;
// 时区偏移量，形如 "+08:00"。
// 上面这串年月日时分秒是按 siteConfig.timezone 算出来的墙上时间，但
// content.config.ts 里 published 是 z.date()，YAML 解析不带偏移量的
// "2026-08-20 17:09:41" 时按 UTC 处理，页面再转回 Asia/Shanghai 显示，
// 结果每条动态都比实际写的时间晚 8 小时。所以这里必须把偏移量写进去，
// 输出完整 ISO 串 "2026-08-20T17:09:41+08:00"。
const offsetLabel =
	new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "longOffset" })
		.formatToParts(now)
		.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00";
const offset = offsetLabel.replace(/^GMT/, "") || "+00:00";
const timestamp = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offset}`;
const fileName = `${year}-${month}-${day}-${hours}${minutes}${seconds}.md`;
const targetDir = path.resolve("src/content/dynamic");
const fullPath = path.join(targetDir, fileName);

fs.mkdirSync(targetDir, { recursive: true });

if (fs.existsSync(fullPath)) {
	console.error(`Error: File ${fullPath} already exists`);
	process.exit(1);
}

fs.writeFileSync(fullPath, `---\npublished: ${timestamp}\n---\n\n${content}\n`);

console.log(`Dynamic ${fullPath} created`);
