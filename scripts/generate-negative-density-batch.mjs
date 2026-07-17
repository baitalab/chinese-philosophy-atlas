import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

const root = process.cwd();
const research = path.join(root, "data", "research");
const output = path.join(research, "imports", "density-negative-2026-07-17.json");
const readCsv = (name) => parse(fs.readFileSync(path.join(research, name), "utf8"), {
  columns: true,
  skip_empty_lines: true,
  bom: true,
});

const claims = readCsv("claims.csv");
const claimSources = readCsv("claim_sources.csv");
const excerpts = readCsv("source_excerpts.csv");
const relations = readCsv("relations.csv");
const claimIds = new Set(claims.map((row) => row.claim_id));
const excerptById = new Map(excerpts.map((row) => [row.excerpt_id, row]));
const evidenceByClaim = new Map();
for (const row of claimSources) {
  const excerpt = excerptById.get(row.excerpt_id);
  if (!excerpt || !row.source_id || !row.locator || !excerpt.excerpt_text) continue;
  const candidate = { ...row, excerpt };
  const current = evidenceByClaim.get(row.claim_id);
  if (!current || (row.evidence_role === "primary" && current.evidence_role !== "primary")) {
    evidenceByClaim.set(row.claim_id, candidate);
  }
}

const endpointKey = (a, b) => [a, b].sort().join("|");
const existingNegativeEndpoints = new Set(
  relations.filter((row) => row.polarity === "negative").map((row) => endpointKey(row.source_claim_id, row.target_claim_id)),
);

