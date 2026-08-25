// 本地内容后台的前端逻辑。
//
// 这里刻意不做任何构建：一个原生 JS 文件，浏览器直接跑。后台只在本机
// 127.0.0.1 上活着，没有打包、没有依赖、没有框架，坏了也就是刷新一下。
//
// 正文一律走 <textarea> 原样收发。本站有 15 个自定义 remark/rehype 插件
// （Mermaid、PlantUML、KaTeX、wiki 链接、admonition、图片网格……），
// 任何「富文本编辑器」都会在解析-再序列化的过程中把这些语法改坏，
// 所以这里根本不解析 Markdown，只当纯文本搬运。

const TOKEN = window.ADMIN_TOKEN;
const $ = (id) => document.getElementById(id);

let state = {
	posts: [],
	dynamics: [],
	friends: [],
	git: null,
	site: "",
	today: "",
};
let curPost = null; // 当前编辑的文章，null = 未选择
let curDyn = null;

/* ------------------------------ 基础工具 ------------------------------ */

function toast(msg, kind) {
	const el = document.createElement("div");
	el.className = `toast ${kind || ""}`;
	el.textContent = msg;
	document.body.appendChild(el);
	setTimeout(() => el.remove(), kind === "err" ? 7000 : 3000);
}

function esc(s) {
	const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
	return String(s ?? "").replace(/[&<>"]/g, (c) => map[c]);
}

async function api(path, opts) {
	const res = await fetch(path, {
		headers: { "X-Admin-Token": TOKEN, "Content-Type": "application/json" },
		...opts,
	});
	const json = await res
		.json()
		.catch(() => ({ ok: false, error: "响应不是合法 JSON" }));
	if (!res.ok || !json.ok) throw new Error(json.error || `HTTP ${res.status}`);
	return json.data;
}

const post = (path, body) =>
	api(path, { method: "POST", body: JSON.stringify(body || {}) });

/* -------------------------------- 加载 -------------------------------- */

async function reload() {
	state = await api("/api/state");
	renderGit();
	renderPostList();
	renderDynList();
	renderFriends();
	const cats = [...new Set(state.posts.map((p) => p.category).filter(Boolean))];
	$("categories").innerHTML = cats
		.map((c) => `<option value="${esc(c)}">`)
		.join("");
}

function renderGit() {
	const n = state.git.content.length;
	const chip = $("gitChip");
	chip.textContent = `${state.git.branch} · ${n === 0 ? "无改动" : `${n} 处未发布改动`}`;
	chip.classList.toggle("dirty", n > 0);
}

/* -------------------------------- 文章 -------------------------------- */

function renderPostList() {
	const rows = state.posts.map((p) => {
		const on = curPost && curPost.originalSlug === p.slug ? " on" : "";
		return `<button type="button" class="item${on}" data-slug="${esc(p.slug)}">
			<div class="item-title">${esc(p.title || p.slug)}</div>
			<div class="item-meta">
				<span>${esc(p.published)}</span>
				${p.draft ? '<span class="badge draft">草稿</span>' : ""}
				${p.pinned ? '<span class="badge pin">置顶</span>' : ""}
				${p.category ? `<span>${esc(p.category)}</span>` : ""}
				<span>${p.words} 字</span>
			</div>
		</button>`;
	});
	$("postList").innerHTML =
		rows.join("") || '<div class="panel-body hint">还没有文章</div>';
}

function blankPost() {
	return {
		slug: "",
		originalSlug: "",
		title: "",
		published: state.today,
		updated: "",
		description: "",
		image: "",
		tags: [],
		category: "",
		draft: true,
		lang: "",
		pinned: false,
		author: "",
		sourceLink: "",
		licenseName: "",
		licenseUrl: "",
		comment: true,
		password: "",
		passwordHint: "",
		body: "",
	};
}

// 老文章的图片目录和 slug 常常对不上：3x-ui-vless-reality 那篇，图一直放在
// images/3x-ui/ 下。所以打开文章时先从正文里认出它已经在用的目录，认不出来
// 才退回 slug——否则粘一张图就会凭空多出个新文件夹。
function detectImgDir(body, slug) {
	const hits = [...body.matchAll(/\.\/images\/([^/)\]\s]+)\//g)].map(
		(m) => m[1],
	);
	if (hits.length === 0) return slug;
	// 一篇文章理论上只用一个目录，真混用了就取出现次数最多的那个
	const tally = new Map();
	for (const h of hits) tally.set(h, (tally.get(h) || 0) + 1);
	return [...tally].sort((a, b) => b[1] - a[1])[0][0];
}

// 图片目录默认跟着 slug 走，但用户手动改过就不再自动跟
function syncImgDir() {
	if ($("p-imgdir").dataset.touched) return;
	$("p-imgdir").value = $("p-slug").value.trim();
}

function fillPost(p) {
	curPost = p;
	$("postHead").textContent = p.originalSlug
		? `编辑：${p.originalSlug}`
		: "新建文章";
	$("p-title").value = p.title;
	$("p-slug").value = p.slug;
	$("p-published").value = p.published;
	$("p-updated").value = p.updated;
	$("p-category").value = p.category;
	$("p-tags").value = p.tags.join(", ");
	$("p-image").value = p.image;
	$("p-description").value = p.description;
	$("p-author").value = p.author;
	$("p-sourceLink").value = p.sourceLink;
	$("p-licenseName").value = p.licenseName;
	$("p-licenseUrl").value = p.licenseUrl;
	$("p-password").value = p.password;
	$("p-passwordHint").value = p.passwordHint;
	$("p-lang").value = p.lang;
	$("p-draft").checked = p.draft;
	$("p-pinned").checked = p.pinned;
	$("p-comment").checked = p.comment;
	$("body").value = p.body;
	const imgDir = detectImgDir(p.body, p.slug);
	$("p-imgdir").value = imgDir;
	if (imgDir && imgDir !== p.slug) {
		// 正文里认出来的目录和 slug 不一致，说明这篇文章有自己的约定，
		// 之后改 slug 也不该把它冲掉
		$("p-imgdir").dataset.touched = "1";
	} else {
		delete $("p-imgdir").dataset.touched;
	}
	$("btnPreviewPost").href = `http://localhost:4321/posts/${p.slug || ""}/`;
	renderPostList();
}

function collectPost() {
	return {
		slug: $("p-slug").value.trim(),
		originalSlug: curPost ? curPost.originalSlug : "",
		title: $("p-title").value.trim(),
		published: $("p-published").value,
		updated: $("p-updated").value,
		description: $("p-description").value.trim(),
		image: $("p-image").value.trim(),
		tags: $("p-tags")
			.value.split(",")
			.map((t) => t.trim())
			.filter(Boolean),
		category: $("p-category").value.trim(),
		draft: $("p-draft").checked,
		lang: $("p-lang").value.trim(),
		pinned: $("p-pinned").checked,
		author: $("p-author").value.trim(),
		sourceLink: $("p-sourceLink").value.trim(),
		licenseName: $("p-licenseName").value.trim(),
		licenseUrl: $("p-licenseUrl").value.trim(),
		comment: $("p-comment").checked,
		password: $("p-password").value,
		passwordHint: $("p-passwordHint").value.trim(),
		body: $("body").value,
	};
}

async function openPost(slug) {
	try {
		fillPost(await api(`/api/post?slug=${encodeURIComponent(slug)}`));
	} catch (err) {
		toast(err.message, "err");
	}
}

$("postList").addEventListener("click", (e) => {
	const btn = e.target.closest(".item");
	if (btn) openPost(btn.dataset.slug);
});

$("btnNewPost").onclick = () => fillPost(blankPost());

// 标题转 slug 要走服务端：拼音转换用的是 pinyin-pro，和 new-post.js 同一套
// 算法，前端没有这个库。只在「新建且用户没手动改过 slug」时自动带出，
// 已发布的文章不动 slug，避免手滑把线上网址改掉。
let slugTimer = null;
$("p-title").addEventListener("input", () => {
	if (!curPost || curPost.originalSlug || $("p-slug").dataset.touched) return;
	clearTimeout(slugTimer);
	slugTimer = setTimeout(async () => {
		const title = $("p-title").value.trim();
		if (!title) return;
		try {
			const r = await api(`/api/slug?title=${encodeURIComponent(title)}`);
			if (!$("p-slug").dataset.touched) $("p-slug").value = r.slug;
		} catch {
			/* slug 只是便利功能，失败就让用户自己填 */
		}
	}, 300);
});

$("p-slug").addEventListener("input", () => {
	$("p-slug").dataset.touched = "1";
	syncImgDir();
});

$("p-imgdir").addEventListener("input", () => {
	$("p-imgdir").dataset.touched = "1";
});

$("btnSavePost").onclick = async () => {
	if (!curPost) {
		toast("先选一篇文章或点新建", "err");
		return;
	}
	try {
		const r = await post("/api/post/save", collectPost());
		delete $("p-slug").dataset.touched;
		await reload();
		await openPost(r.slug);
		toast(`已保存 ${r.file}`, "ok");
	} catch (err) {
		toast(err.message, "err");
	}
};

$("btnDelPost").onclick = async () => {
	if (!curPost?.originalSlug) {
		toast("这篇还没保存过", "err");
		return;
	}
	if (!confirm(`确定删除文章 ${curPost.originalSlug} ？图片目录不会被删。`)) {
		return;
	}
	try {
		await post("/api/post/delete", { slug: curPost.originalSlug });
		curPost = null;
		$("postHead").textContent = "未选择";
		await reload();
		toast("已删除", "ok");
	} catch (err) {
		toast(err.message, "err");
	}
};

/* -------------------------------- 动态 -------------------------------- */

function renderDynList() {
	const rows = state.dynamics.map((d) => {
		const on = curDyn && curDyn.file === d.file ? " on" : "";
		return `<button type="button" class="item${on}" data-file="${esc(d.file)}">
			<div class="item-title">${esc(d.excerpt || "(空)")}</div>
			<div class="item-meta">
				<span class="mono">${esc(d.file.replace(/\.md$/, ""))}</span>
				${d.pinned ? '<span class="badge pin">置顶</span>' : ""}
				${d.location ? `<span>${esc(d.location)}</span>` : ""}
			</div>
		</button>`;
	});
	$("dynList").innerHTML =
		rows.join("") || '<div class="panel-body hint">还没有动态</div>';
}

function fillDyn(d) {
	curDyn = d;
	$("dynHead").textContent = d.file ? `编辑：${d.file}` : "新建动态";
	$("d-published").value = d.published;
	$("d-location").value = d.location;
	$("d-pinned").checked = d.pinned;
	$("d-body").value = d.body;
	renderDynList();
}

async function openDyn(file) {
	try {
		fillDyn(await api(`/api/dynamic?file=${encodeURIComponent(file)}`));
	} catch (err) {
		toast(err.message, "err");
	}
}

$("dynList").addEventListener("click", (e) => {
	const btn = e.target.closest(".item");
	if (btn) openDyn(btn.dataset.file);
});

$("btnNewDyn").onclick = () =>
	fillDyn({ file: "", published: "", pinned: false, location: "", body: "" });

$("btnSaveDyn").onclick = async () => {
	if (!curDyn) {
		toast("先选一条动态或点新建", "err");
		return;
	}
	try {
		const r = await post("/api/dynamic/save", {
			file: curDyn.file,
			published: $("d-published").value.trim(),
			pinned: $("d-pinned").checked,
			location: $("d-location").value.trim(),
			body: $("d-body").value,
		});
		await reload();
		await openDyn(r.file);
		toast(`已保存 ${r.file}`, "ok");
	} catch (err) {
		toast(err.message, "err");
	}
};

$("btnDelDyn").onclick = async () => {
	if (!curDyn?.file) {
		toast("这条还没保存过", "err");
		return;
	}
	if (!confirm(`确定删除动态 ${curDyn.file} ？`)) return;
	try {
		await post("/api/dynamic/delete", { file: curDyn.file });
		curDyn = null;
		$("dynHead").textContent = "未选择";
		await reload();
		toast("已删除", "ok");
	} catch (err) {
		toast(err.message, "err");
	}
};

/* ------------------------------ 图片上传 ------------------------------ */

function insertAtCursor(area, text) {
	const s = area.selectionStart;
	const e = area.selectionEnd;
	area.value = area.value.slice(0, s) + text + area.value.slice(e);
	area.selectionStart = s + text.length;
	area.selectionEnd = s + text.length;
	area.focus();
}

// 上传后在提示里报一下体积变化，好知道这道转码到底省了多少
function sizeNote(r) {
	const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
	if (!r.converted) return `（${kb(r.outBytes)}，未转码）`;
	const cut = Math.round((1 - r.outBytes / r.rawBytes) * 100);
	return `（${kb(r.rawBytes)} → ${kb(r.outBytes)}，省 ${cut}%）`;
}

// kind 决定图片落到哪：
//   post    -> src/content/posts/images/<目录>/，返回 ./images/<目录>/x.avif
//              相对路径，Astro 会接手做优化。目录取「图片目录」输入框，默认
//              是 slug，老文章则是从正文里认出来的那个
//   dynamic -> public/dynamic-images/，返回 /dynamic-images/x.avif 站内绝对
//              路径。动态的图片是被 dynamic-data.ts 抽出来原样塞进 <img src>，
//              不走 Astro 优化，所以必须放在 public 下
async function uploadFiles(files, kind, area) {
	for (const file of files) {
		if (!file.type.startsWith("image/")) continue;
		try {
			const data = await new Promise((ok, no) => {
				const r = new FileReader();
				r.onload = () => ok(r.result);
				r.onerror = () => no(new Error(`读取 ${file.name} 失败`));
				r.readAsDataURL(file);
			});
			const slug = kind === "post" ? $("p-slug").value.trim() || "misc" : "";
			const dir = kind === "post" ? $("p-imgdir").value.trim() : "";
			const r = await post("/api/upload", {
				kind,
				slug,
				dir,
				filename: file.name,
				data,
			});
			insertAtCursor(area, `![](${r.markdown})\n`);
			toast(`已上传 ${r.markdown} ${sizeNote(r)}`, "ok");
		} catch (err) {
			toast(err.message, "err");
		}
	}
}

function wireEditor(dropId, areaId, kind, inputId, btnId) {
	const drop = $(dropId);
	const area = $(areaId);

	drop.addEventListener("dragover", (e) => {
		e.preventDefault();
		drop.classList.add("over");
	});
	drop.addEventListener("dragleave", () => drop.classList.remove("over"));
	drop.addEventListener("drop", (e) => {
		e.preventDefault();
		drop.classList.remove("over");
		uploadFiles(e.dataTransfer.files, kind, area);
	});

	area.addEventListener("paste", (e) => {
		const files = [...(e.clipboardData?.files || [])];
		if (files.length) {
			e.preventDefault();
			uploadFiles(files, kind, area);
		}
	});

	// 正文里 Tab 应该插入制表符，而不是把焦点跳走。
	area.addEventListener("keydown", (e) => {
		if (e.key === "Tab") {
			e.preventDefault();
			insertAtCursor(area, "\t");
		}
	});

	$(btnId).onclick = () => $(inputId).click();
	$(inputId).onchange = (e) => {
		uploadFiles(e.target.files, kind, area);
		e.target.value = "";
	};
}

wireEditor("postDrop", "body", "post", "postImgInput", "btnPickPostImg");
wireEditor("dynDrop", "d-body", "dynamic", "dynImgInput", "btnPickDynImg");

/* -------------------------------- 友链 -------------------------------- */

function renderFriends() {
	$("friendCount").textContent = `${state.friends.length} 条`;
	const rows = state.friends.map(
		(f, i) => `<div class="friend-row${f.enabled ? "" : " off"}" data-i="${i}">
			<div class="friend-head">
				<img src="${esc(f.imgurl)}" alt="" />
				<strong class="grow">${esc(f.title || "(未命名)")}</strong>
				<button type="button" class="btn" data-act="up">↑</button>
				<button type="button" class="btn" data-act="down">↓</button>
				<button type="button" class="btn danger" data-act="del">删除</button>
			</div>
			<div class="grid2">
				<div class="field"><label>站名 *<input type="text" data-k="title" value="${esc(f.title)}" /></label></div>
				<div class="field"><label>站点地址 *<input type="text" data-k="siteurl" value="${esc(f.siteurl)}" /></label></div>
				<div class="field"><label>头像图 URL<input type="text" data-k="imgurl" value="${esc(f.imgurl)}" /></label></div>
				<div class="field"><label>描述<input type="text" data-k="desc" value="${esc(f.desc)}" /></label></div>
				<div class="field"><label>标签（逗号分隔）<input type="text" data-k="tags" value="${esc((f.tags || []).join(", "))}" /></label></div>
				<div class="field"><label>权重（越大越靠前）<input type="number" data-k="weight" value="${Number(f.weight || 0)}" /></label></div>
			</div>
			<label class="inline"><input type="checkbox" data-k="enabled" ${f.enabled ? "checked" : ""} /> 启用</label>
		</div>`,
	);
	$("friendList").innerHTML =
		rows.join("") || '<p class="hint">还没有友链，点右上角「添加一条」。</p>';
	// 头像挂了就藏掉，免得一堆碎图标
	for (const img of $("friendList").querySelectorAll(".friend-head img")) {
		img.addEventListener("error", () => {
			img.style.visibility = "hidden";
		});
	}
}

function collectFriends() {
	return [...document.querySelectorAll(".friend-row")].map((row) => {
		const get = (k) => row.querySelector(`[data-k="${k}"]`);
		return {
			title: get("title").value,
			siteurl: get("siteurl").value,
			imgurl: get("imgurl").value,
			desc: get("desc").value,
			tags: get("tags")
				.value.split(",")
				.map((t) => t.trim())
				.filter(Boolean),
			weight: Number(get("weight").value),
			enabled: get("enabled").checked,
		};
	});
}

$("friendList").addEventListener("click", (e) => {
	const btn = e.target.closest("[data-act]");
	if (!btn) return;
	const i = Number(btn.closest(".friend-row").dataset.i);
	// 先从 DOM 收一遍，把用户尚未保存的编辑一起带上，否则增删会丢输入
	const list = collectFriends();
	const act = btn.dataset.act;
	if (act === "del") {
		if (!confirm(`删除友链「${list[i].title || ""}」？`)) return;
		list.splice(i, 1);
	} else if (act === "up" && i > 0) {
		[list[i - 1], list[i]] = [list[i], list[i - 1]];
	} else if (act === "down" && i < list.length - 1) {
		[list[i + 1], list[i]] = [list[i], list[i + 1]];
	}
	state.friends = list;
	renderFriends();
});

$("btnAddFriend").onclick = () => {
	state.friends = [
		...collectFriends(),
		{
			title: "",
			siteurl: "",
			imgurl: "",
			desc: "",
			tags: [],
			weight: 0,
			enabled: true,
		},
	];
	renderFriends();
};

$("btnSaveFriends").onclick = async () => {
	try {
		const r = await post("/api/friends/save", { friends: collectFriends() });
		await reload();
		toast(`已保存 ${r.count} 条友链`, "ok");
	} catch (err) {
		toast(err.message, "err");
	}
};

/* -------------------------------- 发布 -------------------------------- */

$("btnPublish").onclick = async () => {
	try {
		state.git = await api("/api/git");
		renderGit();
		if (state.git.clean) {
			toast("没有需要发布的内容改动", "err");
			return;
		}
		$("publishFiles").textContent = state.git.content.join("\n");
		$("othersWrap").classList.toggle("hidden", state.git.others.length === 0);
		$("publishOthers").textContent = state.git.others.join("\n");
		$("commitMsg").value = "content: 更新文章 / 动态 / 友链";
		$("publishDlg").showModal();
	} catch (err) {
		toast(err.message, "err");
	}
};

$("btnCancelPublish").onclick = () => $("publishDlg").close();

$("btnDoPublish").onclick = async () => {
	const btn = $("btnDoPublish");
	btn.disabled = true;
	btn.textContent = "推送中…";
	try {
		const r = await post("/api/git/publish", { message: $("commitMsg").value });
		$("publishDlg").close();
		await reload();
		toast(`已推送 ${r.files.length} 个文件，Cloudflare 开始部署`, "ok");
	} catch (err) {
		toast(err.message, "err");
	} finally {
		btn.disabled = false;
		btn.textContent = "提交并推送";
	}
};

/* -------------------------------- 切页 -------------------------------- */

for (const tab of document.querySelectorAll(".tab")) {
	tab.onclick = () => {
		for (const t of document.querySelectorAll(".tab")) {
			t.classList.toggle("on", t === tab);
		}
		for (const name of ["posts", "dynamics", "friends"]) {
			$(`tab-${name}`).classList.toggle("hidden", name !== tab.dataset.tab);
		}
	};
}

$("btnReload").onclick = () => {
	reload().then(() => toast("已刷新", "ok"));
};

// Ctrl/Cmd+S 保存当前页签的内容
document.addEventListener("keydown", (e) => {
	if (!(e.ctrlKey || e.metaKey) || e.key !== "s") return;
	e.preventDefault();
	if (!$("tab-posts").classList.contains("hidden")) $("btnSavePost").click();
	else if (!$("tab-dynamics").classList.contains("hidden"))
		$("btnSaveDyn").click();
	else $("btnSaveFriends").click();
});

reload().catch((err) => toast(`加载失败：${err.message}`, "err"));
