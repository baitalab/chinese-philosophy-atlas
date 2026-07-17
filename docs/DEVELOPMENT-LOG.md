# 开发日志 / Development Log

## 2026-07-14 — 一期人物观点全覆盖 / Phase-one claim coverage

- 将12个真实数据批次导入研究层；155位登记人物全部至少有1条可见观点，共167条中英双语观点、167条来源摘录与定位。
- 新增批次导入器，统一来源类型、原始/二手证据角色、同人物精确去重、双语字段、归属限制和审核事件，再由研究层发布到页面数据层。
- 传说人物使用“文本塑造/传统归属”的限定命题；禅宗后出语录、门人记录、参与者追记、译者按语和严肃二手概括分别保留文献层级，不冒充本人同期逐字言论。
- 当前14条关系仍是种子关系；一期优先完成人物与观点覆盖，二期再扩充观点体系和有证据的观点—观点关系。
- Imported 12 real-data batches, giving every one of the 155 registered people at least one visible position: 167 bilingual positions with 167 source excerpts and locators.
- Added an idempotent batch importer with source-role classification, within-person exact deduplication, bilingual fields, attribution limits, and review events before publication.
- Legendary attributions, later Chan records, disciple notes, translator commentary, and scholarly secondary summaries retain explicit textual-layer labels.

## 2026-07-14 — 科研流水线与数据库边界 / Research pipeline and database boundary

- 在 `data/research/` 建立非公开研究层，155 人全部进入研究登记。
- 新增人物—来源、人物—思想维度覆盖、著作与归属、原文摘录、规范命题、命题证据、去重裁决、关系证据、排除记录、审核事件和发布清单表。
- 为全部155人生成815条可追踪的来源或权威资料库检索线索；为首批6部核心文献登记归属争议，并把18条古典原文短摘录逐条连接到现有18条规范命题。
- 将现有18条真实观点与14条关系迁移为研究层种子，没有生成任何占位观点。
- 增加 `research:sync`、`research:validate`、`research:report` 和 `research:publish`；发布层由通过门槛的研究数据生成。
- 修正 API 的关系状态硬编码，并加强发布数据的重复 ID、审核元数据、证据角色和关系类型校验。
- 增加中英双语流水线文档、来源等级、去重规则和发布门槛。
- Added a non-public research layer for all 155 registered people, without manufacturing placeholder claims.
- Added source mapping, coverage, works, excerpts, canonical claims, evidence, deduplication, exclusions, reviews, and release-manifest tables.
- Publication data is now generated only from claims and relations that pass explicit research gates.

## 2026-07-14 — 撤回错误覆盖节点并重构聚焦 / remove false coverage nodes and rebuild focus

- 撤回将149条内部研究进度错误发布为观点节点的实现；公开时间线和API现在只包含18条逐条整理的哲学观点。
- 人物与观点布局统一改为严格 `1:1`，形成45°左上至右下内容流。
- 删除人物详情与观点详情侧栏；点人物只显示其全部观点及严格一度邻居，点观点只显示该观点及严格一度邻居，再次点击恢复总览。
- 聚焦后按可见观点重新紧凑排版；先冻结种子集合再取邻居，杜绝遍历顺序导致的二度泄漏。
- 155人的研究状态继续保留在内部队列，但队列不是观点表，也不进入页面或API。
- Removed the mistaken publication of 149 internal research-progress rows as position nodes; the public timeline and API now contain only 18 item-edited philosophical positions.
- Changed both person and position advances to strict `1:1`, producing a 45-degree upper-left-to-lower-right stream.
- Removed person and position detail sidebars. Person selection shows all own positions plus strict first-degree neighbors; position selection shows only that position and its strict first-degree neighbors; selecting again restores overview.
- Focus reflows visible positions compactly and freezes the seed set before adding neighbors, preventing accidental degree-two expansion.

## 2026-07-14 — 出生年排序内容流重构 / Birth-ranked content-flow rewrite

### 中文

