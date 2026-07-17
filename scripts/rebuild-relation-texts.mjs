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

const header = "relation_id,locale,note,translation_status,reviewer,reviewed_at";

const relationTexts = {
  "rel-confucius-xunzi-ritual": {
    zh: "两者都把礼视为道德实践的关键；荀子进一步给出欲望调节与制度秩序的系统说明。",
    en: "Both treat ritual as central to ethical practice; Xunzi develops a more systematic account of desire regulation and institutional order.",
  },
  "rel-confucius-mencius-cultivation": {
    zh: "孟子的四端说扩展了儒家内在德性如何开始并通过修养成长的问题。",
    en: "Mencius's theory of the four sprouts extends the question of how inner moral virtue begins and grows through cultivation.",
  },
  "rel-confucius-mozi-care": {
    zh: "恕与兼爱都限制只顾自身的行动，但适用范围和伦理结构并不相同。",
    en: "Both reciprocity and inclusive care constrain self-centered action, but their scope and ethical structure differ.",
  },
  "rel-confucius-mozi-partiality": {
    zh: "墨家批评差等之爱可能造成偏私；儒家则从具体关系和礼的秩序展开仁。",
    en: "Mohists criticize graded love as potentially partial; Confucians develop ren from concrete relationships and ritual order.",
  },
  "rel-confucius-mencius-rule": {
    zh: "孟子把德治传统推进到人民优先与统治正当性的判断。",
    en: "Mencius advances the tradition of virtue rule toward judgments of people priority and political legitimacy.",
  },
  "rel-laozi-zhuangzi-language": {
    zh: "庄子对视角和是非分别的分析扩展了老子关于语言与命名限度的问题。",
    en: "Zhuangzi's analysis of perspectives and right-wrong distinctions extends Laozi's question about the limits of language and naming.",
  },
  "rel-laozi-zhuangzi-naturalness": {
    zh: "两条观点都把人放回更大的自然与万物过程之中。",
    en: "Both positions place humans back within the larger process of nature and the ten thousand things.",
  },
  "rel-laozi-confucius-government": {
    zh: "两者都能被理解为对强制政治的限制，但德治与无为的理论根据不同。",
    en: "Both can be read as limiting coercive politics, but the theoretical grounds of virtue rule and wuwei differ.",
  },
  "rel-mozi-confucius-appointment": {
    zh: "尚贤与德治都要求政治角色具有道德能力，而不只依靠身份或强制。",
    en: "Both elevating the worthy and virtue rule require moral capacity for political roles, not merely status or coercion.",
  },
  "rel-mozi-mencius-welfare": {
    zh: "两者都以人民生活和社会秩序评价政治，不过论证基础不同。",
    en: "Both evaluate politics by people's lives and social order, though their justificatory foundations differ.",
  },
  "rel-mencius-xunzi-nature": {
    zh: "孟子主张人性趋善，荀子主张未经塑造的自然倾向不足以成善，构成直接的人性论对照。",
    en: "Mencius holds human nature tends toward goodness; Xunzi holds unshaped natural tendencies are insufficient for goodness — a direct contrast in the theory of human nature.",
  },
  "rel-mencius-xunzi-moral-source": {
    zh: "四端说强调内在道德开端，礼论强调外在制度与积习的转化作用。",
    en: "The four-sprouts theory emphasizes inner moral beginnings; the theory of ritual emphasizes the transforming role of external institutions and accumulated practice.",
  },
  "rel-laozi-xunzi-nature": {
    zh: "两者都反对把自然过程完全等同于人的意志，但老子的自然与荀子的天论并非同一概念。",
    en: "Both reject reducing natural processes entirely to human will, but Laozi's ziran and Xunzi's theory of heaven are not the same concept.",
  },
  "rel-zhuangzi-xunzi-heaven": {
    zh: "庄子趋向松动人与万物的固定分界，荀子则更明确地区分天的常则与人事。",
    en: "Zhuangzi tends to loosen fixed boundaries between humans and all things; Xunzi more sharply distinguishes heaven's constant patterns from human affairs.",
  },
  "rel-confucius-xunzi-rectification": {
    zh: "荀子系统发展了孔子的正名思想，从政治伦理扩展到逻辑学和语言哲学层面。",
    en: "Xunzi systematically develops Confucius's rectification of names, extending it from political ethics to logic and philosophy of language.",
  },
  "rel-confucius-superior-mencius-nature": {
    zh: "孟子的性善论为孔子君子人格的道德修养提供了人性论基础。",
    en: "Mencius's theory of good human nature provides the human-nature foundation for the moral cultivation of Confucius's junzi personality.",
  },
  "rel-confucius-harmony-superior": {
    zh: "和而不同是君子人格在社会交往中的体现，两者同属孔子关于理想人格的论述。",
    en: "Harmony without uniformity expresses the junzi personality in social interaction; both belong to Confucius's account of the ideal person.",
  },
  "rel-confucius-mencius-kingly-way": {
    zh: "孟子的王道论是对孔子德治思想的系统发展，以仁政和民本为核心内容。",
    en: "Mencius's kingly way theory is a systematic development of Confucius's virtue rule, centered on benevolent government and people-before-ruler.",
  },
  "rel-confucius-mencius-rightness-profit": {
    zh: "孟子将孔子君子喻于义、小人喻于利的区分扩展为治国理政的根本原则问题。",
    en: "Mencius extends Confucius's distinction between the junzi who understands rightness and the petty person who understands profit into a fundamental principle of governing.",
  },
  "rel-mencius-sprouts-flood-qi": {
    zh: "浩然之气是四端通过集义修养所达到的最高境界，是孟子心性修养论的顶点。",
    en: "Flood-like qi is the highest state attained by the four sprouts through accumulating righteousness — the pinnacle of Mencius's theory of mind-cultivation.",
  },
  "rel-xunzi-learning-nature-transformation": {
    zh: "劝学是荀子化性起伪思想的实践路径——通过持续不断的学习来转化人的本性。",
    en: "Encouraging learning is the practical path of Xunzi's thought of transforming nature through artifice — transforming human nature through continuous learning.",
  },
  "rel-xunzi-rectification-ritual": {
    zh: "正名与礼制都是荀子社会秩序理论的核心，名辨是礼的制度运作的语言基础。",
    en: "Both rectification of names and ritual institutions are central to Xunzi's theory of social order; name-distinction is the linguistic basis for the institutional operation of ritual.",
  },
  "rel-mencius-xunzi-rightness-profit": {
    zh: "孟荀都主张以义为先、以义克利，但孟子从性善论出发，荀子则从化性起伪立论。",
    en: "Both Mencius and Xunzi hold that rightness takes priority over profit and that rightness overcomes profit, but Mencius argues from good human nature while Xunzi grounds his position in transforming nature through artifice.",
  },
  "rel-laozi-zhuangzi-reversal-qiwu": {
    zh: "老子的反者道之动与庄子的齐物论都强调事物的相对性和相互转化，是道家辩证思维的核心。",
    en: "Laozi's 'reversal is the movement of dao' and Zhuangzi's 'making things equal' both emphasize the relativity and mutual transformation of things — core Daoist dialectical thinking.",
  },
  "rel-laozi-softness-zhuangzi-skill": {
    zh: "庄子庖丁解牛的寓言把老子柔弱胜刚强的思想具体化为一种通过技艺体悟大道的修养境界。",
    en: "Zhuangzi's parable of Cook Ding concretizes Laozi's thought of the soft overcoming the hard into a cultivation state of realizing the great dao through skill.",
  },
  "rel-laozi-contentment-zhuangzi-wandering": {
    zh: "知足不辱与逍遥游都指向对外在物欲的超越，但老子偏于节制，庄子偏于精神的绝对自由。",
    en: "Contentment brings no disgrace and free wandering both point to transcending external material desires, but Laozi leans toward moderation and Zhuangzi toward absolute spiritual freedom.",
  },
  "rel-zhuangzi-wandering-qiwu": {
    zh: "逍遥游是庄子的人生理想，齐物论是其认识论基础——只有齐物才能达到无待的逍遥。",
    en: "Free and easy wandering is Zhuangzi's life ideal; the discussion on making things equal is its epistemological foundation — only by making things equal can one attain unconditioned wandering freedom.",
  },
  "rel-laozi-reversal-life-death": {
    zh: "庄子的生死观是老子反者道之动在生命哲学上的展开，生死不过是道的循环转化。",
    en: "Zhuangzi's view of life and death develops Laozi's reversal as dao's movement into philosophy of life — life and death are merely dao's cyclical transformations.",
  },
  "rel-laozi-wuwei-confucius-virtue": {
    zh: "老子的无为而治与孔子的德治表面相似，但老子反对礼义和教化，孔子则以德礼为核心，存在根本分歧。",
    en: "Laozi's wuwei rule and Confucius's virtue rule appear similar on the surface, but Laozi rejects ritual rightness and education while Confucius centers virtue and ritual — a fundamental divergence.",
  },
  "rel-zhuangzi-wandering-mencius-qi": {
    zh: "庄子的逍遥与孟子的浩然之气都是崇高的精神境界，但逍遥是超越道德的，浩然之气是道德的充养。",
    en: "Zhuangzi's wandering freedom and Mencius's flood-like qi are both sublime spiritual states, but wandering freedom transcends morality while flood-like qi is moral fullness.",
  },
  "rel-mozi-offensive-war-strategy": {
    zh: "墨子非攻与孙子不战而屈人之兵都对战争持审慎态度，但墨子从道义出发，孙子从战略出发。",
    en: "Mozi's condemnation of offensive war and Sunzi's subduing the enemy without fighting both take a cautious attitude toward war, but Mozi argues from morality and Sunzi from strategy.",
  },
  "rel-mozi-will-heaven-confucius": {
    zh: "墨子以天志为道德的客观外在标准，孔子则将道德的根源置于人心的修养和礼的践履。",
    en: "Mozi takes the will of heaven as the objective external standard of morality; Confucius locates the source of morality in the cultivation of the human heart and the practice of ritual.",
  },
  "rel-mozi-frugality-laozi-contentment": {
    zh: "墨子节用与老子知足都主张克制欲望、减少浪费，但墨子出于功利计算，老子出于个人修养。",
    en: "Mozi's frugality and Laozi's contentment both advocate restraining desire and reducing waste, but Mozi does so from utilitarian calculation and Laozi from personal cultivation.",
  },
  "rel-mozi-merit-xunzi-rectification": {
    zh: "墨子尚贤与荀子正名都强调政治职位的分配应与实际能力和名分相符。",
    en: "Both Mozi's elevating the worthy and Xunzi's rectification of names emphasize that political positions should be distributed according to actual ability and matching titles.",
  },
  "rel-mozi-care-mencius-people": {
    zh: "墨家兼爱与孟子民本都重视民众的福祉，但墨子主张无差等的爱，孟子则坚持爱有差等的仁爱。",
    en: "Mohist inclusive care and Mencian people-before-ruler both value the people's well-being, but Mozi advocates undifferentiated love while Mencius upholds graded benevolent love.",
  },
  "rel-zhuangzi-gongsun-long": {
    zh: "庄子齐物论对名家的概念分析持批评态度，认为语言的区分遮蔽了事物的本然齐一。",
    en: "Zhuangzi's 'making things equal' takes a critical stance toward the School of Names' conceptual analysis, holding that linguistic distinctions obscure the inherent equality of things.",
  },
  "rel-xunzi-gaozi-nature": {
    zh: "告子生之谓性与荀子性恶论都把人性理解为天生的材质，但告子认为性无善恶，荀子认为性趋向恶。",
    en: "Both Gaozi's 'life is what we mean by nature' and Xunzi's evil-nature theory understand human nature as innate material, but Gaozi holds nature is neither good nor evil while Xunzi holds it tends toward evil.",
  },
  "rel-han-fei-xunzi-nature": {
    zh: "韩非子继承了荀子性恶论的基本预设，但他放弃了化性起伪的礼义教化路径，转而以赏罚二柄治国。",
    en: "Han Fei inherits the basic presupposition of Xunzi's evil-nature theory, but abandons the path of ritual-moral education for transforming nature, turning instead to governing with the two handles of reward and punishment.",
  },
  "rel-shang-yang-han-fei": {
    zh: "商鞅重法、重信、重权的思想被韩非综合发展为法、术、势相结合的系统政治理论。",
    en: "Shang Yang's thought of emphasizing law, trust, and authority was synthesized and developed by Han Fei into a systematic political theory combining law, technique, and power.",
  },
  "rel-laozi-sunzi-softness-strategy": {
    zh: "老子柔弱胜刚强与孙子不战而屈人之兵都体现了以柔克刚、以智取胜的战略思维。",
    en: "Laozi's the soft overcoming the hard and Sunzi's subduing the enemy without fighting both embody strategic thinking of overcoming the strong through softness and winning through wisdom.",
  },
  "rel-confucius-rectification-language-dao": {
    zh: "孔子认为正名是政治和伦理的基础，相信语言可以承载秩序；老子则认为常道不可言说，名对终极实在构成遮蔽。",
    en: "Confucius holds rectifying names is the foundation of politics and ethics, believing language can bear order; Laozi holds the constant dao cannot be spoken and naming obscures ultimate reality.",
  },
  "rel-mozi-care-xunzi-ritual": {
    zh: "墨子主张节用节葬、反对礼乐浪费，荀子则认为礼制和礼乐是维持社会秩序、调节人欲的必要制度。",
    en: "Mozi advocates frugality and moderate funerals, opposing ritual-music waste; Xunzi holds ritual institutions and music are necessary for maintaining social order and regulating human desire.",
  },
  "rel-mencius-people-xunzi-ritual": {
    zh: "孟子民本与荀子礼制都认为政治的目的是人民的福祉，但孟子侧重仁心的扩充，荀子侧重制度的建构。",
    en: "Both Mencian people-before-ruler and Xunzian ritual institutions hold that the purpose of politics is the people's well-being, but Mencius emphasizes extending the benevolent heart and Xunzi emphasizes constructing institutions.",
  },
  "rel-zhuangzi-skill-zhuangzi-life-death": {
    zh: "庖丁解牛以技艺体道与鼓盆而歌以安时处顺都是庄子关于如何与道合一的生活实践。",
    en: "Cook Ding realizing dao through skill and Zhuangzi drumming on a basin and singing at his wife's death, accepting time and going along with change — both are Zhuangzi's life practices for merging with dao.",
  },
  "rel-confucius-ren-rectification": {
    zh: "正名是仁礼秩序在语言政治层面的延伸。孔子以仁为内核、以礼为制度，而正名思想要求名实相符，是维持礼治秩序的必要条件。",
    en: "Rectification of names extends ren-li order to the linguistic-political sphere. Confucius takes ren as inner core and li as institutional framework; the rectification of names is a necessary condition for maintaining ritual order.",
  },
  "rel-confucius-junzi-ren": {
    zh: "君子是仁的人格载体。君子是孔子理想人格的体现，其核心品质即仁，通过践行礼来完成道德修养。",
    en: "The superior person is the embodiment of ren. The superior person embodies Confucius's ideal personality, whose core quality is ren, accomplished through the practice of li.",
  },
  "rel-confucius-harmony-junzi": {
    zh: "和而不同是君子的处世品格。孔子曰'君子和而不同，小人同而不和'，和谐共处又保持独立见解是君子的标志。",
    en: "Harmony without uniformity is the junzi's way of being in the world. Confucius says 'The superior person is harmonious but not uniform; the petty person is uniform but not harmonious.'",
  },
  "rel-confucius-virtue-rectification": {
    zh: "正名是德治的制度前提。为政必先正名，名不正则言不顺，言不顺则事不成，德治也就无法落实。",
    en: "Rectification of names is the institutional precondition of virtue rule. Governing must begin with rectifying names; if names are not correct, speech will not be smooth, affairs will not succeed.",
  },
  "rel-confucius-reciprocity-ren": {
    zh: "恕是仁的实践方法。己所不欲勿施于人，恕道是将仁心推及他人的具体路径，贯穿于礼的践行之中。",
    en: "Reciprocity (shu) is the method of practicing ren. Do not do to others what you do not wish for yourself. The way of shu is the concrete path of extending ren to others.",
  },
  "rel-laozi-wuwei-naturalness": {
    zh: "无为以自然为依据。无为不是什么都不做，而是效法自然，不妄为不强为，让事物按照自身本性发展。",
    en: "Wuwei is grounded in naturalness (ziran). Wuwei does not mean doing nothing; it means modeling oneself on nature, acting without arbitrary force.",
  },
  "rel-laozi-reversal-softness": {
    zh: "反者道之动解释了柔弱胜刚强。反者道之动是老子辩证思维的核心，事物向对立面转化，因此柔弱处下反而能胜刚强。",
    en: "Reversal as dao's movement explains why soft overcomes hard. Reversal is the movement of dao — the core of Laozi's dialectical thinking.",
  },
  "rel-laozi-contentment-softness": {
    zh: "知足是柔弱处世的修养要求。知足不辱，知止不殆。懂得满足和适可而止，是践行柔弱不争之道的具体表现。",
    en: "Contentment is the self-cultivation requirement of the soft way of life. Contentment brings no disgrace; knowing where to stop brings no danger.",
  },
  "rel-laozi-dao-wuwei": {
    zh: "道不可言说，故应无为而治。道常无名，超越语言把握，因此圣人治国也应处无为之事，行不言之教。",
    en: "Dao cannot be spoken, hence one should rule by wuwei. Dao is always nameless and transcends linguistic grasp; thus the sage governs by doing nothing.",
  },
  "rel-laozi-reversal-natural": {
    zh: "道法自然蕴含对立面转化规律。人法地，地法天，天法道，道法自然。自然本身就包含着物极必反的辩证规律。",
    en: "Dao modeling on nature contains the law of opposite transformation. Humanity models on earth, earth models on heaven, heaven models on dao, dao models on nature.",
  },
  "rel-zhuangzi-perspectives-wandering": {
    zh: "破除是非方能逍遥。齐物论破除是非彼此的执着，逍遥游则是达到精神自由的境界，前者是方法，后者是境界。",
    en: "Free wandering requires transcending right-wrong distinctions. The Discussion on Making All Things Equal dismantles attachments; Free and Easy Wandering is the state of spiritual freedom.",
  },
  "rel-zhuangzi-oneness-perspectives": {
    zh: "万物一齐是齐物的结论。从道的视角看，万物虽形态各异但本质齐一，因此各种是非辩论都是相对的、无意义的。",
    en: "The ten thousand things being one is the conclusion of making things equal. From the perspective of dao, the ten thousand things are fundamentally one; hence all right-wrong debates are relative.",
  },
  "rel-zhuangzi-skill-self": {
    zh: "技艺修养的极致是忘我。庖丁解牛、佝偻承蜩等寓言表明，技艺修炼到极致时，主体与客体合一，自我意识消解。",
    en: "The pinnacle of skill cultivation is self-forgetfulness. Parables like Cook Ding show that when skill reaches its peak, subject and object merge and self-consciousness dissolves.",
  },
  "rel-zhuangzi-life-death-oneness": {
    zh: "生死一如是万物一齐的体现。方生方死，方死方生。生死是道之流行的两个阶段，本质上是一气之聚散，没有绝对界限。",
    en: "Life and death being as one expresses the oneness of all things. Just born, already dying; just dying, already being born. Life and death are two phases of dao's flow.",
  },
  "rel-zhuangzi-wandering-self": {
    zh: "逍遥游要求无己无功无名。至人无己，神人无功，圣人无名。只有破除对自我、功业、名声的执着，才能达到真正的逍遥。",
    en: "Free wandering requires no self, no merit, no name. The ultimate person has no self; the spirit-person has no merit; the sage has no name.",
  },
  "rel-mencius-sprouts-good": {
    zh: "四端是性善的心性基础。恻隐、羞恶、辞让、是非四端是人心固有，扩充之则为仁义礼智，证明人性本善。",
    en: "The four sprouts are the psychological basis of human nature being good. Compassion, shame, deference, right-wrong — the four sprouts are inherent in the human mind.",
  },
  "rel-mencius-people-virtue": {
    zh: "民本是王道政治的核心原则。民为贵，社稷次之，君为轻。王道政治必须以民为本，保民而王才能统一天下。",
    en: "People-before-ruler is the core principle of kingly way politics. The people are most important, the altars next, the ruler least.",
  },
  "rel-mencius-qi-sprouts": {
    zh: "养浩然之气是扩充四端的修养工夫。浩然之气是集义所生，通过道德修养的积累，将四端之心扩充至充沛完满的境界。",
    en: "Cultivating flood-like qi is the cultivation practice for extending the four sprouts. Flood-like qi is born from accumulated righteousness.",
  },
  "rel-mencius-rightness-kingly": {
    zh: "王何必曰利是王道的义利观。孟子见梁惠王，首章即辨义利。王道政治以仁义为本，上下交征利则国危矣。",
    en: "Why must the king speak of profit — the kingly way's view of rightness vs profit. When Mencius meets King Hui of Liang, the first chapter distinguishes rightness from profit.",
  },
  "rel-mencius-good-kingly": {
    zh: "性善论是仁政的人性论基础。人皆有不忍人之心，先王有不忍人之心，斯有不忍人之政矣。",
    en: "The theory of good human nature grounds benevolent government. All humans have a mind that cannot bear the suffering of others.",
  },
  "rel-xunzi-nature-ritual": {
    zh: "化性起伪需要礼义规范。人之性恶，其善者伪也。礼义是圣人所立，用于矫治人性、建立秩序的人为规范。",
    en: "Transforming nature requires ritual and rightness as norms. Human nature is evil; its goodness is artificial (wei).",
  },
  "rel-xunzi-learning-nature": {
    zh: "劝学是化性起伪的入门工夫。学不可以已。通过持续不断的学习积累，人可以改变先天本性，积累善德。",
    en: "Encouraging learning is the entry-level practice for transforming nature. Learning must never cease.",
  },
  "rel-xunzi-heaven-ritual": {
    zh: "天行有常故治乱在人不在天。天不为人之恶寒也辍冬，地不为人之恶辽远也辍广。因此人间秩序只能靠礼义人为建立。",
    en: "Heaven has constant patterns, hence order and chaos depend on humans not heaven. Heaven does not suspend winter because humans dislike cold.",
  },
  "rel-xunzi-rectification-order": {
    zh: "正名是维护礼治秩序的语言制度。荀子重正名，认为名实相符才能避免混乱，使贵贱分明、异同不淆。",
    en: "Rectification of names is the linguistic institution for maintaining ritual order. Xunzi emphasizes rectifying names to avoid chaos.",
  },
  "rel-xunzi-yi-li-learning": {
    zh: "学习可以使人重义轻利。荀子虽认为人性趋利，但通过学习礼义，可以改变本性，形成重义轻利的品格。",
    en: "Learning enables one to value rightness over profit. Although Xunzi holds that human nature tends toward profit, through learning ritual and rightness, one can transform nature.",
  },
  "rel-mozi-care-order": {
    zh: "兼爱与尚同互为支撑。兼爱是道德原则，尚同是政治制度，两者结合才能实现天下大治：人人兼爱，上下同利。",
    en: "Inclusive care and upholding uniformity mutually support each other. Inclusive care is the moral principle; upholding uniformity is the political institution.",
  },
  "rel-mozi-offensive-care": {
    zh: "非攻是兼爱在战争问题上的体现。攻伐他国，亏人自利，与兼爱之道正相违背。非攻是兼爱思想在军事政治领域的直接延伸。",
    en: "Condemning offensive war expresses inclusive care on the question of war. Attacking other countries contradicts the way of inclusive care.",
  },
  "rel-mozi-heaven-will-care": {
    zh: "天志是兼爱的超越性依据。天兼爱天下百姓，天意欲人相爱相利。因此人的兼爱不是人为约定，而是效法天志的必然要求。",
    en: "The will of heaven is the transcendent ground of inclusive care. Heaven inclusively cares for all the people of the world; heaven's will desires humans to love and benefit each other.",
  },
  "rel-mozi-frugality-care": {
    zh: "节用是利民兼爱的经济要求。节用节葬，去无用之费，这样才能减轻百姓负担，使天下之利最大化，体现兼爱利民的宗旨。",
    en: "Frugality is the economic requirement of benefiting the people and inclusive care. Frugality in expenditure lightens the burden on the people.",
  },
  "rel-mozi-merit-care": {
    zh: "尚贤是实现兼爱社会的用人政策。官无常贵而民无终贱，有能则举之。尚贤打破世袭，使贤能之人治国。",
    en: "Elevating the worthy is the personnel policy for realizing an inclusive-care society. Officials are not permanently noble; common people are not permanently base.",
  },
  "rel-confucius-laozi-ritual-wuwei": {
    zh: "孔子重礼教化 vs 老子主无为。孔子主张通过礼义教化积极修身治国，老子则认为礼是忠信之薄而乱之首，主张无为而治。",
    en: "Confucius values ritual cultivation vs Laozi advocates wuwei. Confucius advocates actively cultivating oneself through ritual; Laozi holds that ritual is the beginning of chaos.",
  },
  "rel-mencius-zhuangzi-nature": {
    zh: "孟子性善有定 vs 庄子无己无定。孟子认为人性有确定的善端，可以扩充成德；庄子则认为自我是流动不定的，应破除我执而与道合一。",
    en: "Mencius' determinate good nature vs Zhuangzi's no-fixed-self. Mencius holds human nature has determinate moral sprouts; Zhuangzi holds the self is fluid.",
  },
  "rel-mencius-mozi-yi-care": {
    zh: "孟子义利之辨批判墨子功利。孟子严辨义利，反对以利为出发点；而墨子兼爱以兴天下之利为目标，带有鲜明的功利主义色彩。",
    en: "Mencius's rightness-profit distinction critiques Mohist utilitarianism. Mencius strictly distinguishes rightness from profit; Mozi's inclusive care aims at promoting the benefit of the world.",
  },
  "rel-xunzi-mozi-ritual-frugality": {
    zh: "荀子隆礼 vs 墨子节用。荀子认为礼的文饰制度对于维持社会秩序和道德教化是必要的；墨子节用节葬则反对一切无用之费。",
    en: "Xunzi exalts ritual vs Mozi promotes frugality. Xunzi believes ritual institutions are necessary for social order; Mozi's frugality opposes all useless expenditure.",
  },
  "rel-laozi-shangyang-wuwei-law": {
    zh: "道家无为而治 vs 法家以法治国。老子主张减少政令、无为而治；商鞅则主张建立明确的法令制度，以赏罚二柄驱民耕战。",
    en: "Daoist wuwei rule vs Legalist rule by law. Laozi advocates reducing government edicts; Shang Yang advocates establishing clear legal institutions.",
  },
  "rel-zhuangzi-shen-dao-technical": {
    zh: "庄子技艺入道 vs 申不害形名术。庄子的技艺修养是为了消解自我、与道合一；申不害的刑名之术则是君主驾驭臣下的政治技术。",
    en: "Zhuangzi's skill-as-merge-with-dao vs Shen Buhai's technique of names and performance. Zhuangzi's skill cultivation aims at dissolving the self; Shen Buhai's technique is for the ruler to control ministers.",
  },
  "rel-huishi-zhuangzi-oneness": {
    zh: "惠施合同异与庄子齐物相通。惠施历物之意有大同异小同异之辨，最终归于万物毕同毕异；庄子齐物论亦破除是非差别而归一。",
    en: "Hui Shi's uniting same-difference resonates with Zhuangzi's making things equal. Hui Shi's theses reach all things being entirely same and entirely different; Zhuangzi also dismantles distinctions.",
  },
  "rel-xunzi-hanfei-nature-law": {
    zh: "荀子性恶论为法家法治提供了人性论基础。荀子认为人性本恶需要礼义矫治；法家由此发展出以法治刑赏约束人性的治国方案。",
    en: "Xunzi's evil-nature theory provides the human-nature foundation for Legalist rule by law. Xunzi holds human nature is evil and requires rectification; Legalism developed law-based governance from this.",
  },
  "rel-xunzi-hanfei-rectification": {
    zh: "荀子正名思想影响法家刑名之术。荀子重正名以明贵贱辨异同；法家则将名实关系转化为君主考核臣下的形名参同之术。",
    en: "Xunzi's rectification of names influenced the Legalist technique of names and performance. Xunzi values rectifying names; Legalists transformed name-reality into a technique for evaluating ministers.",
  },
  "rel-dongzhongshu-xunzi-heaven": {
    zh: "董仲舒天人感应 vs 荀子天行有常。荀子认为天行有常、不以人的意志为转移；董仲舒则提出天人感应，天以灾异谴告人君。",
    en: "Dong Zhongshu's heaven-human resonance vs Xunzi's heaven has constant patterns. Xunzi holds heaven has constant patterns; Dong Zhongshu proposes heaven-human resonance with disasters warning the ruler.",
  },
  "rel-zouyan-confucius-order": {
    zh: "五德终始说为德治提供了宇宙论框架。邹衍以阴阳五行解释朝代更替，每个朝代对应一德；这与儒家重视德治的取向有相近之处。",
    en: "Five virtues cyclical theory provides a cosmological framework for virtue rule. Zou Yan explains dynastic succession through yin-yang and five phases; this has affinities with Confucian virtue rule.",
  },
  "rel-mozi-care-order-frugality": {
    zh: "兼爱与节用都是墨子功利主义思想的组成部分——兼爱带来社会秩序，节用保障公共福利。",
    en: "Both inclusive care and frugality are components of Mozi's utilitarian thought — inclusive care brings social order, frugality ensures public welfare.",
  },
  "rel-xunzi-heaven-learning": {
    zh: "天行有常说明了天不干预人事，因此人的价值只能通过后天学习和礼义修养来实现。",
    en: "Heaven having constant patterns means heaven does not intervene in human affairs, hence human value can only be realized through acquired learning and ritual-moral cultivation.",
  },
  "rel-mencius-nature-sprouts": {
    zh: "性善论是孟子人性论的总纲，四端说是性善的具体体现——仁义礼智皆根于心。",
    en: "The theory of good human nature is the general principle of Mencius's theory of human nature; the four-sprouts theory is its concrete embodiment — ren, yi, li, zhi are all rooted in the heart.",
  },
  "rel-confucius-mozi-music": {
    zh: "孔子重视礼乐教化，认为乐能陶冶性情、移风易俗；墨子则认为音乐浪费人力物力，主张非乐。",
    en: "Confucius values ritual and music education, believing music can cultivate character and transform customs; Mozi holds music wastes human and material resources, advocating the condemnation of music.",
  },
  "rel-laozi-reversal-softness-old": {
    zh: "反者道之动是宇宙论原理，柔弱胜刚强是这一原理在事物关系中的具体体现。",
    en: "Reversal as dao's movement is a cosmological principle; the soft overcoming the hard is the concrete embodiment of this principle in relations among things.",
  },
};

const lines = [header];
for (const [id, texts] of Object.entries(relationTexts)) {
  lines.push([id, "zh-CN", texts.zh, "reviewed", "phase1-editorial", "2026-07-14"].map(csvEscape).join(","));
  lines.push([id, "en", texts.en, "reviewed", "phase1-editorial", "2026-07-14"].map(csvEscape).join(","));
}

fs.writeFileSync(relTextsFile, lines.join("\n") + "\n", "utf8");
console.log(`Wrote ${lines.length - 1} text entries (${Object.keys(relationTexts).length} relations × 2 languages)`);
