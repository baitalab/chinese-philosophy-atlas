# 关系扩展独立审计

审计日期：2026-07-17  
审计原始快照：`data/research/relations.csv` 450 条关系，`relation_evidence.csv` 1006 条证据，226 条观点，155 位人物。  
范围：重点审计 `expansion-*`、`density-cross-period-*`、低度数补密度批次与负向补密度批次；同时检查中央关系表的全局一致性。审计只读中央数据，本文件是唯一新增文件。

## 整改复核（2026-07-17）

主线已依据本报告完成整改并重新发布：

- 合并 6 组高置信重复关系，保留并合并其证据；当前发布关系为 444 条。
- 修正全部 evidence 与 canonical excerpt 的来源及 locator 错配；复核错配数为 0。
- 将 `ex-sq-cy-dz-desire-contrast-1` 的人物归属由程颐改为戴震。
- 改写 `rel-xunzi-hanfei-rectification` 的中英文说明，不再声称未经直接证据支持的历史影响。
- 将 28 条同人物 `explicit` 关系重标为体系内 `conceptual-only` 连接；当前同人物 explicit 数为 0。
- 修正 relation evidence 的唯一键，使同一来源同时承担 source/target 端证据时不再互相覆盖；所有 444 条关系均具备两端证据角色。
- 最终数据为 155 位人物、226 条观点、444 条关系、1254 条关系证据；155/155 位人物进入关系图，孤立人物为 0。
- 生产构建、研究校验、Lint、TypeScript 与浏览器几何验收均通过；444/444 条关系均为有效圆弧，正负关系错侧数为 0。

下文保留整改前审计发现，作为审计轨迹。仍保留的同端点关系属于明确分层的“宽泛分析相似 / 具体历史发展”，或正负关系比较维度不同，不计为重复错误。

## 结论摘要

最终导入在基础引用完整性上合格：没有重复关系 ID，没有不存在的观点端点、来源 ID、引文 ID，也没有空 locator、空 excerpt ID 或空引文正文；155 位人物均至少进入 1 条关系。新增的 14 条 `explicit` 关系全部具有专门的直接关系证据角色。

但目前还不应把 450 条关系视为完全去重、完全一致的科研发布版。发布前至少需要处理以下问题：

1. 13 组关系共享同一无向端点，其中 12 组连端点顺序也完全相同；至少 6 组高度疑似重复表达，另有 2 组同时存在正、负判断，需要明确“不同比较维度”，否则 UI 会表现为重线或相互矛盾。
2. 3 条证据行的 `source_id` 与其 `excerpt_id` 实际指向的来源不一致。
3. 7 条证据行的 locator 与被引用 excerpt 的 locator 不一致；其中颜元相关 4 条是同一问题的重复传播。
4. `rel-xunzi-hanfei-rectification` 被标为 `conceptual-only`，中英文说明却明确声称“影响 / influenced”，与字段语义冲突。
5. 28 条旧的 `phase1-editorial` 同人物关系标为 `explicit`，但只有两端观点支持证据，没有直接关系证据角色。它们实际上是“同一作者体系内连接”，不宜复用历史影响强度字段。
6. 人物度数仍明显向先秦六人集中；这不构成引用错误，但会放大视觉中心性并影响“科研水准”的代表性判断。

## 1. 批次与证据覆盖

| 批次 reviewer | 关系 | explicit | probable | conceptual-only | 每条证据数 | 缺两端观点证据 |
|---|---:|---:|---:|---:|---:|---:|
| `codex-cross-period-density-2026-07-17` | 72 | 0 | 0 | 72 | 2 | 0 |
| `codex-han-tang-expansion-2026-07-17` | 64 | 6 | 11 | 47 | 2–3 | 0 |
| `codex-song-qing-primary-and-comparative-pass` | 63 | 0 | 0 | 63 | 2–3 | 0 |
| `modern-expansion-agent-2026-07-17` | 46 | 8 | 3 | 35 | 2–3 | 0 |
| `density-low-degree-agent-2026-07-17` | 60 | 0 | 0 | 60 | 2 | 0 |
| `codex-negative-density-2026-07-17` | 59 | 0 | 0 | 59 | 2 | 0 |
| `phase1-editorial` | 86 | 28 | 13 | 45 | 1–2 | 3 条缺 source 端角色 |

全局关系类型为：381 条 `conceptual-only`、42 条 `explicit`、27 条 `probable`；341 条正向、109 条负向。

新增批次的 14 条 `explicit` 关系均存在专门的直接证据角色，形式门槛通过。其中 7 条直接关系依据是 SEP/IEP 等学术百科的关系性陈述，7 条使用论辩文本、谱系文本、师徒记录或弟子注疏等一手/早期记录。建议将二者在数据模型中区分为 `direct-primary-record` 与 `direct-scholarly-attestation`，不要仅凭 evidence role 名称把证据等级视为相同。

