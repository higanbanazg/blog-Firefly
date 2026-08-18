import type { ProfileConfig } from "../types/profileConfig";

export const profileConfig: ProfileConfig = {
	// 头像
	// 图片路径支持三种格式：
	// 1. public 目录（以 "/" 开头，不优化）："/assets/images/avatar.webp"
	// 2. src 目录（不以 "/" 开头，自动优化但会增加构建时间，推荐）："assets/images/avatar.webp"
	// 3. 远程 URL："https://example.com/avatar.jpg"
	avatar: "assets/images/avatar.avif",

	// 名字（显示在侧边栏个人卡片）
	name: "higanbana",

	// 个人签名
	bio: "Hello, I'm higanbana.",

	// 链接配置
	// 已经预装的图标集：fa7-brands，fa7-regular，fa7-solid，material-symbols，simple-icons
	// 访问https://icones.js.org/ 获取图标代码，
	// 如果想使用尚未包含相应的图标集，则需要安装它
	// `pnpm add @iconify-json/<icon-set-name>`
	// showName: true 时显示图标和名称，false 时只显示图标
	// ⚠️ 主题自带的 qq / GitHub / Email 三条原本全部指向主题作者 cuteleaf 本人
	//    （qq 群 qm.qq.com/q/ZGsFa8qX2G、github.com/CuteLeaf、xiaye@msn.com）。
	//    邮箱那条尤其要命：页面只做了 base64 混淆防爬虫，读者点信封图标仍会正常
	//    唤起邮件客户端寄给作者。qq 一条已整块移除，GitHub 和 Email 换成本站站长的。
	links: [
		{
			name: "GitHub",
			icon: "fa7-brands:github",
			url: "https://github.com/higanbanazg",
			showName: false,
		},
		{
			name: "Email",
			icon: "fa7-solid:envelope",
			url: "mailto:higanbanazg@gmail.com",
			showName: false,
		},
		{
			name: "RSS",
			icon: "fa7-solid:rss",
			url: "/rss/",
			showName: false,
		},
	],
};
