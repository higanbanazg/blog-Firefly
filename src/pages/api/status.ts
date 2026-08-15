// 按需渲染（SSR）端点 —— 每次请求都在 Cloudflare Worker 里实时执行，不参与预渲染。
// 留这个路由有两个作用：
//   1. 部署自检：能正常返回，就说明 Worker 入口、ASSETS 绑定、静态资源未命中后回落
//      到 Worker 这三件事全部打通了。colo / country 来自 Cloudflare 在边缘注入的
//      request.cf，纯静态托管下拿不到，可以据此确认请求确实进了 Worker。
//   2. 全站预渲染时 Astro 不会产出服务端入口（dist/server 会是空目录），wrangler 的
//      main 就没有文件可指。至少保留一个按需路由，全栈 Worker 才真正成立。
import type { APIRoute } from "astro";

// Cloudflare 在 Request 上挂的边缘元数据。注意 Astro v6 起 locals.runtime.cf 已移除，
// 只能从 request.cf 取；本地 wrangler dev 里这些字段可能为空。
type CloudflareRequest = Request & {
	cf?: {
		colo?: string;
		country?: string;
	};
};

export const prerender = false;

export const GET: APIRoute = ({ request }) => {
	const cf = (request as CloudflareRequest).cf;

	return new Response(
		JSON.stringify({
			ok: true,
			renderedAt: new Date().toISOString(),
			// 处理本次请求的 Cloudflare 数据中心代码 / 访客所在国家
			colo: cf?.colo ?? null,
			country: cf?.country ?? null,
		}),
		{
			headers: {
				"content-type": "application/json; charset=utf-8",
				// 自检端点必须绕开所有缓存，否则拿到的可能是上一次部署的结果
				"cache-control": "no-store",
			},
		},
	);
};
