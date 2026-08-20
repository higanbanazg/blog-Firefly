import { siteConfig } from "../config";

export function formatDateToYYYYMMDD(date: Date): string {
	return date.toISOString().substring(0, 10);
}

// 国际化日期格式化函数
export function formatDateI18n(
	dateInput: Date | string,
	includeTime?: boolean,
): string {
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	const lang = siteConfig.lang || "en";

	// 根据语言设置不同的日期格式
	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "long",
		day: "numeric",
	};

	if (includeTime) {
		options.hour = "2-digit";
		options.minute = "2-digit";
		options.second = "2-digit";
	}

	// 如果配置了时区，则将其用于格式化（IANA 时区字符串）
	if (siteConfig.timezone) {
		(options as Intl.DateTimeFormatOptions).timeZone = siteConfig.timezone;
	}

	// 语言代码映射
	const localeMap: Record<string, string> = {
		zh_CN: "zh-CN",
		zh_TW: "zh-TW",
		en: "en-US",
		ja: "ja-JP",
		ko: "ko-KR",
		es: "es-ES",
		th: "th-TH",
		vi: "vi-VN",
		tr: "tr-TR",
		id: "id-ID",
		fr: "fr-FR",
		de: "de-DE",
		ru: "ru-RU",
		ar: "ar-SA",
	};

	const locale = localeMap[lang] || "en-US";
	return includeTime
		? date.toLocaleString(locale, options)
		: date.toLocaleDateString(locale, options);
}

// 国际化日期时间格式化函数（带时分秒）
export function formatDateI18nWithTime(dateInput: Date | string): string {
	return formatDateI18n(dateInput, true);
}

// 动态时间格式化，输出 YYYY-MM-DD HH:mm:ss。
// 调用方（DynamicItem.astro / DynamicSidebar.svelte）会在后面接一个
// formatTimezoneOffset(siteConfig.timezone) 算出来的「UTC+8」标签，所以这里
// 必须按同一个时区取墙上时间。原来这里写死 timeZone: "UTC"，等于「按 UTC
// 取数字，却标上 UTC+8」，两边对不上。
//
// 之所以原来看着是对的：主题的动态 frontmatter 写的是不带偏移量的
// "2026-08-20 17:23:13"，YAML 按 UTC 解析，时刻本身就已经错了 8 小时，
// 再用 UTC 格式化正好把数字还原回去 —— 两个错误互相抵消。现在
// scripts/new-dynamic.js 已改为输出带 +08:00 的完整 ISO 串，时刻是对的，
// 这里也必须跟着按站点时区格式化。
export function formatDynamicDate(dateInput: Date | string): string {
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: siteConfig.timezone || "UTC",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value || "";
	return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

export function formatTimezoneOffset(
	timezone: string,
	dateInput: Date | string,
): string {
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	const timezoneName = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		timeZoneName: "longOffset",
	})
		.formatToParts(date)
		.find((part) => part.type === "timeZoneName")?.value;

	if (!timezoneName || timezoneName === "GMT") return "UTC";

	return timezoneName
		.replace("GMT", "UTC")
		.replace(/([+-])0(\d)/, "$1$2")
		.replace(":00", "");
}

// 统一格式为 YYYY-MM-DD HH:mm，支持站点时区
export function formatDateTimeToYYYYMMDDHHmm(dateInput: Date | string): string {
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;

	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	};

	if (siteConfig.timezone) {
		options.timeZone = siteConfig.timezone;
	}

	const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value || "";

	return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}
