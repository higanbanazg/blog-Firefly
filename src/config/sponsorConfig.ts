import type { SponsorConfig } from "../types/sponsorConfig";

export const sponsorConfig: SponsorConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 打赏用途说明
	usage:
		"您的打赏将用于服务器维护、内容创作和功能开发，帮助我持续提供优质内容。",

	// 是否显示打赏者列表
	showSponsorsList: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否在文章详情页底部显示打赏按钮
	// 打赏渠道全部换成你自己的之后再改回 true
	showButtonInPost: false,

	// 打赏方式列表
	// ⚠️ 全部已停用。主题自带的配置里，收款码图片和 ko-fi / 爱发电 链接都属于主题
	//    作者 cuteleaf，原样保留会让读者的打赏进到作者账户。作者的两张收款码图片
	//    已从 public/assets/images/sponsor/ 删除。
	//    启用任一渠道前，请先把其中的收付款信息换成你自己的。
	methods: [
		{
			name: "支付宝",
			icon: "fa7-brands:alipay",
			// 把你自己的收款码放到 public/assets/images/sponsor/ 下，并改成对应文件名
			qrCode: "/assets/images/sponsor/alipay.png",
			link: "",
			description: "使用 支付宝 扫码打赏",
			// 换上自己的收款码后改为 true
			enabled: false,
		},
		{
			name: "微信",
			icon: "fa7-brands:weixin",
			qrCode: "/assets/images/sponsor/wechat.png",
			link: "",
			description: "使用 微信 扫码打赏",
			// 换上自己的收款码后改为 true
			enabled: false,
		},
		{
			name: "ko-fi",
			icon: "simple-icons:kofi",
			qrCode: "",
			// 原值是主题作者的账号，已清空
			link: "",
			description: "Buy me a coffee",
			// 填入自己的 ko-fi 主页后改为 true
			enabled: false,
		},
		{
			name: "爱发电",
			icon: "simple-icons:afdian",
			qrCode: "",
			// 原值是主题作者的账号，已清空
			link: "",
			description: "通过 爱发电 进行打赏",
			// 填入自己的爱发电主页后改为 true
			enabled: false,
		},
	],

	// 打赏者列表（可选）
	// 主题自带的两条是虚构的示例数据（"夏叶 ¥50"、"匿名用户 ¥20"），原样保留等于
	// 在站点上展示伪造的打赏记录，已清空。真有人打赏了再按下面的格式往里加：
	//   { name: "张三", avatar: "https://...", amount: "¥50", date: "2026-01-01" }
	sponsors: [],
};
