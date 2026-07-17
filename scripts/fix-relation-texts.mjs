import fs from "node:fs";
import path from "node:path";

const RESEARCH_DIR = path.resolve("data/research");
const relTextsFile = path.join(RESEARCH_DIR, "relation_texts.csv");

function csvEscape(value) {
  if (typeof value !== "string") return String(value);
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

let content = fs.readFileSync(relTextsFile, "utf8");
let lines = content.trim().split("\n");

const header = lines[0];
const validLines = [header];
const existingKeys = new Set();

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split(",");
  if (cols.length === 6 && cols[0] && cols[1]) {
    validLines.push(lines[i]);
    existingKeys.add(`${cols[0]}|${cols[1]}`);
  }
}

const newRelationTexts = [
  {
    id: "rel-confucius-ren-rectification",
    zh: "正名是仁礼秩序在语言政治层面的延伸。孔子以仁为内核、以礼为制度，而正名思想要求名实相符，是维持礼治秩序的必要条件。",
    en: "Rectification of names extends ren-li order to the linguistic-political sphere. Confucius takes ren as inner core and li as institutional framework; the rectification of names, requiring names to match realities, is a necessary condition for maintaining ritual order.",
  },
  {
    id: "rel-confucius-junzi-ren",
    zh: "君子是仁的人格载体。君子是孔子理想人格的体现，其核心品质即仁，通过践行礼来完成道德修养。",
    en: "The superior person is the embodiment of ren. The superior person embodies Confucius' ideal personality, whose core quality is ren, accomplished through the practice of li.",
  },
  {
    id: "rel-confucius-harmony-junzi",
    zh: "和而不同是君子的处世品格。孔子曰'君子和而不同，小人同而不和'，和谐共处又保持独立见解是君子的标志。",
    en: "Harmony without uniformity is the junzi's way of being in the world. Confucius says 'The superior person is harmonious but not uniform; the petty person is uniform but not harmonious.'",
  },
  {
    id: "rel-confucius-virtue-rectification",
    zh: "正名是德治的制度前提。为政必先正名，名不正则言不顺，言不顺则事不成，德治也就无法落实。",
    en: "Rectification of names is the institutional precondition of virtue rule. Governing must begin with rectifying names; if names are not correct, speech will not be smooth, affairs will not succeed.",
  },
  {
    id: "rel-confucius-reciprocity-ren",
    zh: "恕是仁的实践方法。己所不欲勿施于人，恕道是将仁心推及他人的具体路径，贯穿于礼的践行之中。",
    en: "Reciprocity (shu) is the method of practicing ren. Do not do to others what you do not wish for yourself. The way of shu is the concrete path of extending ren to others.",
  },
  {
    id: "rel-laozi-wuwei-naturalness",
    zh: "无为以自然为依据。无为不是什么都不做，而是效法自然，不妄为不强为，让事物按照自身本性发展。",
    en: "Wuwei is grounded in naturalness (ziran). Wuwei does not mean doing nothing; it means modeling oneself on nature, acting without arbitrary force.",
  },
  {
    id: "rel-laozi-reversal-softness",
    zh: "反者道之动解释了柔弱胜刚强。反者道之动是老子辩证思维的核心，事物向对立面转化，因此柔弱处下反而能胜刚强。",
    en: "Reversal as dao's movement explains why soft overcomes hard. Reversal is the movement of dao — the core of Laozi's dialectical thinking.",
  },
  {
    id: "rel-laozi-contentment-softness",
    zh: "知足是柔弱处世的修养要求。知足不辱，知止不殆。懂得满足和适可而止，是践行柔弱不争之道的具体表现。",
    en: "Contentment is the self-cultivation requirement of the soft way of life. Contentment brings no disgrace; knowing where to stop brings no danger.",
  },
  {
    id: "rel-laozi-dao-wuwei",
    zh: "道不可言说，故应无为而治。道常无名，超越语言把握，因此圣人治国也应处无为之事，行不言之教。",
    en: "Dao cannot be spoken, hence one should rule by wuwei. Dao is always nameless and transcends linguistic grasp; thus the sage governs by doing nothing.",
  },
  {
    id: "rel-laozi-reversal-natural",
    zh: "道法自然蕴含对立面转化规律。人法地，地法天，天法道，道法自然。自然本身就包含着物极必反的辩证规律。",
    en: "Dao modeling on nature contains the law of opposite transformation. Humanity models on earth, earth models on heaven, heaven models on dao, dao models on nature.",
  },
  {
    id: "rel-zhuangzi-perspectives-wandering",
    zh: "破除是非方能逍遥。齐物论破除是非彼此的执着，逍遥游则是达到精神自由的境界，前者是方法，后者是境界。",
    en: "Free wandering requires transcending right-wrong distinctions. The Discussion on Making All Things Equal dismantles attachments; Free and Easy Wandering is the state of spiritual freedom.",
  },
  {
    id: "rel-zhuangzi-oneness-perspectives",
    zh: "万物一齐是齐物的结论。从道的视角看，万物虽形态各异但本质齐一，因此各种是非辩论都是相对的、无意义的。",
    en: "The ten thousand things being one is the conclusion of making things equal. From the perspective of dao, the ten thousand things are fundamentally one; hence all right-wrong debates are relative.",
  },
  {
    id: "rel-zhuangzi-skill-self",
    zh: "技艺修养的极致是忘我。庖丁解牛、佝偻承蜩等寓言表明，技艺修炼到极致时，主体与客体合一，自我意识消解。",
    en: "The pinnacle of skill cultivation is self-forgetfulness. Parables like Cook Ding show that when skill reaches its peak, subject and object merge and self-consciousness dissolves.",
  },
  {
    id: "rel-zhuangzi-life-death-oneness",
    zh: "生死一如是万物一齐的体现。方生方死，方死方生。生死是道之流行的两个阶段，本质上是一气之聚散，没有绝对界限。",
    en: "Life and death being as one expresses the oneness of all things. Just born, already dying; just dying, already being born. Life and death are two phases of dao's flow.",
  },
  {
    id: "rel-zhuangzi-wandering-self",
    zh: "逍遥游要求无己无功无名。至人无己，神人无功，圣人无名。只有破除对自我、功业、名声的执着，才能达到真正的逍遥。",
    en: "Free wandering requires no self, no merit, no name. The ultimate person has no self; the spirit-person has no merit; the sage has no name.",
  },
  {
    id: "rel-mencius-sprouts-good",
    zh: "四端是性善的心性基础。恻隐、羞恶、辞让、是非四端是人心固有，扩充之则为仁义礼智，证明人性本善。",
    en: "The four sprouts are the psychological basis of human nature being good. Compassion, shame, deference, right-wrong — the four sprouts are inherent in the human mind.",
  },
  {
    id: "rel-mencius-people-virtue",
    zh: "民本是王道政治的核心原则。民为贵，社稷次之，君为轻。王道政治必须以民为本，保民而王才能统一天下。",
    en: "People-before-ruler is the core principle of kingly way politics. The people are most important, the altars next, the ruler least.",
  },
  {
    id: "rel-mencius-qi-sprouts",
    zh: "养浩然之气是扩充四端的修养工夫。浩然之气是集义所生，通过道德修养的积累，将四端之心扩充至充沛完满的境界。",
    en: "Cultivating flood-like qi is the cultivation practice for extending the four sprouts. Flood-like qi is born from accumulated righteousness.",
  },
  {
    id: "rel-mencius-rightness-kingly",
    zh: "王何必曰利是王道的义利观。孟子见梁惠王，首章即辨义利。王道政治以仁义为本，上下交征利则国危矣。",
    en: "Why must the king speak of profit — the kingly way's view of rightness vs profit. When Mencius meets King Hui of Liang, the first chapter distinguishes rightness from profit.",
  },
  {
    id: "rel-mencius-good-kingly",
    zh: "性善论是仁政的人性论基础。人皆有不忍人之心，先王有不忍人之心，斯有不忍人之政矣。",
    en: "The theory of good human nature grounds benevolent government. All humans have a mind that cannot bear the suffering of others.",
  },
  {
    id: "rel-xunzi-nature-ritual",
    zh: "化性起伪需要礼义规范。人之性恶，其善者伪也。礼义是圣人所立，用于矫治人性、建立秩序的人为规范。",
    en: "Transforming nature requires ritual and rightness as norms. Human nature is evil; its goodness is artificial (wei).",
  },
  {
    id: "rel-xunzi-learning-nature",
    zh: "劝学是化性起伪的入门工夫。学不可以已。通过持续不断的学习积累，人可以改变先天本性，积累善德。",
    en: "Encouraging learning is the entry-level practice for transforming nature. Learning must never cease.",
  },
  {
    id: "rel-xunzi-heaven-ritual",
    zh: "天行有常故治乱在人不在天。天不为人之恶寒也辍冬，地不为人之恶辽远也辍广。因此人间秩序只能靠礼义人为建立。",
    en: "Heaven has constant patterns, hence order and chaos depend on humans not heaven. Heaven does not suspend winter because humans dislike cold.",
  },
  {
    id: "rel-xunzi-rectification-order",
    zh: "正名是维护礼治秩序的语言制度。荀子重正名，认为名实相符才能避免混乱，使贵贱分明、异同不淆。",
    en: "Rectification of names is the linguistic institution for maintaining ritual order. Xunzi emphasizes rectifying names to avoid chaos.",
  },
  {
    id: "rel-xunzi-yi-li-learning",
    zh: "学习可以使人重义轻利。荀子虽认为人性趋利，但通过学习礼义，可以改变本性，形成重义轻利的品格。",
    en: "Learning enables one to value rightness over profit. Although Xunzi holds that human nature tends toward profit, through learning ritual and rightness, one can transform nature.",
  },
  {
    id: "rel-mozi-care-order",
    zh: "兼爱与尚同互为支撑。兼爱是道德原则，尚同是政治制度，两者结合才能实现天下大治：人人兼爱，上下同利。",
    en: "Inclusive care and upholding uniformity mutually support each other. Inclusive care is the moral principle; upholding uniformity is the political institution.",
  },
  {
    id: "rel-mozi-offensive-care",
    zh: "非攻是兼爱在战争问题上的体现。攻伐他国，亏人自利，与兼爱之道正相违背。非攻是兼爱思想在军事政治领域的直接延伸。",
    en: "Condemning offensive war expresses inclusive care on the question of war. Attacking other countries contradicts the way of inclusive care.",
  },
  {
    id: "rel-mozi-heaven-will-care",
    zh: "天志是兼爱的超越性依据。天兼爱天下百姓，天意欲人相爱相利。因此人的兼爱不是人为约定，而是效法天志的必然要求。",
    en: "The will of heaven is the transcendent ground of inclusive care. Heaven inclusively cares for all the people of the world; heaven's will desires humans to love and benefit each other.",
  },
  {
    id: "rel-mozi-frugality-care",
    zh: "节用是利民兼爱的经济要求。节用节葬，去无用之费，这样才能减轻百姓负担，使天下之利最大化，体现兼爱利民的宗旨。",
    en: "Frugality is the economic requirement of benefiting the people and inclusive care. Frugality in expenditure lightens the burden on the people.",
  },
  {
    id: "rel-mozi-merit-care",
    zh: "尚贤是实现兼爱社会的用人政策。官无常贵而民无终贱，有能则举之。尚贤打破世袭，使贤能之人治国。",
    en: "Elevating the worthy is the personnel policy for realizing an inclusive-care society. Officials are not permanently noble; common people are not permanently base.",
  },
  {
    id: "rel-confucius-laozi-ritual-wuwei",
    zh: "孔子重礼教化 vs 老子主无为。孔子主张通过礼义教化积极修身治国，老子则认为礼是忠信之薄而乱之首，主张无为而治。",
    en: "Confucius values ritual cultivation vs Laozi advocates wuwei. Confucius advocates actively cultivating oneself through ritual; Laozi holds that ritual is the beginning of chaos.",
  },
  {
    id: "rel-mencius-zhuangzi-nature",
    zh: "孟子性善有定 vs 庄子无己无定。孟子认为人性有确定的善端，可以扩充成德；庄子则认为自我是流动不定的，应破除我执而与道合一。",
    en: "Mencius' determinate good nature vs Zhuangzi's no-fixed-self. Mencius holds human nature has determinate moral sprouts; Zhuangzi holds the self is fluid.",
  },
  {
    id: "rel-mencius-mozi-yi-care",
    zh: "孟子义利之辨批判墨子功利。孟子严辨义利，反对以利为出发点；而墨子兼爱以兴天下之利为目标，带有鲜明的功利主义色彩。",
    en: "Mencius' rightness-profit distinction critiques Mohist utilitarianism. Mencius strictly distinguishes rightness from profit; Mozi's inclusive care aims at promoting the benefit of the world.",
  },
  {
    id: "rel-xunzi-mozi-ritual-frugality",
    zh: "荀子隆礼 vs 墨子节用。荀子认为礼的文饰制度对于维持社会秩序和道德教化是必要的；墨子节用节葬则反对一切无用之费。",
    en: "Xunzi exalts ritual vs Mozi promotes frugality. Xunzi believes ritual institutions are necessary for social order; Mozi's frugality opposes all useless expenditure.",
  },
  {
    id: "rel-laozi-shangyang-wuwei-law",
    zh: "道家无为而治 vs 法家以法治国。老子主张减少政令、无为而治；商鞅则主张建立明确的法令制度，以赏罚二柄驱民耕战。",
    en: "Daoist wuwei rule vs Legalist rule by law. Laozi advocates reducing government edicts; Shang Yang advocates establishing clear legal institutions.",
  },
  {
    id: "rel-zhuangzi-shen-dao-technical",
    zh: "庄子技艺入道 vs 申不害形名术。庄子的技艺修养是为了消解自我、与道合一；申不害的刑名之术则是君主驾驭臣下的政治技术。",
    en: "Zhuangzi's skill-as-merge-with-dao vs Shen Buhai's technique of names and performance. Zhuangzi's skill cultivation aims at dissolving the self; Shen Buhai's technique is for the ruler to control ministers.",
  },
  {
    id: "rel-huishi-zhuangzi-oneness",
    zh: "惠施合同异与庄子齐物相通。惠施历物之意有大同异小同异之辨，最终归于万物毕同毕异；庄子齐物论亦破除是非差别而归一。",
    en: "Hui Shi's uniting same-difference resonates with Zhuangzi's making things equal. Hui Shi's theses reach all things being entirely same and entirely different; Zhuangzi also dismantles distinctions.",
  },
  {
    id: "rel-xunzi-hanfei-nature-law",
    zh: "荀子性恶论为法家法治提供了人性论基础。荀子认为人性本恶需要礼义矫治；法家由此发展出以法治刑赏约束人性的治国方案。",
    en: "Xunzi's evil-nature theory provides the human-nature foundation for Legalist rule by law. Xunzi holds human nature is evil and requires rectification; Legalism developed law-based governance from this.",
  },
  {
    id: "rel-xunzi-hanfei-rectification",
    zh: "荀子正名思想影响法家刑名之术。荀子重正名以明贵贱辨异同；法家则将名实关系转化为君主考核臣下的形名参同之术。",
    en: "Xunzi's rectification of names influenced the Legalist technique of names and performance. Xunzi values rectifying names; Legalists transformed name-reality into a technique for evaluating ministers.",
  },
  {
    id: "rel-dongzhongshu-xunzi-heaven",
    zh: "董仲舒天人感应 vs 荀子天行有常。荀子认为天行有常、不以人的意志为转移；董仲舒则提出天人感应，天以灾异谴告人君。",
    en: "Dong Zhongshu's heaven-human resonance vs Xunzi's heaven has constant patterns. Xunzi holds heaven has constant patterns; Dong Zhongshu proposes heaven-human resonance with disasters warning the ruler.",
  },
  {
    id: "rel-zouyan-confucius-order",
    zh: "五德终始说为德治提供了宇宙论框架。邹衍以阴阳五行解释朝代更替，每个朝代对应一德；这与儒家重视德治的取向有相近之处。",
    en: "Five virtues cyclical theory provides a cosmological framework for virtue rule. Zou Yan explains dynastic succession through yin-yang and five phases; this has affinities with Confucian virtue rule.",
  },
];

let added = 0;
for (const rel of newRelationTexts) {
  const keyZh = `${rel.id}|zh-CN`;
  const keyEn = `${rel.id}|en`;
  
  if (!existingKeys.has(keyZh)) {
    validLines.push([rel.id, "zh-CN", rel.zh, "reviewed", "phase1-editorial", "2026-07-14"].map(csvEscape).join(","));
    existingKeys.add(keyZh);
    added++;
  }
  if (!existingKeys.has(keyEn)) {
    validLines.push([rel.id, "en", rel.en, "reviewed", "phase1-editorial", "2026-07-14"].map(csvEscape).join(","));
    existingKeys.add(keyEn);
    added++;
  }
}

fs.writeFileSync(relTextsFile, validLines.join("\n") + "\n", "utf8");
console.log(`Cleaned relation_texts.csv, added ${added} new text entries`);
