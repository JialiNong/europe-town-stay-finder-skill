#!/usr/bin/env python3
"""把住宿查询的 JSON 渲染成一个独立的 HTML 文件（样式和脚本都内联，离线也能打开）。

用法：python3 render.py <stay.json> [输出.html]
只用 Python 标准库，适合没有 Node 的环境（例如 ChatGPT 的代码解释器）。
"""
import html
import json
import sys
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "template"


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def validate(d):
    """只检查渲染必需的字段；完整格式见 schema/stay.schema.json。"""
    p = []
    if not isinstance(d, dict):
        return ["顶层必须是一个对象"]
    for k in ("title", "town", "queriedAt"):
        if not isinstance(d.get(k), str) or not d.get(k):
            p.append(f"缺少字符串字段 {k}")
    if d.get("budget") and not is_num(d["budget"].get("perNight")):
        p.append("budget.perNight 必须是数字")
    stays = d.get("stays")
    if not isinstance(stays, list):
        p.append("stays 必须是数组（一家都没有时写 []）")
        return p
    for i, s in enumerate(stays):
        sid = f"住宿 {i + 1}"
        if not isinstance(s, dict):
            p.append(f"stays[{i}] 必须是对象")
            continue
        if not s.get("name"):
            p.append(f"{sid} 缺少 name")
        if not s.get("town"):
            p.append(f"{sid} 缺少 town")
        for j, x in enumerate(s.get("prices") or []):
            if not x.get("channel"):
                p.append(f"{sid} 的 prices[{j}] 缺少 channel")
            if not is_num(x.get("perNight")):
                p.append(f"{sid} 的 prices[{j}].perNight 必须是数字")
            if x.get("total") is not None and not is_num(x.get("total")):
                p.append(f"{sid} 的 prices[{j}].total 必须是数字")
    for i, t in enumerate(d.get("towns") or []):
        if not t.get("name"):
            p.append(f"towns[{i}] 缺少 name")
    for i, h in enumerate(d.get("hikes") or []):
        if not h.get("name"):
            p.append(f"hikes[{i}] 缺少 name")
        if h.get("difficulty") and h["difficulty"] not in ("easy", "moderate", "hard"):
            p.append(f"hikes[{i}] 的 difficulty 只能是 easy / moderate / hard")
    for i, g in enumerate(d.get("activities") or []):
        if not g.get("sport"):
            p.append(f"activities[{i}] 缺少 sport")
    return p


def main():
    if len(sys.argv) < 2:
        print("用法：python3 render.py <stay.json> [输出.html]", file=sys.stderr)
        sys.exit(1)
    src = Path(sys.argv[1])
    try:
        data = json.loads(src.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"JSON 解析失败：{e}", file=sys.stderr)
        sys.exit(1)
    problems = validate(data)
    if problems:
        print("JSON 不符合格式要求：\n- " + "\n- ".join(problems), file=sys.stderr)
        sys.exit(1)

    shell = (TEMPLATE_DIR / "shell.html").read_text(encoding="utf-8")
    style = (TEMPLATE_DIR / "style.css").read_text(encoding="utf-8")
    script = (TEMPLATE_DIR / "render.js").read_text(encoding="utf-8")
    # 防止 JSON 里的 "</script" 提前结束 <script> 标签
    payload = json.dumps(data, ensure_ascii=False, indent=2).replace("</", "<\\/")
    out_html = (
        shell.replace("{{TITLE}}", html.escape(data["title"]))
        .replace("{{STYLE}}", style)
        .replace("{{DATA}}", payload)
        .replace("{{SCRIPT}}", script)
    )
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".html")
    out.write_text(out_html, encoding="utf-8")
    print(f"已生成 {out}（{len(data['stays'])} 家住宿，{len(data.get('hikes') or [])} 条路线，{len(out_html.encode())} 字节）")


if __name__ == "__main__":
    main()
