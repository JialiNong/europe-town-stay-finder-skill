---
name: "europe-town-stay-finder"
description: "在欧洲给一个想去的小镇找住宿：把核心小镇和公交 1 小时内直达（最多换乘 1 次）的周边村镇一起搜，按每晚预算对比 Booking 和 Airbnb（评分、评价数门槛），不够 5 家再查 Google 和当地民宿；顺便整理小镇周边的户外运动（攀岩、滑雪、徒步、滑翔伞等）的教练和团体，以及 komoot 上高分徒步路线，用固定模板输出对比页。用户问去某个小镇住哪、周边村子住宿、小镇附近有什么可玩时使用。"
---

# 欧洲小镇住宿与周边玩法（Europe Town Stay Finder）

## 为什么需要这个 skill

想去的小镇常常住宿少、或者贵，但它周边公交能直达的村子也有很多住宿，价格差不多甚至更便宜，住在那里每天坐车过去一样方便。例如：

- **加尔米施-帕滕基兴（Garmisch-Partenkirchen）**：周边的 Grainau、Mittenwald、Gerold（Krün 附近）等都在公交/区域火车范围内，住那里也很合适。
- **霞慕尼（Chamonix）**：同一个山谷里的 Les Houches、Argentière、Vallorcine，以及 Saint-Gervais-les-Bains / Le Fayet 都可以作为住宿点。

平时要手动在 Booking、Airbnb、Google 地图和各家官网之间来回对比价格和评价。这个 skill 的思路是：**先画出「核心小镇 + 公交 1 小时圈」，再在圈内每个村镇按同样的门槛搜 Booking 和 Airbnb，不够就补充 Google 和当地民宿；最后把核心小镇周边的户外运动、教练和团体、komoot 高分徒步路线一起整理出来。**

回复和 HTML 页面都用中文。

## 用户的固定情况

开始前先读同目录下的 **`profile.md`**：里面是用户有没有车、持有的车票和折扣卡、订房平台的会员等级等。下面各步说到「用户的固定情况」都指这个文件。没有 `profile.md` 时，在第 0 步一起问用户。

