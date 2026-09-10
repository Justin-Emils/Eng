/**
 * 语料 · 考研阅读向(B2–C2 原创学术短文)。
 * 全文原创编写,供考研备考者通过阅读积累学术词汇;
 * 不抓取任何第三方版权文章。
 */

import type { RawArticle } from './build';

export const KAOYAN_ARTICLES: RawArticle[] = [
  {
    id: 'privacy-digital-economy',
    title: 'Privacy in the Age of the Data Economy',
    summary:
      'Personal data has become the currency of the internet economy. This essay examines why privacy is eroding and what individuals and regulators can realistically do about it.',
    level: 'B2',
    vocab: 5200,
    topicTags: ['科技', '社会', '新闻'],
    paragraphs: [
      'When we use a search engine, a map application, or a social network, we rarely pay with money. Instead, we surrender something less visible but increasingly valuable: detailed information about our habits, preferences, locations, and even our emotional states. Economists describe this arrangement as a data economy, in which personal information functions as the raw material for prediction and profit.',
      'The scale of collection is difficult to grasp. Every click, pause, and scroll can be recorded; every route we travel and every product we linger over becomes a data point. Firms combine these fragments into elaborate profiles that can anticipate our next purchase, our political leanings, or our vulnerability to persuasion. The accuracy of such predictions is often unsettling, and it has transformed advertising into a precise science of behavior.',
      'Why has this erosion of privacy met with so little resistance? Several forces reinforce one another. First, convenience is a powerful narcotic: features that remember our preferences and navigate our commutes are genuinely useful, and most users accept opaque terms of service without reading them. Second, the costs of surveillance are diffuse and delayed, while the benefits are immediate. Third, many people believe, with some justification, that they have nothing to hide, overlooking the fact that privacy protects not only secrets but also autonomy and the freedom to experiment without judgment.',
      'The consequences extend beyond individual discomfort. When a handful of corporations control vast repositories of behavioral data, they acquire formidable power over public opinion and market structure. Political campaigns can micro-target voters with messages calibrated for maximum effect; competitors may be excluded from markets not by inferior products but by superior data. Concentration of data thus threatens the open competition that healthy economies depend upon.',
      'What remedies are plausible? Regulation is the most direct instrument. The principle that people should consent to the use of their data, and that they should be able to inspect and delete it, has already been enacted in some jurisdictions and has begun to shift corporate behavior. Technological measures also matter: encryption shields content from casual inspection, and privacy-preserving designs can reduce the amount of data collected in the first place. Finally, public education has a role, because informed citizens are more likely to demand safeguards and to punish firms that betray their trust.',
      'None of these measures offers a perfect solution, and the trade-offs are genuine. Stricter privacy rules may impede innovation or make some services less convenient. Yet the alternative, a society in which every action is silently monitored and monetized, is difficult to reconcile with the values of autonomy and dignity. The question is not whether we can restore the privacy of an earlier era; we cannot. The question is whether we can build institutions that give individuals meaningful control over the most intimate commodity of the digital age: their own lives.',
    ],
    keyWords: [
      { headword: 'surrender', pos: 'v.', zh: '交出,放弃', en: 'to give up control of something to someone else' },
      { headword: 'elaborate', pos: 'adj.', zh: '精密的,详尽的', en: 'very detailed and carefully arranged' },
      { headword: 'unsettling', pos: 'adj.', zh: '令人不安的', en: 'making you feel anxious or uncertain' },
      { headword: 'erosion', pos: 'n.', zh: '侵蚀,削弱', en: 'the gradual destruction or weakening of something' },
      { headword: 'surveillance', pos: 'n.', zh: '监视', en: 'careful watching of people, especially by authorities' },
      { headword: 'autonomy', pos: 'n.', zh: '自主,自治', en: 'the right to make your own decisions' },
      { headword: 'formidable', pos: 'adj.', zh: '强大的,令人敬畏的', en: 'very powerful and difficult to deal with' },
      { headword: 'jurisdiction', pos: 'n.', zh: '司法管辖权,管辖范围', en: 'the authority of a court or government' },
      { headword: 'encryption', pos: 'n.', zh: '加密', en: 'the process of coding information so others cannot read it' },
      { headword: 'reconcile', pos: 'v.', zh: '调和,使一致', en: 'to make two things compatible' },
    ],
  },
  {
    id: 'purpose-of-university',
    title: 'What Is a University For?',
    summary:
      'Universities are expected to prepare students for careers, but their deeper purpose is to cultivate independent judgment. This essay weighs the competing missions of higher education.',
    level: 'B2',
    vocab: 5100,
    topicTags: ['教育', '文化', '社会'],
    paragraphs: [
      'Ask a student why she is attending university, and the most common answer will involve a job. Higher education is widely regarded as an investment: graduates earn more over a lifetime, and employers increasingly demand credentials as proof of basic competence. Governments, facing competitive pressure, measure universities by employment rates and research output. By such standards, the university is a remarkably successful institution.',
      'Yet this vocational account, however accurate, tells only part of the story. Historically, universities were founded not to issue certificates but to preserve knowledge and to train the mind to reason. The medieval scholar studied grammar, logic, and rhetoric before advancing to specialized disciplines. The underlying conviction was that education should form character and judgment, not merely transmit facts or skills.',
      'The distinction matters because the two missions pull in different directions. Career preparation tends to favor narrow, practical training: students acquire skills that are immediately marketable and quickly obsolete. Cultivation of judgment, by contrast, requires breadth. A student who reads history, philosophy, and literature learns to evaluate evidence, to tolerate ambiguity, and to question assumptions. These capacities do not appear on a resume in the same way a programming certificate does, but they equip graduates to adapt when industries transform and to think critically about the world they inherit.',
      'Defenders of the vocational model reply that such arguments are elitist luxuries. When tuition is expensive and debt is heavy, students reasonably demand preparation for employment rather than instruction in abstract reflection. The pressure is especially acute for first-generation students, for whom a degree is a ladder of mobility rather than a leisurely exploration.',
      'Perhaps the strongest position is not a choice between the two but a recognition that they depend on each other. Rapid technological change means that specific skills depreciate quickly; the graduate who cannot learn will fall behind no matter how polished her current abilities. Conversely, reflection without application can become detached from reality. A well-designed education combines rigorous specialization with habits of critical thought, teaching students both how to do something and how to think about what they are doing.',
      'The danger lies in letting one mission eclipse the other. If universities become mere job-training centers, they abandon their role as critics of society; if they disdain practical preparation entirely, they betray the aspirations of students who seek advancement. The healthiest institutions preserve the tension, refusing to resolve it too cheaply. Education, at its best, prepares students for a career without imprisoning them in one.',
    ],
    keyWords: [
      { headword: 'credential', pos: 'n.', zh: '凭证,资质证书', en: 'a qualification that proves your ability' },
      { headword: 'vocational', pos: 'adj.', zh: '职业的', en: 'related to skills for a particular job' },
      { headword: 'conviction', pos: 'n.', zh: '信念,坚信', en: 'a strong belief or opinion' },
      { headword: 'rhetoric', pos: 'n.', zh: '修辞,雄辩', en: 'the art of speaking or writing effectively' },
      { headword: 'obsolete', pos: 'adj.', zh: '过时的', en: 'no longer used because something newer exists' },
      { headword: 'ambiguity', pos: 'n.', zh: '歧义,模糊性', en: 'the quality of having more than one possible meaning' },
      { headword: 'elitist', pos: 'adj.', zh: '精英主义的', en: 'favoring a small, privileged group' },
      { headword: 'mobility', pos: 'n.', zh: '流动性,向上流动', en: 'the ability to move between social classes' },
      { headword: 'depreciate', pos: 'v.', zh: '贬值,折旧', en: 'to lose value over time' },
      { headword: 'eclipse', pos: 'v.', zh: '使…黯然失色,遮蔽', en: 'to make something seem less important' },
    ],
  },
  {
    id: 'economic-growth-limits',
    title: 'Can Economic Growth Go On Forever?',
    summary:
      'Modern prosperity depends on continuous growth, yet the planet is finite. This essay explores whether growth can be reconciled with environmental limits or whether new measures of progress are needed.',
    level: 'C1',
    vocab: 6400,
    topicTags: ['经济', '科学', '社会'],
    paragraphs: [
      'For two centuries, economic growth has been the central promise of modern societies. Rising output has lifted billions out of poverty, funded education and medicine, and underwritten the stability of democratic institutions. Politicians measure their success by growth rates, and citizens have come to expect that each generation will live more comfortably than the last. To question growth is, in most circles, to question the foundation of political order itself.',
      'The difficulty is that growth, as conventionally measured, consumes resources. Every increase in gross domestic product tends to require additional energy, materials, and waste disposal capacity. Since the early nineteenth century this appetite has been satisfied by the extraction of fossil fuels, whose combustion releases carbon dioxide into the atmosphere. The accumulation of that gas is now altering the climate in ways that threaten agriculture, coastal cities, and the stability of ecosystems on which all economies ultimately depend.',
      'Optimists argue that the contradiction is more apparent than real. They point to a process called decoupling: as economies mature, they argue, each unit of output requires less energy and fewer materials. Services, software, and design now constitute a growing share of wealthy economies, and these sectors are comparatively light in physical resources. If technology continues to improve, the reasoning goes, economies can expand indefinitely while their environmental footprint shrinks.',
      'The evidence for complete decoupling is, however, mixed. It is true that many rich countries have reduced emissions per unit of output, but total emissions in those countries have often declined only modestly, and global emissions continue to rise. Improvements in efficiency frequently generate what economists call a rebound effect: cheaper energy encourages more consumption, offsetting some of the gains. Whether absolute decoupling on a global scale is achievable within the time available remains a matter of vigorous debate rather than established fact.',
      'A different response questions the measure itself. Gross domestic product counts any transaction as a gain, whether it reflects useful production or costly repair. A society that builds hospitals and schools and a society that spends equally to clean up environmental disasters may report the same growth, though one is clearly better off. Critics propose alternative indicators that subtract environmental damage and add the value of unpaid care and leisure, offering a fuller picture of genuine well-being.',
      'The debate is unlikely to be settled by economics alone, because it is ultimately philosophical. It asks what societies should value: maximum material throughput, or the durable conditions of human flourishing. Growth has proved a remarkably powerful engine of improvement, and abandoning it casually would be reckless. Yet treating it as an idol, immune to revision, is equally dangerous. The mature response is not to choose between prosperity and the planet but to redefine prosperity so that it no longer depends on destroying the conditions that make it possible.',
    ],
    keyWords: [
      { headword: 'prosperity', pos: 'n.', zh: '繁荣', en: 'the state of being successful and wealthy' },
      { headword: 'underwrite', pos: 'v.', zh: '支持,为…担保', en: 'to support or guarantee financially' },
      { headword: 'extraction', pos: 'n.', zh: '开采,提取', en: 'the process of removing a resource from the ground' },
      { headword: 'combustion', pos: 'n.', zh: '燃烧', en: 'the process of burning' },
      { headword: 'decoupling', pos: 'n.', zh: '脱钩', en: 'the separation of economic growth from resource use' },
      { headword: 'footprint', pos: 'n.', zh: '足迹,影响范围', en: 'the impact of an activity on the environment' },
      { headword: 'rebound', pos: 'n.', zh: '回弹,反弹', en: 'a rise after a fall; a recovery' },
      { headword: 'throughput', pos: 'n.', zh: '吞吐量', en: 'the amount of material processed in a system' },
      { headword: 'flourishing', pos: 'n.', zh: '兴旺,繁荣', en: 'the state of growing and thriving' },
      { headword: 'reckless', pos: 'adj.', zh: '鲁莽的,不计后果的', en: 'showing no care about danger or consequences' },
    ],
  },
  {
    id: 'scientific-replication-crisis',
    title: 'The Quiet Crisis in Scientific Research',
    summary:
      'Many published findings cannot be reproduced by other laboratories. This essay examines why replication fails and why the incentive system of science may be partly to blame.',
    level: 'C1',
    vocab: 6600,
    topicTags: ['科学', '新闻'],
    paragraphs: [
      'Science enjoys enormous prestige, and for good reason: it has produced antibiotics, vaccines, and the computers on which modern life runs. Yet beneath this success lies a troubling pattern. When independent teams attempt to repeat the experiments described in published papers, they often fail. In some fields, fewer than half of published results can be reproduced. This phenomenon, known as the replication crisis, has prompted a searching examination of how science actually operates.',
      'Part of the problem is statistical. Researchers conventionally treat a result as significant if the probability that it arose by chance is below five percent. This threshold is far weaker than it sounds. When many hypotheses are tested, some false ones will cross the line purely by luck. If a field tests thousands of potential associations and publishes only the positive findings, a substantial fraction of the literature will consist of effects that are not real.',
      'Human incentives compound the statistical difficulty. Careers in science depend on publication, and prestigious journals favor surprising, positive results over careful null findings. A scientist who discovers that a promising drug fails, or that an elegant hypothesis is wrong, has little to gain and much to lose by reporting the outcome. The result is a systematic bias: negative evidence disappears into file drawers, while favorable findings, however fragile, are celebrated.',
      'Questionable research practices amplify the distortion. Minor decisions about which data points to exclude, which statistical test to use, and whether to report all of one\'s analyses can tilt a borderline result toward significance. None of these choices is necessarily fraudulent; individually they seem trivial. But accumulated across a career, they allow researchers to nudge ambiguous data toward the conclusion they expect or desire.',
      'The remedies now being proposed are structural rather than moral. Pre-registration, in which scientists declare their hypotheses and analysis plans before collecting data, prevents outcomes from being selected after the fact. Open data and open materials allow others to verify claims and to detect errors. Journals increasingly publish replication attempts and null results, reducing the incentive to suppress them. Perhaps most importantly, funding agencies are beginning to reward rigor and transparency rather than merely counting publications.',
      'The replication crisis is often described as a scandal, but it may better be understood as a sign of health. A system that can examine its own failures and reform its practices is more robust than one that defends every conclusion without question. The aim of the reform movement is not to humiliate scientists but to make the published record more trustworthy. If it succeeds, the long-term beneficiary will be science itself, and everyone who relies on its authority to make decisions about health, technology, and public policy.',
    ],
    keyWords: [
      { headword: 'prestige', pos: 'n.', zh: '威望,声望', en: 'respect and admiration from others' },
      { headword: 'replicate', pos: 'v.', zh: '复制,重现', en: 'to repeat an experiment and get the same result' },
      { headword: 'phenomenon', pos: 'n.', zh: '现象', en: 'an observable fact or event' },
      { headword: 'threshold', pos: 'n.', zh: '门槛,阈值', en: 'the level at which something begins' },
      { headword: 'compound', pos: 'v.', zh: '使恶化,加重', en: 'to make a problem worse' },
      { headword: 'fraudulent', pos: 'adj.', zh: '欺诈的', en: 'involving deception for gain' },
      { headword: 'trivial', pos: 'adj.', zh: '微不足道的', en: 'of little importance' },
      { headword: 'nudge', pos: 'v.', zh: '轻推,推动', en: 'to gently push toward a result' },
      { headword: 'rigor', pos: 'n.', zh: '严谨,严格', en: 'the quality of being thorough and careful' },
      { headword: 'robust', pos: 'adj.', zh: '稳健的,强健的', en: 'strong and able to withstand problems' },
    ],
  },
];
