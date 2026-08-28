// 组件配置类型定义
export type WidgetComponentType =
	| "profile"
	| "announcement"
	| "categories"
	| "tags"
	| "sidebarToc"
	| "advertisement"
	| "stats"
	| "calendar"
	| "siteInfo"
	| "dynamic";

export type WidgetComponentConfig = {
	type: WidgetComponentType; // 组件类型
	enable: boolean; // 是否启用该组件
	showTitle?: boolean; // 是否显示该组件标题，默认true
	position: "top" | "sticky"; // 组件位置：top=固定在顶部，sticky=粘性定位（可滚动）
	showOnPostPage?: boolean; // 是否在文章详情页显示
	hideOnNonPostPage?: boolean; // 是否在非文章详情页隐藏
	specificConfig?: WidgetSpecificConfig;
	customProps?: Record<string, unknown>; // 自定义属性，用于扩展组件功能
};

export type MobileBottomComponentConfig = {
	type: WidgetComponentType; // 组件类型
	enable: boolean; // 是否启用该组件
	showTitle?: boolean; // 是否显示该组件标题，默认true
	showOnPostPage?: boolean; // 是否在文章详情页显示
	hideOnNonPostPage?: boolean; // 是否在非文章详情页隐藏
	specificConfig?: WidgetSpecificConfig;
	customProps?: Record<string, unknown>; // 自定义属性，用于扩展组件功能
};

// 组件通用专属配置
export type WidgetSpecificConfig = {
	hidden?: ("mobile" | "tablet" | "desktop")[]; // 在指定设备上隐藏
	collapseThreshold?: number; // 折叠阈值
	calendar?: CalendarConfig; // 日历组件专用配置
	ad?: AdConfig; // 广告组件专用配置
	siteInfo?: SiteInfoConfig; // 站点信息组件专用配置
	dynamic?: DynamicWidgetConfig; // 最新动态组件专用配置
};

export type DynamicWidgetConfig = {
	limit?: number; // 显示的最新动态数量，默认 3
};

// 站点信息组件专用配置
export type SiteInfoConfig = {
	unknownBuildPlatform?: string; // 未识别的构建平台显示文本，默认 "Unknown CI"
};

// 日历组件专用配置
export type CalendarConfig = {
	// 是否显示年度文章热力图
	showHeatmap: boolean;
};

// 广告栏配置
export type AdConfig = {
	title?: string; // 广告栏标题
	content?: string; // 广告栏文本内容
	image?: { src: string; alt?: string; link?: string; external?: boolean }; // 广告图片
	link?: { text: string; url: string; external?: boolean }; // 广告链接按钮
	padding?: {
		top?: string;
		right?: string;
		bottom?: string;
		left?: string;
		all?: string;
	}; // 内边距
	closable?: boolean; // 是否可关闭
	displayCount?: number; // 显示次数限制，-1为无限制
	expireDate?: string; // 过期时间 (ISO 8601 格式)
};

// 广告位（数据本体在 src/config/ads.json，由 pnpm admin 后台读写）
// 这里的字段是「扁平」的，跟上面嵌套的 AdConfig 不一样：后台要逐字段拼 JSON，
// 平铺比嵌套好写也好校验，翻译成 AdConfig 的活儿放在 sidebarConfig.ts 里做。
export type AdSlot = {
	note: string; // 内部备注（广告主、到期日之类），只在后台可见，不会出现在页面上
	enabled: boolean; // 是否上线
	side: "left" | "right" | "mobile"; // 放哪一栏，mobile 指移动端底部
	position: "top" | "sticky"; // top=固定在栏顶，sticky=跟随页面滚动
	showTitle: boolean; // 是否显示标题栏
	title: string; // 标题栏文字
	content: string; // 图片下方的说明文字，留空则不显示
	imgSrc: string; // 图片地址，留空则是纯文字广告
	imgAlt: string; // 图片替代文字
	imgLink: string; // 点图片跳转的地址
	linkText: string; // 底部按钮文字
	linkUrl: string; // 底部按钮地址，与 linkText 都填了才显示按钮
	closable: boolean; // 右上角是否有关闭按钮
	fullBleed: boolean; // 图片顶满卡片、不留内边距
};

export type SidebarLayoutConfig = {
	enable: boolean; // 是否启用侧边栏
	position: "left" | "right" | "both"; // 侧边栏位置：左侧、右侧或双侧
	tabletSidebar?: "left" | "right"; // 平板端(769-1279px)显示哪侧侧边栏，仅position为both时生效，默认left
	hideSidebarOnPostPage?: boolean; // 文章详情页隐藏侧边栏，设为 true 则只在首页等非文章页显示，默认 false
	showBothSidebarsOnPostPage?: boolean; // 当position为left或right时，是否在文章详情页显示双侧边栏
	leftComponents: WidgetComponentConfig[]; // 左侧边栏组件配置列表
	rightComponents: WidgetComponentConfig[]; // 右侧边栏组件配置列表
	mobileBottomComponents: MobileBottomComponentConfig[]; // 移动端底部组件配置列表（<768px显示）
};