怎么从出发地去核心小镇，不在这个 skill 的范围内，用 [europe-route-finder](https://github.com/JialiNong/europe-route-finder-skill) 查；这个 skill 只管「到了之后住哪、玩什么」。

## 第 0 步：确认输入

| 项 | 说明 | 缺失时 |
|---|---|---|
| 核心小镇 | 例如 Garmisch-Partenkirchen、Chamonix | 必须问 |
| 入住 / 退房日期 | 决定价格，也决定季节（滑雪季、夏季徒步季、淡季） | 必须问 |
| 每晚预算 | 住宿每晚的总价（含清洁费、服务费、税；城市税/Kurtaxe 单独标出） | 必须问 |
| 人数 | | 默认 1 人 |
| 房型 | 整套公寓 / 独立房间 / 青旅床位 / 都可以 | 默认都看，在结果里标明房型 |
| 硬性要求 | 例如必须有厨房、要早餐 | 没说就不加 |
| 想做的运动 | 攀岩、滑雪、徒步、滑翔伞等 | 默认按季节把适合的都看一遍 |

把缺的项合并成一次提问（AskUserQuestion），不要一项一项问。有合理默认值的就直接用，并在结果里写明。

**必须有厨房时**：独立房间能用房东的厨房也算，但要在房源页的描述或设施里看到写明，只靠搜索筛选不够。青旅要有客用厨房（Gästeküche / guest kitchen），只含早餐的不算。

**预算区间**：每晚预算 ×0.9 – ×1.1 是「预算内」；×0.8 – ×0.9 和 ×1.1 – ×1.2 是「浮动区间」，也列出但标出来；超过 ×1.2 的不列。每晚价格 = 全部住宿天数的总价（含所有费用）÷ 晚数，不要用平台列表页上不含费用的单晚价。

## 第 1 步：画出「公交 1 小时圈」

1. **列候选村镇**：核心小镇所在的山谷、同一条铁路线、同一条公交线上的村镇，以及当地旅游区（例如 Zugspitz-Region、Vallée de Chamonix）包含的村镇。也看相邻国家：边境附近的小镇可能也在圈内。
2. **用 Google 地图公交模式逐个查**「候选村镇 ↔ 核心小镇」两个方向，选入住期间的日期和白天的出发时间：
   - 单程 **≤ 60 分钟**（含步行到站的时间）。
   - **直达优先，最多换乘 1 次**；换乘 2 次及以上的村镇排除。
   - 记下：车型（区域火车 / 公交）、单程时长、换乘次数、**白天每小时几班**、**晚上从核心小镇回村的末班车时间**、周末和淡季班次是否减少、单程票价（D-Ticket 覆盖的写 0€）。
   - **火车班次批量查**：用 ÖBB 时刻表 fahrplan.oebb.at（含 DB 的数据，通常已经有下一个时刻表年度的班次）。在它的页面里用自己的接口查：先用 `/bin/ajax-getstop.exe/dn?REQ0JourneyStopsS0A=1&REQ0JourneyStopsS0G=<站名>?` 拿车站 ID（德语变音字母用 `escape()` 编码，返回按 latin1 解码），再用 `/bin/query.exe/dn?SID=<A=1@O=站名@L=ID@>&ZID=…&date=DD.MM.YYYY&time=HH:MM&timesel=depart&start=1` 查，解析结果表里每行的出发、到达、时长、换乘次数。每次查询约 10–15 秒，放到后台跑、把结果存在 `window` 变量里，再分几次取，不要在一次调用里等全部结果。查三个时段：上午（看班次和时长）、晚上 21:30（看末班车）、反方向早上。
   - **ÖBB 时刻表里没有很多德国当地公交**（例如 RVO 的 Krün、Wallgau、Oberammergau 线路），查不到不代表没有车：只通公交的村子一定要再用 Google 地图公交模式查。
   - 地址格式：`https://www.google.com/maps/dir/<起点>/<终点>/data=!4m6!4m5!2m3!6e0!7e2!8j<秒>!3e3?hl=en`，`<秒>` 是把当地出发时间当作 UTC 算出的 Unix 时间戳，`!3e3` 是公交模式。结果列表文字读不到时，截图放大看。出现「We don't have the most recent timetables」时，去当地交通官网（例如 DB、RVO、SNCF / TER、cars Région、ÖBB / VVT）核实时刻。
3. **查游客卡（Gästekarte / Kurkarte / carte d'hôte）**：很多阿尔卑斯地区住宿时会发游客卡，凭卡免费坐当地公交，有的连区域火车也免费（例如霞慕尼山谷），还常带免费的导览徒步、缆车折扣。查清每个村的游客卡包括哪些交通和活动，以及每晚要交多少城市税/Kurtaxe——这会改变「住哪个村最划算」。以当地旅游局官网为准。
4. 选出核心小镇 + 3–7 个周边村镇进入下一步。被排除的村镇（超过 1 小时、要换乘 2 次、末班车太早）写进页面的「排除」里，一句话说明原因。
5. **记每个村镇的坐标**：在 Google 地图搜村镇名，从地址栏或分享链接读纬度、经度（形如 `@47.4919,11.0958,...` 里前两个数字），写进 `towns[].lat` / `lng`，页面会据此画一张住宿地图。查不到就不写这两个字段，地图会跳过这个点，不影响其他内容。

## 第 2 步：在每个村镇搜 Booking 和 Airbnb

### 硬性条件

| 平台 | 评分 | 评价数 |
|---|---|---|
| Booking | ≥ 8.0（满分 10） | ≥ 15 条 |
| Airbnb | ≥ 4.5（满分 5） | ≥ 15 条（显示「New」或不足 15 条的不算） |

加上：每晚总价在预算区间内（见第 0 步）。

**每个村镇单独搜**（平台按城市名搜索时常常把周边也混进来，所以每家都要记下它实际在哪个村、离哪个车站多近）。

### Booking

- 搜索页：`https://www.booking.com/searchresults.en-gb.html?ss=<村镇名>&checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&group_adults=1&no_rooms=1&group_children=0&selected_currency=EUR&nflt=review_score%3D80&order=price`。需要厨房时 nflt 写成 `review_score%3D80%3Broomfacility%3D999`。`order=price` 按全程总价从低到高排，列表里显示的是全程总价，不是每晚。
- **核对页面标题**：Booking 会把小村名自动换成别的地方（例如「Oberau」被识别成 Oberaudorf），标题里的地名不对就换写法（加州名、邮编）重搜，还不对就写「未能查到」。
- 进每家的属性页确认：评分和评价数、所选日期的最终总价（含税费；注意「不含城市税」的提示）、取消政策、是否含早餐、房型。
- 记录它离最近的火车站/公交站步行多久（属性页的位置地图或 Google 地图）。

### Airbnb

- 搜索 `https://www.airbnb.com/s/<村镇名>--<国家>/homes?checkin=YYYY-MM-DD&checkout=YYYY-MM-DD&adults=<人数>&currency=EUR&price_max=<全程总价上限>&price_filter_input_type=2&price_filter_num_nights=<晚数>`，需要厨房时加 `&amenities%5B%5D=8`。列表上显示的是全程总价（含费用）。
- Airbnb 的搜索范围很大，结果里经常一半在 1 小时圈外（例如搜 Garmisch 会出来 Füssen、Schongau）。按第 1 步的村镇名单逐家筛掉圈外的。
- 进房源页确认评分、评价数、总价（含清洁费和服务费）、房型（整套 / 独立房间 / 合住）、取消政策。
- Airbnb 只显示大概位置，到车站的距离写「约」，并注明。

### 共同规则

- **到车站的步行距离**：≤ 15 分钟正常列出；15–25 分钟标出来；超过 25 分钟降到「差点入选」，因为用户没有车。
- **同一房源多渠道比价**：排名靠前的房源（约前 5 家）检查它是否同时在 Booking、Airbnb 上架，以及有没有自己的官网（小旅馆、Pension、Gasthof、chambre d'hôte 常有）。官网直订常常更便宜或含早餐，三个价格都写上，标出最便宜的渠道。
- 评分、价格明显异常的房源（例如 1€、1000€、刚上架的）跳过。
- 遇到验证码、要登录或被拦截：不要绕过，不要在页面里批量调用平台接口，标记「未能查到」并给出搜索链接让用户自己看。
- **绝不下单，不填写个人或支付信息。**
- 控制工作量：每个村镇每个平台看前 5–10 个符合条件的结果就够。
- **住宿坐标（可选）**：房源页的地图通常能读到大致坐标（放大地图、看页面地址或源码里的 lat/lng），写进 `stays[].lat` / `lng`，住宿地图上会单独标出来，比只有村镇坐标更准；查不到就留空，地图自动退回用村镇坐标。

## 第 3 步：不够 5 家时补充搜索

如果符合全部硬性条件的房源**总数不到 5 家**，再查：

1. **Google 地图**：在每个村镇搜 hotel / Pension / Gasthof / Ferienwohnung / chambre d'hôte / gîte，默认门槛 Google 评分 ≥ 4.3 且 ≥ 15 条评价（这条门槛是默认值，用户没指定，要在页脚写明）。点进去看 Google 给出的价格和官网链接。
2. **当地旅游局官网的住宿搜索**：德国、奥地利常见「Gastgeberverzeichnis / Unterkünfte」，法国 office de tourisme 的「hébergements」，常能找到不上 Booking 和 Airbnb 的家庭民宿和公寓。
3. **度假屋平台**：德国用 traum-ferienwohnungen.de（私人房东的 Ferienwohnung 很多不上 Booking 和 Airbnb），搜索结果页加 `&sort=price_asc` 按价格排；法国看 Gîtes de France。
4. **当地知名民宿、青旅**：搜「<村镇> bekannte Pension」「<village> chambre d'hôte」「hostel <town>」，以及 Hostelworld。
5. 直接去这些房源的官网看所选日期的价格；官网只有价目表、没有在线房态的，写「需邮件/电话询问」，并给出联系方式。

**差点入选**：Booking 7.5–7.9、Airbnb 4.3–4.49、评价数 10–14 条、或者价格在 ×1.2 – ×1.3 的房源，可以单独放进「差点入选」，写清楚差在哪一条。不要把它们混进正式结果里。

**一家都没有符合全部条件时**：在结论第一句就说清楚，并说出这次的「市场底价」（例如「圈内有厨房、评分达标的最低约 62€/晚」）。然后把最接近的 4–6 家放进住宿列表，每家的 `tag` 写它的特点（最接近、整套公寓、住在本镇……），差在哪一条写进 `summary` 或 `notes`；预算内但评价数不够之类的放进「差点入选」，并在结论里点名。Booking 的房源离预算不远时，算出需要多大的 Genius 折扣才能进区间（例如「8% 以上就能进 60€ 以内」）。

## 第 4 步：核心小镇周边的户外运动

按入住日期判断季节，列出核心小镇周边（以及推荐住宿的村镇附近）能做的运动，例如：攀岩（户外岩场、攀岩馆）、滑雪/单板、越野滑雪、徒步、via ferrata（铁索攀登）、滑翔伞（双人飞行、课程）、山地车、冰攀、滑雪登山（skitouring）、漂流等。

### 怎么搜

用当地语言加英文搜。通用的网页搜索工具对当地小机构结果很少时，在浏览器里用 google.com 搜德语 / 法语关键词，效果好得多。例如：

| 运动 | 德语 | 法语 | 英语 |
|---|---|---|---|
| 攀岩 | Klettern Kurs, Kletterhalle, Boulderhalle, Klettergebiet | escalade cours, salle d'escalade, site d'escalade | climbing course |
| 向导/登山学校 | Bergschule, Alpinschule, Bergführer | guide de haute montagne, compagnie des guides | mountain guide |
| 滑雪 | Skischule, Skikurs Erwachsene | école de ski (ESF / ESI), cours adulte | ski school adults |
| 滑雪登山 | Skitourenkurs Einsteiger | cours ski de randonnée | ski touring course |
| 越野滑雪 | Langlaufkurs, Langlaufschule | cours ski de fond | cross-country ski lesson |
| 雪鞋徒步 | geführte Schneeschuhwanderung | sortie raquettes accompagnée | guided snowshoe hike |
| 滑翔伞 | Gleitschirm Tandem, Gleitschirmschule | parapente biplace, école de parapente | paragliding tandem |
| via ferrata | Klettersteig geführt | via ferrata guidée | guided via ferrata |
| 徒步团体 | geführte Wanderung, Wandergruppe | randonnée accompagnée | guided hike, hiking group |

### 去哪找

- 当地旅游局官网的活动/体验页，以及游客卡附带的**免费导览活动（Gästeprogramm / programme d'animations）**。
- 登山学校、向导公司、滑雪学校、滑翔伞学校的官网；CheckYeti 上常有课程起价和评价。
- 阿尔卑斯协会当地分会（德国 DAV、奥地利 ÖAV、瑞士 SAC、法国 CAF、意大利 CAI）：常有团体活动，很多要求是会员，写清楚。
- 团体：Meetup、Facebook 群组、攀岩馆的找搭档板（Partnerbörse）。
- 用 Google 地图看这些机构的评分和评价数。

### 每项记录

运动类型、机构/教练/团体名字、在哪（离哪个村镇近、坐公交能不能到）、适合水平（入门 / 进阶）、价格（查得到的话）、季节和开放时间、怎么预约、是否有英语、官网链接。只列能找到官网或联系方式的；同一运动列 2–4 家就够。能在 Google 地图上定位到具体地点（教练集合点、滑雪学校门店、攀岩馆）时顺便记下坐标，写进 `activities[].items[].lat` / `lng`（可选），页面会画一张运动地图。

## 第 5 步：komoot 高分徒步路线

1. 对核心小镇和推荐住宿的村镇，搜「komoot hiking around <小镇>」，打开 komoot 的路线指南页（形如 `https://www.komoot.com/guide/<编号>/hiking-around-<小镇>`）。每条路线会显示**评分和评分人数**（例如「4.8 (7857)」）、难度、距离、时长、爬升。英文页的距离和爬升是英里和英尺，换算成公里和米。
2. **挑选**：优先评分 ≥ 4.5，并且评分人数在这个地区里排在前面的。不同地区热度差别很大，不设固定的人数门槛，而是按「这个地区里评分高、人数也多」相对地挑；把评分和人数都写出来。每个地区挑 3–6 条，总共 5–12 条，难度尽量覆盖简单到困难。
3. **公交能不能到起点**：点进路线页看起点，用 Google 地图公交模式查从推荐住宿的村镇过去要多久。环线最方便；单程路线要写清楚终点怎么坐车回去。起点只能开车到的，标出来或不列。顺便记下起点坐标（komoot 路线页地图上能看到，放大点一下读 URL 里的经纬度），写进 `hikes[].lat` / `lng`（可选），页面会画一张路线地图。
4. **季节**：入住日期在冬季或春季时，高海拔路线可能有积雪或关闭，山屋和缆车可能停运（很多缆车 11 月和春季有检修停运期），很多峡谷冬季整段封闭（例如 Höllentalklamm、Leutascher Geisterklamm），要去官网核实并标出来，优先挑低海拔或冬季徒步（Winterwanderweg / sentier raquettes）路线。也顺便看一下路线上有没有施工封路的公告。
5. 也可以参考 komoot 的 Highlights（显示「X% 推荐，N 人」）来补充景点。

## 第 6 步：输出 JSON，用固定模板渲染对比页

页面的样式和排版已经固定在 `template/` 里，**不要手写 HTML 和 CSS**。你只需要按 `schema/stay.schema.json` 写一份 JSON，再用脚本把它渲染成页面。这样每次输出的只有数据，省 token，页面也每次一致。

- 格式见 `schema/stay.schema.json`，完整的真实示例见 `examples/garmisch-2027-01.json`（Garmisch 及周边，2027 年 1 月，每晚 50€、要厨房）。不确定字段怎么写时，照着示例写。
- 文件名用小镇名和日期，例如 `garmisch-2027-01.json`。

### 渲染

在 skill 目录下运行（二选一，都不需要安装依赖）：

```bash
node scripts/render.mjs path/to/garmisch-2027-01.json      # Node 18+
python3 scripts/render.py path/to/garmisch-2027-01.json    # 只用标准库
```

生成的 HTML 是一个独立文件：样式和脚本都已内联，直接用浏览器打开，或发给别人。脚本会先检查必需字段，有问题会报出是哪一家住宿的哪个字段；页面上出现红框「住宿页渲染失败」也说明 JSON 写错了。

**地图**：只要 JSON 里 `towns[]` / `stays[]` / `activities[].items[]` / `hikes[]` 有 `lat`/`lng`，页面会自动画出「住宿地图」「户外运动地图」「komoot 路线地图」（Leaflet + OpenStreetMap，打开页面要联网加载瓦片）；没坐标的类别就不画。**导出 PDF**：页面右上角自带「导出 / 打印 PDF」按钮，调浏览器自己的打印功能，用户点一下、打印对话框里选「另存为 PDF」即可。两者都不需要额外操作，只要第 1/2/4/5 步按说明顺手记一下坐标。

### 交给用户

- **Claude（claude.ai / Claude 桌面端 / Claude Code）**：把渲染出的 HTML 用 Artifact 发布（同一次查询改版时发布到同一个链接，并把 `version` 加 1）。不需要再加载 `artifact-design` skill。
  - 如果当前环境里没有 `scripts/`（例如只上传了 SKILL.md）：写一个页面外壳，把 JSON 放进 `<script type="application/json" id="stay-data">`，引用 `style.css` 和 `render.js`，发布时用 Artifact 的 `files` 从模板 Artifact 复制这两个文件：`{"render.js": {"artifact": "https://claude.ai/artifact/7ShkkxKPGaYM2FVdpuYKj2", "path": "render.js"}, "style.css": {"artifact": "https://claude.ai/artifact/7ShkkxKPGaYM2FVdpuYKj2", "path": "style.css"}}`。外壳写法见 `template/shell.html`（把内联的 `<style>` 和 `<script>` 换成 `<link rel="stylesheet" href="style.css">` 和 `<script src="render.js"></script>`）。
- **Cursor、Codex、Gemini CLI 等在本地运行的 agent**：把 JSON 和 HTML 存进项目的 `stays/` 目录，告诉用户文件路径。
- **ChatGPT（代码解释器）等只能上传文件的环境**：用 `python3 scripts/render.py` 渲染，把 HTML 作为文件发给用户下载。
- **完全不能运行代码的环境**：把 JSON 发给用户，并告诉用户在本地运行上面的渲染命令。

### JSON 字段

自动计算的不用自己写：预算区间（预算内 ×0.9–1.1、浮动 ×0.8–0.9 / ×1.1–1.2）和每家住宿的「预算内 / 超预算 X%」标签、每家的最低价渠道、总览表里的最低价标绿、住宿编号（按 `stays` 顺序 1、2、3…，所以**按推荐顺序排好**）。因为「超预算 X%」会自动显示，`tag` 不要再写百分比，写这家的特点。标「html」的字段可以用 `<b>`、`<a href=… target="_blank" rel="noopener">`、`<br>`，其他字段是纯文本。

| 字段 | 说明 |
|---|---|
| `title` / `version` | 页面标题（和外壳 `<title>` 一致）/ 版本号 |
| `town` / `dateLabel` / `nights` | 核心小镇、日期文字（如「2 月 12–15 日」）、晚数；`heading`、`eyebrow` 可覆盖默认标题 |
| `budget` | `{perNight: 90, currency: "€"}` |
| `queriedAt` | 查询时间；页脚自动加「价格是查询时的快照，以平台为准」 |
| `intro` | html，页头说明：条件和思路 |
| `verdict.items` / `verdict.alerts` | html 数组：顶部结论 / 提示框（如「不够 5 家，用了 Google 补充」） |
| `towns[]` | 公交 1 小时圈：`{name, core, mode, time, transfers, freq, lastBack, fare, guestCard(html), cityTax, lat, lng}`；核心小镇写 `"core": true`；`lat`/`lng` 可选，用于住宿地图标点 |
| `townsNote` | html，表格脚注 |
| `stays[]` | 住宿，按推荐顺序：`{name, town, type, tag, walk, toCore, breakfast, cancel, summary(html), prices[], notes(html 数组), lat, lng}`；`lat`/`lng` 可选，没有就用村镇坐标 |
| `stays[].prices[]` | 每个渠道一项：`{channel, perNight(数字), total(数字), rating, url, note(html)}`；rating 写成「8.9 (212)」。Booking 的 note 写「公开价，登录 Genius 后可能更低」；Airbnb 写「已含清洁费和服务费」 |
| `staysNote` | html，总览表脚注 |
| `nearMiss[]` | 差点入选：`{name, town, price, url, why(html)}` |
| `activities[]` | 按运动分组：`{sport, note(html), items:[{name, kind, where, level, price, season, lang, how(html), url, lat, lng}]}`；`lat`/`lng` 可选，用于运动地图 |
| `hikes[]` | komoot 路线：`{name, area, rating, count, difficulty: easy / moderate / hard, distance, duration, ascent, start(html), season(html), url, lat, lng}`；`lat`/`lng` 可选，用于路线地图 |
| `hikesNote` | html，路线表脚注（例如哪些高分路线因为季节没列） |
| `excluded[]` | 排除的村镇：`{name, why(html)}` |
| `footer.paragraphs` / `footer.links` | html 数组：假设、补充搜索、没查到的来源 / 链接行，每行 `[{text, url}, …]` |

内容要求不变：

1. **顶部结论**：推荐住哪个村、哪几家（最便宜、评分最高、交通最方便），为什么；符合条件的总共几家，有没有用到第 3 步的补充搜索。
2. **公交 1 小时圈**、**住宿**（同一房源的多个渠道放在同一家的 `prices` 里）、**差点入选**、**户外运动**、**komoot 路线**、**排除的村镇**都按上面的字段填。
3. **页脚**写假设（预算区间、步行距离、Google 评分门槛等默认值）、每个平台实际搜了哪些村镇、哪些来源没查到和原因。

发布后在对话里用几句话总结推荐的住宿和村镇，不要把表格再贴一遍。
