#!/usr/bin/env node
// 把住宿查询的 JSON 渲染成一个独立的 HTML 文件（样式和脚本都内联，离线也能打开）。
// 用法：node render.mjs <stay.json> [输出.html]
// 不需要安装任何依赖，Node 18+ 即可。
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.join(here, "..", "template");

const [, , input, outputArg] = process.argv;
if (!input) {
  console.error("用法：node render.mjs <stay.json> [输出.html]");
  process.exit(1);
}

let data;
try {
  data = JSON.parse(await readFile(input, "utf8"));
} catch (e) {
  console.error(`JSON 解析失败：${e.message}`);
  process.exit(1);
}

const problems = validate(data);
if (problems.length) {
  console.error("JSON 不符合格式要求：\n- " + problems.join("\n- "));
  process.exit(1);
}

const [shell, style, script] = await Promise.all(
  ["shell.html", "style.css", "render.js"].map((f) => readFile(path.join(templateDir, f), "utf8"))
);

// 防止 JSON 里的 "</script" 提前结束 <script> 标签
const json = JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
const html = shell
  .replace("{{TITLE}}", () => escapeHtml(data.title))
  .replace("{{STYLE}}", () => style)
  .replace("{{DATA}}", () => json)
  .replace("{{SCRIPT}}", () => script);

const output = outputArg || input.replace(/\.json$/i, "") + ".html";
await writeFile(output, html, "utf8");
console.log(`已生成 ${output}（${data.stays.length} 家住宿，${(data.hikes || []).length} 条路线，${Buffer.byteLength(html)} 字节）`);

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// 只检查渲染必需的字段；完整格式见 schema/stay.schema.json
function validate(d) {
  const p = [];
  if (typeof d !== "object" || d === null || Array.isArray(d)) return ["顶层必须是一个对象"];
  for (const k of ["title", "town", "queriedAt"]) {
    if (typeof d[k] !== "string" || !d[k]) p.push(`缺少字符串字段 ${k}`);
  }
  if (d.budget && typeof d.budget.perNight !== "number") p.push("budget.perNight 必须是数字");
  if (!Array.isArray(d.stays)) {
    p.push("stays 必须是数组（一家都没有时写 []）");
    return p;
  }
  d.stays.forEach((s, i) => {
    const id = `住宿 ${i + 1}`;
    if (!s || typeof s !== "object") return p.push(`stays[${i}] 必须是对象`);
    if (!s.name) p.push(`${id} 缺少 name`);
    if (!s.town) p.push(`${id} 缺少 town`);
    (s.prices || []).forEach((x, j) => {
      if (!x.channel) p.push(`${id} 的 prices[${j}] 缺少 channel`);
      if (typeof x.perNight !== "number") p.push(`${id} 的 prices[${j}].perNight 必须是数字`);
      if (x.total != null && typeof x.total !== "number") p.push(`${id} 的 prices[${j}].total 必须是数字`);
    });
  });
  (d.towns || []).forEach((t, i) => { if (!t.name) p.push(`towns[${i}] 缺少 name`); });
  (d.hikes || []).forEach((h, i) => {
    if (!h.name) p.push(`hikes[${i}] 缺少 name`);
    if (h.difficulty && !["easy", "moderate", "hard"].includes(h.difficulty)) p.push(`hikes[${i}] 的 difficulty 只能是 easy / moderate / hard`);
  });
  (d.activities || []).forEach((g, i) => { if (!g.sport) p.push(`activities[${i}] 缺少 sport`); });
  return p;
}
