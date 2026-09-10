/**
 * 语料 · 进阶(C1)类(原创短文)。
 * 完整英文正文,禁止占位文本。
 */

import type { RawArticle } from './build';

export const ADVANCED_ARTICLES: RawArticle[] = [
  {
    id: 'age-of-artificial-intelligence',
    title: 'Living with Artificial Intelligence',
    summary:
      'AI has moved from research labs into daily life. It brings remarkable power, but it also forces society to rethink work, truth, and human judgment.',
    level: 'C1',
    vocab: 6800,
    topicTags: ['科技', '社会'],
    paragraphs: [
      'A decade ago, artificial intelligence was a topic for science fiction and specialized conferences. Today it writes emails, translates languages, recognizes faces, drives prototypes of cars, and generates images on command. The technology has crossed from the laboratory into the texture of everyday life with startling speed.',
      'The capabilities are genuinely impressive. Machine-learning systems can now detect diseases in medical scans with accuracy that rivals trained doctors, forecast complex weather patterns, and assist researchers in reading millions of documents. For many routine tasks, a well-designed model outperforms a busy human.',
      'Yet the same power generates profound unease. Because these systems learn from enormous amounts of human data, they absorb our biases as readily as our knowledge. A hiring tool trained on past decisions may quietly reproduce old patterns of discrimination, not because it intends harm but because it has none of the reflective judgment that guards against it.',
      'The question of truth has become equally complicated. Synthetic media can place a person\'s face and voice into events that never occurred. When convincing falsehoods can be produced in seconds, the public\'s ability to trust what it sees is undermined. Societies are only beginning to build the literacy required to navigate such an environment.',
      'Work, too, faces a transformation whose scale remains uncertain. Some economists argue that AI will eliminate jobs in the same way earlier technologies did, while creating new ones in their place. Others contend that this wave is different, because it reaches into cognitive labor that was previously the secure province of educated professionals.',
      'What is clear is that the bottlenecks ahead are not chiefly technical. They are questions of governance: who decides which uses are acceptable, how errors are attributed, and how the benefits are distributed rather than concentrated. Technical progress without corresponding institutional progress produces instability.',
      'The most sensible stance lies between utopian enthusiasm and fatalistic dread. AI is a tool of unprecedented power, and like all powerful tools, its consequences will depend on the intentions and institutions of those who wield it. The coming decades will be shaped less by what the machines can do than by what we decide they should do.',
    ],
    keyWords: [
      { headword: 'artificial', pos: 'adj.', zh: '人造的,人工的', en: 'made by humans rather than occurring naturally' },
      { headword: 'startling', pos: 'adj.', zh: '惊人的', en: 'surprising and sudden' },
      { headword: 'rival', pos: 'v.', zh: '与…匹敌', en: 'to be as good as someone or something' },
      { headword: 'profound', pos: 'adj.', zh: '深刻的,深远的', en: 'very great or intense' },
      { headword: 'discrimination', pos: 'n.', zh: '歧视', en: 'unfair treatment of a group of people' },
      { headword: 'undermine', pos: 'v.', zh: '削弱,破坏', en: 'to make something gradually weaker' },
      { headword: 'cognitive', pos: 'adj.', zh: '认知的', en: 'related to thinking and understanding' },
      { headword: 'governance', pos: 'n.', zh: '治理,管理', en: 'the systems and rules used to manage something' },
      { headword: 'fatalistic', pos: 'adj.', zh: '宿命论的', en: 'believing events cannot be controlled' },
      { headword: 'wield', pos: 'v.', zh: '行使,挥舞', en: 'to hold and use power or a tool' },
    ],
  },
  {
    id: 'reading-in-digital-age',
    title: 'Deep Reading in a Shallow Age',
    summary:
      'The internet has made us read more than ever, but the way we read has changed. Continuous scrolling threatens the slow, focused reading that builds deep understanding.',
    level: 'C1',
    vocab: 6500,
    topicTags: ['科技', '文化', '社会'],
    paragraphs: [
      'By almost any measure, we read more today than our grandparents did. Messages, headlines, captions, and notifications stream past our eyes from morning to night. Yet a growing number of researchers argue that this abundance conceals a loss: the slow, sustained reading required for genuine comprehension is becoming rare.',
      'The distinction is not between paper and screens. It is between two modes of attention. Scanning mode moves rapidly across short texts, harvesting facts and impressions before leaping onward. Immersion mode stays with a single argument or narrative for an extended period, allowing ideas to connect and complexity to unfold.',
      'Digital environments are engineered to favor the first mode. Notifications interrupt every few minutes, hyperlinks invite constant departure, and algorithmic feeds reward whatever captures attention quickly. The mind adapts to its environment, and an environment of perpetual interruption trains a restless, skimming attention.',
      'The cost of this adaptation is subtle but serious. Deep reading is where we encounter nuance: the qualification that complicates a claim, the irony that inverts a sentence\'s surface meaning, the slow accumulation of evidence toward an unfamiliar conclusion. These experiences cannot be compressed into fragments without being distorted.',
      'Researchers who study the neuroscience of reading find that comprehension of long-form text relies on sustained working memory and the building of mental models. When reading is constantly fragmented, the brain may register individual facts while failing to integrate them into a coherent understanding. We recognize more and grasp less.',
      'None of this demands a rejection of technology. Screens are excellent for reference, communication, and timely information. The problem arises when scanning becomes the default for everything, including the books and essays that deserve a different kind of attention.',
      'A practical defense is deliberate friction: set aside uninterrupted time, silence the phone, and choose texts long enough to require patience. Like any skill, deep reading is preserved only through regular practice. In an age engineered for distraction, the ability to read slowly may be one of the most valuable habits a mind can keep.',
    ],
    keyWords: [
      { headword: 'abundance', pos: 'n.', zh: '丰富,大量', en: 'a very large quantity of something' },
      { headword: 'comprehension', pos: 'n.', zh: '理解', en: 'the ability to understand something fully' },
      { headword: 'immersion', pos: 'n.', zh: '沉浸', en: 'complete involvement in an activity' },
      { headword: 'perpetual', pos: 'adj.', zh: '永久的,不断的', en: 'continuing forever or for a long time' },
      { headword: 'nuance', pos: 'n.', zh: '细微差别', en: 'a very small difference in meaning or tone' },
      { headword: 'fragment', pos: 'n.', zh: '碎片', en: 'a small broken piece of something' },
      { headword: 'coherent', pos: 'adj.', zh: '连贯的', en: 'clear, logical, and well organized' },
      { headword: 'deliberate', pos: 'adj.', zh: '刻意的,深思熟虑的', en: 'done on purpose, after careful thought' },
    ],
  },
];