旧批次中 28 条缺直接关系角色的 `explicit` 关系全部连接同一人物的两条观点，不是跨人物历史影响。建议新增 `systematic-link` 维度，或把 `historical_influence` 改为 `not-applicable`，而不是补造影响证据。

其中 `rel-zhuangzi-life-death-oneness`、`rel-zhuangzi-oneness-perspectives`、`rel-zhuangzi-wandering-self` 还只有 `target-claim-support`，缺少独立的 `source-claim-support` 角色。虽然相关引文可能同时覆盖同一作者的两端观点，也应显式记录这种复用，而不能让证据角色缺项。

## 2. 重复端点

关系 ID 重复：0。  
有序端点重复组：12。  
忽略方向后的重复端点组：13。

### 高优先级合并候选

以下关系在相同端点上给出同极性、相近含义，建议逐组保留证据更完整或语义更具体的一条：

- `density-c-17e22c26258b2a` / `density-xp-songqing-modern-03-jiao-xun-nature-capacity-through-practice-cai-yuanpei-education-personality`
- `density-c-79c7df8071a1da` / `density-xp-songqing-modern-16-ma-zhu-divine-unity-obedience-tan-sitong-ren-as-communication`
- `rel-confucius-harmony-junzi` / `rel-confucius-harmony-superior`
- `rel-mozi-care-xunzi-ritual` / `rel-xunzi-mozi-ritual-frugality`
- `rel-xunzi-rectification-order` / `rel-xunzi-rectification-ritual`
- `density-c-1ea446a41e0e1a` / `density-xp-hantang-songqing-02-zhi-dun-freedom-not-mere-satisfaction-wang-ji-four-nothings`

### 可保留但必须区分比较维度

- `rel-laozi-confucius-government`（正向相似）/ `rel-laozi-wuwei-confucius-virtue`（负向对照）。两者可以同时成立，但说明和 UI 必须显示“限制强制政治”与“礼教理论根据”两个不同维度。
- `rel-mozi-offensive-war-strategy`（正向相似）/ `density-negative-16-mozi-condemn-offensive-war-sunzi-victory-before-battle`（负向对照）。应明确前者比较慎战/策略，后者比较战争正当性/获胜技术。

### 分析相似与历史发展重叠

以下 5 组一条是宽泛 taxonomy overlap，另一条是更具体的发展或师承关系。可以保留两种分析层，但普通图谱默认只应画更具体的一条，避免视觉双线：

- `density-xp-modern-internal-12-*qian-mu*chen-lai*` / `modern-density-qian-chen-cultural-subject-values`
- `density-c-65c26a3328c5ee` / `sq-zd-ch-sincerity-ren`
- `density-xp-hantang-songqing-06-*li-ao*cheng-yi*` / `rel-liao-chengyi-nature`
- `density-xp-modern-internal-07-*xiong-shili*mou-zongsan*` / `modern-rel-xiong-mou-internal-moral-knowing`
- `density-xp-modern-internal-02-*xiong-shili*xu-fuguan*` / `modern-rel-xiong-xu-embodied-recognition`

## 3. 引用与定位一致性

### 来源与引文来源不一致（3 条）

以下证据行写 `source_id=lu-jiuyuan-zashuo-22`，但引用的 `ex-lu-jiuyuan-mind-universe` 在 excerpt 表中属于 `lu-jiuyuan-nianpu-36`，且 locator 也是《陆九渊集》卷三十六〈年谱〉：

- `density-xp-hantang-songqing-08-linji-master-of-every-situation-lu-jiuyuan-mind-universe`
- `density-xp-hantang-songqing-10-huangbo-one-mind-no-external-buddha-lu-jiuyuan-mind-universe`
- `sq-density-wucheng-lujiuyuan-mind`

处理建议：将这 3 条 evidence 的 source ID 统一为 excerpt 的实际来源，或换成真正属于《杂说》的 excerpt；不能只保留 locator 正确而 source ID 错误。

### locator 与 excerpt locator 不一致（7 条）

- 颜元 5 条：`density-negative-52-*`、`sq-density-sushi-yanyuan-practice`、`sq-density-wuyubi-yanyuan-practice`、`sq-yy-lg-practical-learning`、`sq-zx-yy-book-practice` 均使用 `ex-yan-yuan-learning-through-active-practice`；evidence locator 为“《存学编》卷一总论”，excerpt locator 为“《存学编》〈性理评〉首段”。
- 戴震 2 条：`sq-cy-dz-desire-contrast` 与 `sq-dz-li-fulfillment` 的 evidence locator 为“卷上〈理〉”，excerpt locator 为“卷上，论血气心知一本”。

