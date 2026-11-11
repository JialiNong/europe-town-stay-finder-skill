#!/usr/bin/env node
// Render a stay search JSON file into one standalone HTML page (styles and script inlined, works offline).
// 把住宿查询的 JSON 渲染成一个独立的 HTML 文件（样式和脚本都内联，离线也能打开）。
// Usage / 用法: node render.mjs <stay.json> [output.html]
// No dependencies, Node 18+.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const templateDir = path.join(here, "..", "template");

const [, , input, outputArg] = process.argv;
if (!input) {
  console.error("Usage: node render.mjs <stay.json> [output.html]");
  process.exit(1);
}

let data;
try {
  data = JSON.parse(await readFile(input, "utf8"));
} catch (e) {
  console.error(`Could not parse JSON: ${e.message}`);
  process.exit(1);
}

const problems = validate(data);
if (problems.length) {
  console.error("The JSON does not match the expected format:\n- " + problems.join("\n- "));
  process.exit(1);
}

const [shell, style, script] = await Promise.all(
  ["shell.html", "style.css", "render.js"].map((f) => readFile(path.join(templateDir, f), "utf8"))
);

// Escape "</" so text inside the JSON can never close the <script> tag early.
const json = JSON.stringify(data, null, 2).replace(/<\//g, "<\\/");
const parts = { TITLE: escapeHtml(text(data.title, data.lang) || text(data.town, data.lang)), STYLE: style, DATA: json, SCRIPT: script };
// One pass over the shell, so placeholder-like text inside the data is never replaced.
const html = shell.replace(/\{\{(TITLE|STYLE|DATA|SCRIPT)\}\}/g, (_, k) => parts[k]);

const output = outputArg || input.replace(/\.json$/i, "") + ".html";
await writeFile(output, html, "utf8");
console.log(`Wrote ${output} (${`${data.stays.length} stays, ${(data.hikes || []).length} hikes`}, ${Buffer.byteLength(html)} bytes)`);

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
// A text field is a non-empty string or a localized object such as {"zh": "…", "en": "…"}.
function isLoc(v) {
  return !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length > 0 &&
    Object.keys(v).every((k) => k === "zh" || k === "en");
}
function isText(v) {
  return (typeof v === "string" && v !== "") || (isLoc(v) && Object.values(v).some((x) => typeof x === "string" && x !== ""));
}
function text(v, lang) {
  if (typeof v === "string") return v;
  if (isLoc(v)) return v[lang === "en" ? "en" : "zh"] || v.zh || v.en || "";
  return "";
}
function isNum(v) { return typeof v === "number" && Number.isFinite(v); }

// Only checks what rendering needs; see schema/stay.schema.json for the full format.
function validate(d) {
  const p = [];
  if (typeof d !== "object" || d === null || Array.isArray(d)) return ["the top level must be an object"];
  for (const k of ["title", "town", "queriedAt"]) {
    if (!isText(d[k])) p.push(`missing text field "${k}"`);
  }
  if (d.lang != null && !["zh", "en"].includes(d.lang)) p.push('"lang" must be "zh" or "en"');
  if (d.languages != null && (!Array.isArray(d.languages) || d.languages.some((l) => !["zh", "en"].includes(l)))) p.push('"languages" must be an array of "zh" / "en"');
  if (d.budget && !isNum(d.budget.perNight)) p.push("budget.perNight must be a number");
  if (!Array.isArray(d.stays)) {
    p.push('"stays" must be an array (use [] when nothing qualifies)');
    return p;
  }
  d.stays.forEach((s, i) => {
    const id = `stay ${i + 1}`;
    if (!s || typeof s !== "object") return p.push(`stays[${i}] must be an object`);
    if (!isText(s.name)) p.push(`${id}: missing name`);
    if (!isText(s.town)) p.push(`${id}: missing town`);
    (s.prices || []).forEach((x, j) => {
      if (!isText(x.channel)) p.push(`${id}: prices[${j}] is missing channel`);
      if (!isNum(x.perNight)) p.push(`${id}: prices[${j}].perNight must be a number`);
      if (x.total != null && !isNum(x.total)) p.push(`${id}: prices[${j}].total must be a number`);
    });
  });
  (d.towns || []).forEach((t, i) => { if (!isText(t.name)) p.push(`towns[${i}] is missing name`); });
  (d.hikes || []).forEach((h, i) => {
    if (!isText(h.name)) p.push(`hikes[${i}] is missing name`);
    if (h.difficulty && !["easy", "moderate", "hard"].includes(h.difficulty)) p.push(`hikes[${i}]: difficulty must be easy / moderate / hard`);
  });
  (d.activities || []).forEach((g, i) => { if (!isText(g.sport)) p.push(`activities[${i}] is missing sport`); });
  return p;
}