// Each pair is an analytical contrast between already reviewed claims. These links do not
// assert transmission, direct debate, or historical influence.
const candidates = [
  ["confucius-rule-virtue", "han-fei-two-handles", "governance-method-contrast", "德性感化与以刑赏控制臣下，分别把政治秩序的主要动力置于人格示范和制度化权柄。"],
  ["mencius-kingly-way", "han-fei-two-handles", "governance-method-contrast", "仁政王道诉诸道德感召和民生关怀，刑德二柄则把治理核心置于君主可控制的赏罚。"],
  ["mencius-people-priority", "han-fei-two-handles", "political-subject-contrast", "民为贵以人民作为政治评价的优先尺度，二柄论则从君主控制臣下的权力技术出发。"],
  ["xu-xing-ruler-shares-labor", "han-fei-two-handles", "governance-method-contrast", "统治者与民共同劳动的平等化主张，与由君主垄断刑赏权柄的治理模型形成结构性对照。"],
  ["xu-xing-ruler-shares-labor", "shen-buhai-technique-name-performance", "governance-method-contrast", "亲身参加生产的统治理想，与通过循名责实、考核官吏而间接治理的君主术形成方法对照。"],
  ["huang-zongxi-law-public-not-dynastic", "han-fei-two-handles", "political-legitimacy-contrast", "以天下公共利益限定法律正当性，与以君主刑赏权柄确保控制的模型具有不同的政治中心。"],
  ["huang-zongxi-world-primary-ruler-guest", "han-fei-two-handles", "political-subject-contrast", "天下为主、君为客把君主降为公共职务承担者，二柄论则以君主掌控臣下为制度起点。"],
  ["bai-tongdong-confucian-hybrid-regime", "sun-yat-sen-popular-sovereignty", "qualified-legitimacy-contrast", "混合政体不把政治平等视为唯一最高原则，而民权论以主权属于民众否定少数人的政治特权。"],
  ["jiang-qing-triple-political-legitimacy", "yan-fu-free-speech-civil-society", "legitimacy-rights-emphasis-contrast", "三重合法性强调道德、历史与民意的复合授权，言论自由论则从公民社会的制度权利条件切入。"],
  ["chen-lai-relational-value-priorities", "yan-fu-free-speech-civil-society", "value-priority-contrast", "责任、义务和社群优先的价值排序，与以言论自由支撑公民社会的权利路径构成规范重点对照。"],
  ["kang-youwei-great-unity-abolish-national-boundaries", "qian-mu-cultural-subjectivity-without-rejecting-western-methods", "political-scale-contrast", "超越国家边界的世界政治方案，与坚持从中国文化主体和本国史实理解政治的路径处于不同尺度。"],
  ["zhao-tingyang-world-as-political-unit", "qian-mu-cultural-subjectivity-without-rejecting-western-methods", "political-scale-contrast", "以世界整体为基本政治单位，与以中国文化主体性和具体政治史为解释起点形成尺度与方法对照。"],
  ["yang-zhu-for-self-no-hair-for-world", "mozi-inclusive-care", "ethical-scope-contrast", "拒绝为天下利益损伤自身，与把关爱和互利扩展为普遍实践，代表伦理关切范围的两极。"],
  ["yang-zhu-for-self-no-hair-for-world", "zhang-zai-cosmic-kinship", "ethical-scope-contrast", "守护个体生命不为天下牺牲，与把众人万物纳入同胞伙伴关系，形成自我边界和伦理扩展的对照。"],
  ["yang-zhu-for-self-no-hair-for-world", "huang-yong-self-other-one-body", "self-other-contrast", "拒绝以天下之利损己，与把他人福祉纳入同体关切，对自我与他人的伦理关系给出不同结构。"],
  ["mozi-condemn-offensive-war", "sunzi-victory-before-battle", "war-ethics-strategy-contrast", "攻战不义的规范性谴责，与在开战前创造取胜条件的战略分析，分别回答战争是否正当与如何取胜。"],
  ["mozi-condemn-offensive-war", "sun-bin-war-neither-delight-nor-profit", "war-ethics-strategy-contrast", "对攻伐战争的原则性否定，与承认存亡情势下须审慎备战的立场，在战争许可范围上形成限定性对照。"],
  ["laozi-wuwei-transformation", "han-fei-two-handles", "governance-method-contrast", "避免强制干预、任万物自化，与以奖惩权柄主动控制臣下，是两种相反的治理机制。"],
  ["laozi-wuwei-transformation", "shen-buhai-technique-name-performance", "governance-method-contrast", "无为自化降低强制和主观操控，循名责实之术则依靠持续考核和任免赏罚组织官僚体系。"],
  ["mencius-nature-good", "gaozi-life-is-nature", "human-nature-contrast", "以道德向善倾向界定人性，与先按自然生命禀赋、暂不预设善恶来界定性，构成经典人性论分歧。"],
  ["mencius-nature-good", "yang-xiong-nature-mixed-cultivation", "human-nature-contrast", "人性趋善与人性兼具善恶倾向，对先天道德结构作出不同判断。"],
  ["mencius-nature-good", "dai-zhen-blood-qi-and-mind-one-root", "normative-anthropology-contrast", "以趋善说明人性的规范方向，与把血气心知视为连续一本，分别突出道德倾向和身体心理结构。"],
  ["xunzi-nature-transformation", "li-ao-nature-obscured-by-emotions", "human-nature-contrast", "善由学习礼义主动塑造，与本性原善但被情欲遮蔽，关于修养究竟创造还是恢复善形成分歧。"],
  ["xunzi-nature-transformation", "cheng-yi-nature-is-principle", "human-nature-contrast", "自然倾向不足以成善，与天命之性本为规范天理，对恶的来源给出外塑和气禀偏蔽两种解释。"],
  ["xunzi-nature-transformation", "hu-hong-nature-beyond-good-evil", "human-nature-contrast", "以礼义塑造自然倾向的修养论，与认为性不能被经验善恶二分穷尽，在性的可评价方式上相异。"],
  ["xunzi-nature-transformation", "wang-ji-four-nothings", "human-nature-contrast", "通过学习礼义把自然倾向塑造成善，与从本源看心意知物无固定善恶，对工夫起点作出不同规定。"],
  ["gaozi-life-is-nature", "cheng-yi-nature-is-principle", "human-nature-contrast", "以生而具有的生命禀赋界定性，与直接把性规定为规范天理，是自然主义与规范主义的概念对照。"],
  ["gaozi-life-is-nature", "li-ao-nature-obscured-by-emotions", "human-nature-contrast", "不预设生命之性为道德善恶，与认为本性清明而善、情欲造成遮蔽，对性的原初性质判断不同。"],
  ["yang-xiong-nature-mixed-cultivation", "cheng-yi-nature-is-principle", "human-nature-contrast", "性兼善恶与天命之性纯为规范天理，对恶是否属于性本身形成直接概念分歧。"],
  ["li-ao-nature-obscured-by-emotions", "dai-zhen-li-fulfillment-feeling", "emotion-cultivation-contrast", "把情欲视为遮蔽清明善性的因素，与把理理解为恰当实现人情，代表压低情与成就情的修养差异。"],
  ["xiang-xiu-desire-natural-but-ritually-regulated", "li-ao-nature-obscured-by-emotions", "emotion-cultivation-contrast", "承认情欲属于自然生命并以礼调节，与把情欲活动视为本性之蔽，对欲望的地位判断不同。"],
  ["qian-dehong-no-good-evil-and-cultivation", "wang-ji-four-nothings", "cultivation-interpretation-contrast", "承认心体超善恶但坚持现实意念须去恶为善，与把心意知物一并视为无固定善恶，在工夫约束上有差异。"],
  ["he-yan-nonbeing-ground-of-being", "pei-wei-being-self-generates", "being-nonbeing-contrast", "以无作为一切有的成立根据，与否认绝对无的生成能力、主张最初存在者自生，是有无本体论的正面对照。"],
  ["zhang-zai-great-void-qi", "he-yan-nonbeing-ground-of-being", "being-nonbeing-contrast", "把太虚解释为气的无形状态而非虚无，与以无作为有的根据，在本原是否为气上形成差异。"],
  ["zhang-zai-great-void-qi", "wang-bi-being-rooted-in-nonbeing", "being-nonbeing-contrast", "太虚即气的无形本体，与有根于无的论证，对无形本原是否仍是气作出不同回答。"],
  ["wang-fuzhi-dao-in-concrete-things", "he-yan-nonbeing-ground-of-being", "immanence-transcendence-contrast", "道不离具体器物的内在论，与具体事务以无形无名之道为根据，在道与事物能否分说上构成对照。"],
  ["wang-fuzhi-dao-in-concrete-things", "wang-bi-being-rooted-in-nonbeing", "immanence-transcendence-contrast", "没有器便没有可实现之道，与具体有须返回无形根基的路径，对本体和现象的优先次序判断不同。"],
  ["zhang-xuecheng-way-never-separate-instruments", "wang-bi-being-rooted-in-nonbeing", "immanence-transcendence-contrast", "道须在器物制度与历史实践中考察，与以无形无名之无为有的根本，体现历史内在论和本体根源论的差异。"],
  ["chen-liang-dao-within-things-affairs", "he-yan-nonbeing-ground-of-being", "immanence-transcendence-contrast", "道遍在形气日用而不在事物之外，与以无形之无为具体事务的根据，在道的存在方式上形成对照。"],
  ["wang-chong-spontaneous-generation", "dong-zhongshu-heaven-warns-ruler", "teleology-contrast", "天地之气自然生成且无目的，与天以灾异有意警告君主，在自然是否具有道德意向上相反。"],
  ["wang-chong-dead-lack-awareness", "ge-hong-immortality-learnable", "death-transcendence-contrast", "死亡意味着知觉终止，与凡人可借长期修炼达到长生，对死亡是否可被超越作出不同判断。"],
  ["fan-zhen-mind-function-of-body", "ge-hong-immortality-learnable", "mind-body-transcendence-contrast", "精神只是形体功能、形亡神灭，与通过方术药物延长并转化生命的成仙方案，在形神存续上张力明显。"],
  ["huan-tan-spirit-dependent-on-body", "ge-hong-immortality-learnable", "mind-body-transcendence-contrast", "精神如火依烛、形尽神灭，与凡人原则上能够修成不死，对生命终限的理解不同。"],
  ["zhang-junmai-mind-free-will-causality", "fan-zhen-mind-function-of-body", "mind-body-contrast", "精神包含不能还原为机械因果的自由意志，与精神只是生命形体的功能，是非还原论和功能依存论的对照。"],
  ["zhang-junmai-mind-free-will-causality", "huan-tan-spirit-dependent-on-body", "mind-body-contrast", "自由意志不能被自然因果穷尽，与精神完全依存形体的譬喻，对心灵自主性作出不同强调。"],
  ["fang-dongmei-universe-living-field", "feng-youlan-true-real-realm", "metaphysical-method-contrast", "把宇宙理解为生命流行的整体，与区分真际和实际并赋予普遍本体逻辑优先，代表生命论和形式本体论差异。"],
  ["xiong-shili-reality-internal-self-realization", "hu-shi-hypothesis-verification-method", "epistemic-method-contrast", "根本真实依本心内在自证把握，与以材料检验可复核假说，分别代表体证和公共验证的方法。"],
  ["xiong-shili-reality-internal-self-realization", "mao-zedong-practice-truth", "epistemic-method-contrast", "真实只能在本心内部自证，与认识真理性须由社会实践结果检验，对最终证成场域判断不同。"],
  ["zhang-junmai-science-limited-before-free-life-outlook", "hu-shi-hypothesis-verification-method", "science-scope-contrast", "科学方法不能决定人生观和自由价值，与把假说—材料验证推广到人文学术，在科学方法适用边界上侧重不同。"],
  ["hu-shi-problems-before-isms", "ai-siqi-philosophy-worldview-practical", "theory-problem-method-contrast", "从具体问题调查出发并警惕抽象主义，与以系统世界观指导认识行动，对理论体系在实践中的优先级不同。"],
  ["mao-zedong-contradiction-particularity-method", "feng-youlan-universal-particular-logical-analysis", "universal-particular-method-contrast", "强调具体过程中特殊矛盾和主要方面，与以逻辑分析把握普遍之理，对哲学方法的起点侧重不同。"],
  ["gu-yanwu-classics-ground-principle-learning", "chen-xianzhang-stillness-moral-intimation", "learning-method-contrast", "以可考经典、文字和制度事实约束义理，与由静坐澄心培养道德端倪，体现外在证据和内在体认的路径差异。"],
  ["yan-yuan-learning-through-active-practice", "chen-xianzhang-stillness-moral-intimation", "learning-method-contrast", "以礼乐射御等身体习行养成德性，与端坐澄心、在静中获得自得，对学习的主要场域判断不同。"],
  ["yan-yuan-knowledge-through-practice", "zhu-xi-investigate-things-cumulative", "learning-method-contrast", "强调亲身习行才算真正知识，与逐事穷理、长期累积而贯通的认识路径，分别突出行动和考察。"],
  ["lu-jiuyuan-remove-obscurations-original-mind", "zhu-xi-investigate-things-cumulative", "learning-method-contrast", "学习是剥落遮蔽以恢复本心，与由已有原则出发逐事穷理，代表向内发明和向事累积的差异。"],
  ["wang-yangming-liangzhi-present-knowing", "zhu-xi-investigate-things-cumulative", "learning-method-contrast", "良知是不待推论的现成道德明觉，与经长期逐物穷理后贯通，对道德知识取得方式理解不同。"],
  ["zhang-xuecheng-six-classics-are-history", "ma-yifu-six-arts-interconnected-hermeneutic-whole", "classics-interpretation-contrast", "六经是古代政教实践的历史遗迹，与六艺构成内在互释的义理整体，对经典的历史性和系统性侧重不同。"],
  ["li-zhi-childlike-mind-authenticity", "gu-yanwu-classics-ground-principle-learning", "authority-authenticity-contrast", "真实言说以未受成见遮蔽的童心为根，与义理须由经学文字制度材料检验，在思想权威来源上形成对照。"],
  ["ji-kang-sound-without-emotion", "xu-fuguan-heart-fasting-artistic-subject", "aesthetic-subject-object-contrast", "声音本身不内含哀乐、情感来自听者，与由心斋修养形成审美主体，分别从对象属性和主体状态解释审美经验。"],
  ["zhuangzi-perspectives", "xunzi-rectification-names", "language-order-contrast", "是非判断随立场变化、固定分别不足穷物，与通过制名指实建立稳定秩序，对语言分类的可靠性判断不同。"],
  ["laozi-language-dao", "xunzi-rectification-names", "language-order-contrast", "恒常之道不能被固定言名穷尽，与制名指实可使道行志通，对命名能力的边界判断不同。"],
  ["gongsun-long-white-horse-not-horse", "xunzi-rectification-names", "language-analysis-contrast", "以名义条件差异拆分白马与马，与以约定名称辨同异、服务政治秩序，体现分析名辩与规范正名的差异。"],
];

