import { getDynamicEntries } from "@/utils/dynamic-data";

// 数据构造逻辑已移到 @/utils/dynamic-data，这里只负责序列化成接口响应。
// /dynamic/ 页面现在不再走这个接口（改为构建期直接渲染），但接口保留：
// dynamicConfig.apiUrl 支持指向第三方，别的站点也可能反过来引用本站这个地址。
export async function GET(): Promise<Response> {
	return new Response(JSON.stringify(await getDynamicEntries()), {
		headers: {
			"Content-Type": "application/json; charset=utf-8",
		},
	});
}
