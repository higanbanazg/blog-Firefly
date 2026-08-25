import type { FriendLink, FriendsPageConfig } from "../types/friendsConfig";
import friendsData from "./friends.json";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 是否显示底部自定义内容（friends.mdx 中的内容）
	showCustomContent: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序
	randomizeSort: false,
};

// 友链配置
// 主题自带三条：作者本人的博客、作者的主题文档站、Astro 官方仓库，已全部删除。
// 本站自己的占位条目也已撤掉——友链页列自己没有意义，现在开始只放真实友链。
//
// 数据本体在同目录的 friends.json，这里只做类型标注后转出去。
// 拆开的原因：`pnpm admin` 本地后台要增删改友链，读写 JSON 是两行代码，
// 而解析 TS 数组字面量（还带行尾注释）很容易出错。手写也可以直接编辑
// friends.json，字段含义见 src/types/friendsConfig.ts：
//   title 站名 / imgurl 头像图 URL / desc 描述 / siteurl 站点地址
//   tags 标签数组 / weight 权重（越大越靠前）/ enabled 是否启用
export const friendsConfig: FriendLink[] = friendsData;

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