- 对原站双 Canvas 运行界面完成坐标采样：189 个人物标题按出生年排序，但不按年份差做比例定位。
- 原站相邻标题距离拟合为“约 `53.33` 世界单位基础槽 + 每条观点约 `20.06` 世界单位”，误差约 `0.39`；据此确认人物、观点行、下一人物属于同一内容槽序列。
- 删除剩余实体轴线与年代刻度。人物基础步长采用 `54 × (1, -0.5)`，观点步长采用 `40 × (1, -0.5)`，更新表格后自动重排，无需坐标字段。
- 适屏总览缩放约为 `0.15`，人物点压缩成连续点列；放大验收中点径增长 `6.17` 倍，观点、行距和关系场随世界坐标自然展开。
- 点与关系线按缩放变化，人物与观点文字单独逆缩放保持可读；18 条已复核观点的文字重叠实测为 `0`。
- 人物搜索与点击会将一度关系组移动到画布可读中心，避免被左侧筛选器遮挡。
- 先移除了“只有已录观点者才能显示姓名”的错误条件；随后该渐进候选方案又被下一条“所有文字始终存在”的连续缩放方案取代。
- 进一步对齐原站微缩逻辑：不再按缩放阈值删除标题或观点文字。155 个人物标题和 18 条观点始终渲染，适屏时实测高度分别压缩为约 `4px` 与 `3px` 的短线/色块，放大后恢复可读；明清筛选各档均保持 `22/22` 个姓名实体。
- 关系线在适屏总览设置约 `0.8px` 的可见下限，随后继续随缩放自然增粗；只改善 14 条已审核关系的可见性，不生成装饰线或未经审核的关系。
- 鼠标锚定连续三次滚轮放大后的累计锚点漂移约 `3.23px`；相邻观点行实测位移恒为 `(34.67, -17.33)`。

### English

- Instrumented the reference site's two live Canvas layers: all 189 headings are birth-year sorted, but distance is not proportional to elapsed years.
- Reference heading gaps fit a `53.33`-world-unit base slot plus about `20.06` units per statement, with about `0.39` world-unit error. Person headings, statement rows, and the next person therefore form one content-slot sequence.
- Removed the remaining physical spine and year ticks. Local person advance is `54 × (1, -0.5)` and statement advance is `40 × (1, -0.5)`; spreadsheet changes regenerate the layout without coordinate columns.
- Fit overview uses roughly `0.15×` scale so people collapse into a continuous point stream. In detail verification, dots grow `6.17×` while statements, spacing, and relation fields expand in world space.
- Dots and relation strokes scale naturally; person and statement copy uses a separate inverse scale for legibility. Measured overlap among all 18 reviewed statement labels is `0`.
- Search and person selection now move the first-degree group into the readable canvas center instead of leaving it beneath the left filter panel.
- First removed the erroneous “only people with reviewed statements may have labels” condition; the next item then superseded gradual eligibility with continuous scaling in which every text entity always exists.
- Further matched the reference micro-scale behavior: headings and statement copy are never removed by a zoom threshold. All 155 headings and 18 statements stay rendered, compressing to roughly `4px` and `3px` line/colour marks at fit view before becoming readable on zoom. All Ming–Qing zoom levels retain `22/22` name entities.
- Added an approximately `0.8px` fit-view visibility floor for relation strokes, after which they resume natural zoom scaling. This only improves the visibility of the 14 reviewed relations; it creates no decorative or unreviewed edges.
- Three consecutive cursor-anchored wheel steps produce about `3.23px` cumulative anchor drift; adjacent statement rows remain exactly `(34.67, -17.33)` apart.

## 2026-07-14 — 视图几何与缩放重构 / View geometry and zoom rewrite

### 中文

- 把缩放、观点行坐标和关系曲率从页面组件抽离为可独立校准的几何模块。
- 滚轮缩放改为鼠标位置锚定；浏览器实测锚点漂移小于 `0.4px`。
- 移除人物上下交替车道，人物只沿时间方向单向递进；本条的临时 `30px` 行距后来由“出生年排序内容流重构”取代。
- 本条的概括轴方案后来被完全无实体轴的点列方案取代。
- 放大后只显示已有观点体系的人物标题，避免尚无观点的人物标签干扰观点正文。
- 关系线改用弦长、法向量和弓高共同决定的对称三次曲线；曲率随跨度自适应，并以稳定微差分离近似重合关系。
- 关系线不再使用 `non-scaling-stroke`，因此放大后线宽和观点点一起获得自然的实体感。