这些差异可能只是章节粒度不同，也可能是批量复用时换错定位。应回到文本核对后统一，不应让证据行和 excerpt 元数据各说各话。

此外，`ex-sq-cy-dz-desire-contrast-1` 的来源和正文均为戴震《孟子字义疏证》，但 excerpt 表中的 `person_id` 写成 `cheng-yi`，应改为 `dai-zhen`。

## 4. conceptual-only 与历史陈述冲突

明确冲突 1 条：

- `rel-xunzi-hanfei-rectification`：`historical_influence=conceptual-only`、`basis=historian`，但中文说明写“荀子正名思想影响法家刑名之术”，英文写 “influenced”。现有两条 evidence 仅分别支持荀子正名与申不害术/名实观点，并不直接支持影响链。应删除影响措辞，或补充直接的学术史关系证据后升为 `probable/explicit`；当前不能两者并存。

另有两条使用 `disciple-*` subtype 但保持 `conceptual-only`：`rel-yanhui-confucius-learning-ritual` 与 `rel-zengzi-confucius-reciprocity`。其说明明确限定为《论语》编纂文本内的师教/解释关系，没有把它升级为可核实的历史传承，因此不是错误；不过 subtype 最好改为 `reported-disciple-teaching` / `intratextual-disciple-interpretation`，降低误读风险。

## 5. 时期覆盖

450 条关系中，同期关系 234 条，跨时期关系 216 条（48.0%）。六个时期的 21 种无序组合覆盖了 20 种，唯一完全缺失的是 `qin-han ↔ contemporary-china`。

| 时期 | 人物数 | 关系端点数 | 人均度数 | 中位度数 | 最高度数 |
|---|---:|---:|---:|---:|---:|
| ancient-preqin | 33 | 293 | 8.88 | 3 | 44 |
| qin-han | 10 | 56 | 5.60 | 6 | 10 |
| wei-jin-tang | 30 | 133 | 4.43 | 4 | 12 |
| song-yuan-ming-qing | 38 | 206 | 5.42 | 5 | 13 |
| late-qing-republic | 20 | 111 | 5.55 | 5 | 12 |
| contemporary-china | 24 | 101 | 4.21 | 4 | 7 |

较弱的时期桥包括：`qin-han ↔ song-yuan-ming-qing` 3 条、`wei-jin-tang ↔ late-qing-republic` 3 条、`qin-han ↔ late-qing-republic` 4 条、`wei-jin-tang ↔ contemporary-china` 4 条、`ancient-preqin ↔ contemporary-china` 5 条。若下一轮继续扩充，应优先补这些空缺/薄弱组合，而不是再增加先秦内部关系。

## 6. 极端高度数节点

人物平均度数 5.81，中位数 4，最大 44。度数超过 20 的 6 人全部属于先秦：

| 人物 | 度数 |
|---|---:|
| xunzi | 44 |
| confucius | 39 |
| mencius | 38 |
| zhuangzi | 33 |
| mozi | 30 |
| laozi | 29 |

这 6 人占全部 900 个关系端点中的 213 个（23.7%），会显著支配图形密度。其次为 `cheng-yi` 13、`xiong-shili` 12、`li-ao` 12、`han-fei` 12。高度数本身不等于错误，但新增的 taxonomy-overlap 容易把经典人物变成通用“枢纽”。建议给自动扩展设置每人物/每观点的软上限，并以时期内中位数为目标补低度数人物。

观点层最高度数为：`confucius-ren-ritual` 13；`xunzi-nature-transformation`、`han-fei-two-handles`、`li-ao-nature-obscured-by-emotions`、`zhuangzi-ten-thousand-one` 各 12；`cheng-yi-nature-is-principle` 与 `mozi-inclusive-care` 各 11。这些节点需要人工抽样检查，确认每条边确实表达不同关系维度，而不是相同 taxonomy overlap 的批量变体。

## 7. 主线处理顺序

1. 修正 3 条 evidence source/excerpt 来源不一致和 `ex-sq-cy-dz-desire-contrast-1.person_id`。
2. 回查并统一 7 条 locator 差异。
3. 修正 `rel-xunzi-hanfei-rectification` 的影响措辞或证据等级。
4. 合并 6 组高置信重复端点；为 2 组正负并存关系增加明确的 comparison dimension。
5. UI/发布层对“宽泛相似 + 具体历史发展”的 5 组双层关系默认去重。
6. 把 28 条同人物 `explicit` 从历史影响字段中拆出。
7. 后续扩充优先秦汉—当代空缺、薄弱跨时期组合和低度数人物，限制先秦枢纽继续膨胀。
