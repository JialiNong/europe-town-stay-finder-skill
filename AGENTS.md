# AGENTS.md

这个仓库是一个给 AI agent 用的「欧洲小镇住宿与周边玩法」skill。Cursor、Codex、Gemini CLI、Claude Code 等会自动读这个文件。

## 用户问去某个小镇住哪、周边有什么可玩时

1. 读 `europe-town-stay-finder/SKILL.md`，按里面第 0–6 步做。
2. 读 `europe-town-stay-finder/profile.md`，这是用户的固定情况（有没有车、车票、折扣卡、订房平台会员）。
3. 查完后按 `europe-town-stay-finder/schema/stay.schema.json` 写一份 JSON，存到 `stays/<小镇>-<日期>.json`。照着 `europe-town-stay-finder/examples/garmisch-2027-01.json` 写。
4. 渲染成页面，不要手写 HTML：

   ```bash
   node europe-town-stay-finder/scripts/render.mjs stays/<文件名>.json
   # 或者
   python3 europe-town-stay-finder/scripts/render.py stays/<文件名>.json
   ```

5. 把生成的 `stays/<文件名>.html` 路径告诉用户，并用几句话总结推荐的住宿和村镇。

## 规则

- 回复和页面都用中文（除非用户换了语言）。
- 价格、评分、时刻必须是实时查到的，并写明来源和查询时间；查不到就写「未能查到」，不要估。
- 不下单，不填写个人或支付信息，遇到验证码或登录不要绕过。
- 改页面样式时只改 `europe-town-stay-finder/template/`，改完运行 `npm run example` 用示例重新渲染检查一遍。