### English

- Extracted zoom, statement-row coordinates, and relation curvature into an independently calibratable geometry module.
- Wheel zoom is now cursor-anchored; browser measurement keeps anchor drift below `0.4px`.
- Removed alternating person lanes. The temporary fixed `30px` row rule in this entry was later superseded by the birth-ranked content-flow rewrite.
- The summary-spine proposal in this entry was later replaced by a fully axis-free point-stream layout.
- Detail zoom labels only people with reviewed statement systems, preventing unsourced person headings from colliding with statement text.
- Replaced forced semicircles with symmetric cubic curves whose sagitta derives from chord length and normal direction, with stable variation to separate near-overlapping relations.
- Removed `non-scaling-stroke`, allowing relation strokes to gain natural visual weight together with statement points as the view zooms in.

## 2026-07-13 — 图谱实体层重构 / Graph entity-layer rewrite

### 中文

- 依据原项目公开方法和运行行为重新确认根本模型：人物是观点体系容器，观点才是节点，关系只连接观点。
- 将数据与 API 升级为 Schema v3：155 人、18 条已复核双语观点、14 条观点关系（正向 10、负向 4）、24 条来源。
- 从页面和 API 废止 1,035 条自动分类共现线；同传统、同领域或同标签今后只能生成后台研究候选。
- 为关系增加正负性质、相似/扩展/对照/反驳子类型、判断依据、无向概念语义、独立历史影响状态、证据来源和双语说明。
- 重写内容感知时间轴和细节层级：人物标题容纳多条观点、观点逐行展开、关系半圆弧、逆缩放恒定字号与点径、人物/观点一度聚焦。
- 建立 6 人、18 观点、14 关系的科研种子，逐条记录原典定位；不以人物简介或分类自动伪造观点和关系。
- 下方旧条目“结构关联网络恢复”已被本次重构取代，仅保留为开发历史，不能描述当前产品。

### English

- Reconfirmed the reference model from public methodology and runtime behavior: people are statement-system containers, statements are nodes, and relations join statements only.
- Upgraded data and API to Schema v3: 155 people, 18 reviewed bilingual statements, 14 statement relations (10 positive, 4 negative), and 24 sources.
- Retired 1,035 automatic taxonomy-co-occurrence links from both UI and API; shared traditions, domains, or tags may now generate private research candidates only.
- Added relation polarity, similarity/expansion/contrast/refutation subtypes, interpretive basis, undirected conceptual semantics, separate historical-influence status, evidence sources, and bilingual notes.
- Rewrote the content-aware timeline and LOD: multi-statement person groups, statement rows, semicircular relation arcs, inverse-scaled constant text/dot sizes, and person/statement first-degree focus.
- Added a six-person, 18-statement, 14-relation research seed with exact primary locators; biographies or taxonomy never fabricate statements or relations.
- The older “Structural relation field restored” entry below is superseded and retained only as development history.

## 2026-07-13 — 结构关联网络恢复 / Structural relation field restored

### 中文

- 从已复核的传统与问题领域分类自动生成 1,035 条结构关联：420 条“同传统”、615 条“跨传统同题”。
- 总览显示低透明度关系场；聚焦人物时突出一度关联并淡化无关节点和曲线。
- 增加两类结构关联开关、图例、人物关联计数、双语说明和 API 元数据。
- 结构关联不属于思想史证据：不得解释为师承、影响、传播、赞同或反对；这些证据关系仍留待二期逐条审核。
- 浏览器验收覆盖连线数量、两种关系类型、人物聚焦、标签碰撞、双语页面、API 一致性和控制台错误。

### English

