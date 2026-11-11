#!/usr/bin/env python3
"""Render a stay search JSON file into one standalone HTML page (styles and script inlined, works offline).
把住宿查询的 JSON 渲染成一个独立的 HTML 文件（样式和脚本都内联，离线也能打开）。

Usage / 用法: python3 render.py <stay.json> [output.html]
Standard library only, so it also runs in sandboxes without Node (e.g. ChatGPT's code interpreter).
"""
import html
import json
import re
import sys
from pathlib import Path

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "template"


def is_loc(v):
    return isinstance(v, dict) and len(v) > 0 and all(k in ("zh", "en") for k in v)


def is_text(v):
    """A text field is a non-empty string or a localized object such as {"zh": "…", "en": "…"}."""
    return (isinstance(v, str) and v != "") or (is_loc(v) and any(isinstance(x, str) and x for x in v.values()))


def text(v, lang=None):
    if isinstance(v, str):
        return v
    if is_loc(v):
        return v.get("en" if lang == "en" else "zh") or v.get("zh") or v.get("en") or ""
    return ""


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def validate(d):
    """Only checks what rendering needs; see schema/stay.schema.json for the full format."""
    p = []
    if not isinstance(d, dict):
        return ["the top level must be an object"]
    for k in ("title", "town", "queriedAt"):
        if not is_text(d.get(k)):
            p.append(f'missing text field "{k}"')
    if d.get("lang") is not None and d["lang"] not in ("zh", "en"):
        p.append('"lang" must be "zh" or "en"')
    langs = d.get("languages")
    if langs is not None and (not isinstance(langs, list) or any(x not in ("zh", "en") for x in langs)):
        p.append('"languages" must be an array of "zh" / "en"')
    if d.get("budget") and not is_num(d["budget"].get("perNight")):
        p.append("budget.perNight must be a number")
    stays = d.get("stays")
    if not isinstance(stays, list):
        p.append('"stays" must be an array (use [] when nothing qualifies)')
        return p
    for i, s in enumerate(stays):
        sid = f"stay {i + 1}"
        if not isinstance(s, dict):
            p.append(f"stays[{i}] must be an object")
            continue
        if not is_text(s.get("name")):
            p.append(f"{sid}: missing name")
        if not is_text(s.get("town")):
            p.append(f"{sid}: missing town")
        for j, x in enumerate(s.get("prices") or []):
            if not is_text(x.get("channel")):
                p.append(f"{sid}: prices[{j}] is missing channel")
            if not is_num(x.get("perNight")):
                p.append(f"{sid}: prices[{j}].perNight must be a number")
            if x.get("total") is not None and not is_num(x.get("total")):
                p.append(f"{sid}: prices[{j}].total must be a number")
    for i, t in enumerate(d.get("towns") or []):
        if not is_text(t.get("name")):
            p.append(f"towns[{i}] is missing name")
    for i, h in enumerate(d.get("hikes") or []):
        if not is_text(h.get("name")):
            p.append(f"hikes[{i}] is missing name")
        if h.get("difficulty") and h["difficulty"] not in ("easy", "moderate", "hard"):
            p.append(f"hikes[{i}]: difficulty must be easy / moderate / hard")
    for i, g in enumerate(d.get("activities") or []):
        if not is_text(g.get("sport")):
            p.append(f"activities[{i}] is missing sport")
    return p


def main():
    if len(sys.argv) < 2:
        sys.exit("Usage: python3 render.py <stay.json> [output.html]")
    src = Path(sys.argv[1])
    try:
        data = json.loads(src.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        sys.exit(f"Could not parse JSON: {e}")
    problems = validate(data)
    if problems:
        sys.exit("The JSON does not match the expected format:\n- " + "\n- ".join(problems))

    shell = (TEMPLATE_DIR / "shell.html").read_text(encoding="utf-8")
    style = (TEMPLATE_DIR / "style.css").read_text(encoding="utf-8")
    script = (TEMPLATE_DIR / "render.js").read_text(encoding="utf-8")
    # Escape "</" so text inside the JSON can never close the <script> tag early.
    payload = json.dumps(data, ensure_ascii=False, indent=2).replace("</", "<\\/")
    lang = data.get("lang")
    title = text(data.get("title"), lang) or text(data.get('town'), lang)
    parts = {"TITLE": html.escape(title), "STYLE": style, "DATA": payload, "SCRIPT": script}
    # One pass over the shell, so placeholder-like text inside the data is never replaced.
    out = re.sub(r"\{\{(TITLE|STYLE|DATA|SCRIPT)\}\}", lambda m: parts[m.group(1)], shell)
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.with_suffix(".html")
    dst.write_text(out, encoding="utf-8")
    print(f"Wrote {dst} ({len(data['stays'])} stays, {len(data.get('hikes') or [])} hikes, {len(out.encode('utf-8'))} bytes)")


if __name__ == "__main__":
    main()