const selected = [];
const seen = new Set();
for (const [sourceClaimId, targetClaimId, subtype, noteZh] of candidates) {
  if (!claimIds.has(sourceClaimId) || !claimIds.has(targetClaimId)) throw new Error(`Unknown endpoint: ${sourceClaimId} -> ${targetClaimId}`);
  const endpoints = endpointKey(sourceClaimId, targetClaimId);
  if (existingNegativeEndpoints.has(endpoints) || seen.has(endpoints)) continue;
  const evidence = evidenceByClaim.get(targetClaimId) ?? evidenceByClaim.get(sourceClaimId);
  if (!evidence) throw new Error(`No located evidence for ${sourceClaimId} / ${targetClaimId}`);
  seen.add(endpoints);
  const number = String(selected.length + 1).padStart(2, "0");
  selected.push({
    relation_id: `density-negative-${number}-${sourceClaimId}-${targetClaimId}`,
    source_claim_id: sourceClaimId,
    target_claim_id: targetClaimId,
    polarity: "negative",
    subtype,
    basis: "analytical-contrast-between-reviewed-claims-with-located-claim-evidence",
    direction: "undirected",
    historical_influence: "conceptual-only",
    note_zh: `${noteZh} 本关系仅表示对已审命题的分析性对照，不主张直接争论、师承或历史影响。`,
    note_en: "Analytical contrast between two reviewed claims. This link does not assert direct debate, transmission, or historical influence.",
    source_id: evidence.source_id,
    locator: evidence.locator,
    excerpt_text: evidence.excerpt.excerpt_text,
    evidence_role: evidence.claim_id === targetClaimId ? "located-target-claim-support" : "located-source-claim-support",
    evidence_status: evidence.evidence_status || "locator-reviewed",
  });
}

if (selected.length < 45) throw new Error(`Only ${selected.length} non-duplicate negative relations selected`);
const relationIds = new Set();
for (const relation of selected) {
  if (relationIds.has(relation.relation_id)) throw new Error(`Duplicate relation id: ${relation.relation_id}`);
  relationIds.add(relation.relation_id);
  const sourceRow = excerpts.find((row) => row.source_id === relation.source_id && row.locator === relation.locator && row.excerpt_text === relation.excerpt_text);
  if (!sourceRow) throw new Error(`Evidence tuple is not present in source_excerpts.csv: ${relation.relation_id}`);
}

const batch = {
  batch_id: "density-negative-2026-07-17",
  reviewer: "codex-negative-density-2026-07-17",
  sources: [],
  claims: [],
  relations: selected,
};
fs.writeFileSync(output, `${JSON.stringify(batch, null, 2)}\n`);
console.log(`Wrote ${selected.length} reviewed conceptual negative relations to ${path.relative(root, output)}`);