- Derived 1,035 structural links from reviewed tradition and problem-domain taxonomy: 420 shared-tradition links and 615 cross-tradition shared-question links.
- The overview renders a low-opacity relation field; person focus emphasizes the first-degree neighborhood and fades unrelated nodes and curves.
- Added link-type toggles, legend entries, per-person counts, bilingual notices, and API metadata.
- Structural links are not intellectual-historical evidence and must not be interpreted as lineage, influence, transmission, agreement, or opposition; those evidence relations remain subject to item-level Phase 2 review.
- Browser acceptance now covers link counts, both link types, person focus, label collisions, both locales, API parity, and console errors.

## 2026-07-13 — 一期科研基线完成 / Phase 1 research baseline

### 中文

- 将一期目标从布局样例调整为可公开审查的人物基础名录。
- 建立 155 条人物记录、15 条研究入口、98 个双语分类词条及自动覆盖报告。
- 区分可考人物、传统人物、文本人格与神话—传说人格；区分核心、扩展与语境纳入层级。
- 建立 CSV → 校验 → 生成数据流程，修改表格即可自动重建时间轴，无需手绘坐标。
- 删除全部演示关系；页面明确标记关系研究留待二期。
- 重写时间轴布局：密集圆点、层级显名、标签碰撞规避、搜索、时期/领域/传统组合筛选、人物详情、来源链接、拖动、缩放、深色模式和 URL 留痕。
- 完成双语研究方法与排除标准，明确单句网络名言不能构成纳入理由。

### English

- Reframed Phase 1 from a layout fixture into an auditable baseline people register.
- Added 155 people, 15 research entry points, 98 bilingual taxonomy terms, and generated coverage reporting.
- Distinguished attested people, traditional figures, textual personae, and legendary personae, together with core, extended, and context inclusion tiers.
- Added the CSV → validation → generated-data workflow so table edits rebuild the timeline without hand-authored coordinates.
- Removed all demonstration relations and explicitly deferred relation research to Phase 2.
- Rebuilt the timeline with dense dots, level-of-detail labels, collision avoidance, search, combined filters, person details, sources, pan, zoom, dark mode, and URL state.
- Added bilingual research and exclusion standards, including the rule that a single popular quotation is insufficient for inclusion.

## 2026-07-13 — 项目重启 / Project reboot

### 中文

- 将原有“华夏思想图谱”完整移动至 `legacy/atlas-of-chinese-thought-2026-07-13/`，保留源码、依赖、环境文件、数据库、截图和文档。
- 在仓库根目录创建全新的 Next.js 16.2.10 / React 19.2.4 项目。
- 确定核心产品为“思想命题关系时轴”，主轴方向为左下至右上。
- 建立中文 `/zh-CN` 和英文 `/en` 路由。
- 建立类型化词典、UI 语言区域清单和 `i18n:check` 完整性检查。
- 建立语言感知 API，返回语言回退和字段缺失留痕。
- 完成第一阶段 SVG 时间轴骨架、示例节点、关系曲线、缩放、聚焦、搜索、主题和筛选布局。
- 增加 Next.js standalone、Docker 和 Ubuntu 反向代理部署基础。
- 当前示例数据标记为 `layout-demo`；正式数据研究尚未开始。

### English

- Moved the complete previous Atlas application to `legacy/atlas-of-chinese-thought-2026-07-13/`, preserving source, dependencies, environment files, database, screenshots, and documentation.
- Created a fresh Next.js 16.2.10 / React 19.2.4 application at the repository root.
- Established the statement relationship timeline as the core product, rising from lower left to upper right.
- Added Chinese `/zh-CN` and English `/en` routes.
- Added typed dictionaries, a UI locale-scope manifest, and the `i18n:check` completeness gate.
- Added a locale-aware API with explicit locale and field-fallback traces.
- Added the Phase 1 SVG timeline foundation with fixture nodes, relationship curves, zoom, focus, search, theme, and filter layout.
- Added Next.js standalone, Docker, and Ubuntu reverse-proxy foundations.
- Current fixtures are marked `layout-demo`; formal content research has not started.
