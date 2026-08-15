// 以 Cloudflare Workers 为目标构建，等价于 CF_WORKERS=1 pnpm run build。
// 单独包一层是为了跨平台：Windows 的 cmd.exe 不认 "VAR=value cmd" 这种前缀写法，
// 直接把 CF_WORKERS=1 写进 npm script 会导致本地构建失败。
import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["run", "build"], {
	stdio: "inherit",
	shell: true,
	env: { ...process.env, CF_WORKERS: "1" },
});

process.exit(result.status ?? 1);
