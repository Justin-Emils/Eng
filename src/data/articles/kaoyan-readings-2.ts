/**
 * 语料 · 考研阅读向 第二辑(B2–C1 原创短文)。
 * 全文原创编写,供考研备考者通过阅读积累学术词汇;
 * 不抓取任何第三方版权文章。
 */

import type { RawArticle } from './build';

export const KAOYAN_ARTICLES_2: RawArticle[] = [
  {
    id: 'social-media-mental-health',
    title: 'Social Media and the Architecture of Attention',
    summary:
      'Social platforms are free because they sell attention. This essay examines how their design affects concentration, mood, and the quality of public discussion.',
    level: 'B2',
    vocab: 5400,
    topicTags: ['科技', '社会'],
    paragraphs: [
      'Few technologies have spread as quickly as social media. Within a decade, platforms such as short-video feeds and messaging networks have become the default way many people learn about news, maintain friendships, and pass idle time. The services are free, which prompts a familiar question: if we do not pay for the product, we are the product. What platforms actually sell is attention, harvested in milliseconds and auctioned to advertisers.',
      'The business model shapes the design. Every element of a feed is engineered to maximize the time spent on it: notifications interrupt at unpredictable moments, videos autoplay, and content is ranked by predicted engagement rather than importance or truth. The result is an environment that rewards outrage, novelty, and brevity. Calm explanation loses to heated argument, because anger keeps thumbs scrolling in a way that satisfaction does not.',
      'Researchers have begun to document the consequences. Heavy use of social platforms correlates with higher rates of anxiety and loneliness, particularly among adolescents, whose sense of self is still forming. The comparison with carefully edited lives of others breeds envy; the fear of missing out keeps users returning even when the experience brings little pleasure. Correlation is not causation, and not every study agrees, but the pattern is consistent enough to demand serious attention.',
      'The damage is not confined to individuals. Public conversation suffers when issues are compressed into slogans and judged by their emotional impact within seconds of appearance. Nuanced positions, which require time to explain and patience to absorb, are systematically disadvantaged. Misinformation spreads faster than correction because it is designed to feel true rather than to be true. Institutions that depend on trust, from journalism to science, find themselves defending basic facts against an endless stream of confident falsehoods.',
      'Reform is difficult because the incentives are powerful and the technology is woven into daily life. Some propose regulation requiring platforms to make their algorithms transparent or to limit manipulative design features. Others advocate digital literacy, teaching young people to recognize manipulation and to manage their own attention. Still others simply try to set personal boundaries, deleting apps or scheduling offline hours. Each approach has limits; none can restore an earlier media environment that has permanently changed.',
      'The deepest question is not about individual willpower but about the kind of attention a society considers worth protecting. Attention is the raw material of thought, and thought is the raw material of freedom. A tool that fragments attention on an industrial scale may be profitable, but its profit is borrowed from capacities that cannot be replaced when they are lost. Designing media that respect attention rather than exploiting it may be one of the defining tasks of the coming century.',
    ],
    keyWords: [
      { headword: 'harvest', pos: 'v.', zh: '收割,收集', en: 'to collect a resource for use' },
      { headword: 'auction', pos: 'v.', zh: '拍卖', en: 'to sell to the highest bidder' },
      { headword: 'engagement', pos: 'n.', zh: '参与,互动', en: 'the act of being involved with content' },
      { headword: 'outrage', pos: 'n.', zh: '愤怒,义愤', en: 'a strong feeling of anger' },
      { headword: 'adolescent', pos: 'n.', zh: '青少年', en: 'a young person developing into an adult' },
      { headword: 'envy', pos: 'n.', zh: '嫉妒', en: 'the feeling of wanting what others have' },
      { headword: 'nuanced', pos: 'adj.', zh: '有细微差别的,细腻的', en: 'showing small but important differences' },
      { headword: 'compressed', pos: 'adj.', zh: '被压缩的', en: 'made smaller or shorter' },
      { headword: 'manipulation', pos: 'n.', zh: '操纵', en: 'controlling others unfairly' },
      { headword: 'fragment', pos: 'v.', zh: '使破碎,分割', en: 'to break into small pieces' },
    ],
  },
  {
    id: 'automation-future-of-work',
    title: 'Automation and the Future of Work',
    summary:
      'Machines can now perform tasks once reserved for educated workers. Whether automation brings abundance or inequality depends less on technology than on the choices societies make.',
    level: 'B2',
    vocab: 5600,
    topicTags: ['经济', '科技', '社会'],
    paragraphs: [
      'For two hundred years, each wave of automation has provoked the same fear: that machines will replace human labor and leave workers without purpose or income. And for two hundred years, the prediction has failed to come true. New machines eliminated some jobs but created others, often in fields that did not exist when the fear was first expressed. The plow displaced farmhands and made way for factory work; the factory gave rise to the service economy.',
      'There are reasons to think this time may be different. Earlier machines replaced muscles; the new generation replaces minds. Software can draft documents, answer customer questions, translate languages, analyze medical images, and write computer code. These are precisely the tasks that educated professionals performed, the workers who once felt insulated from the threat of automation. When the machine competes for cognitive work, the old escape route, moving into more mental labor, closes.',
      'Predictions vary wildly. Optimists imagine a future of abundance in which intelligent machines handle tedious work and humans devote themselves to creativity, care, and leisure. Pessimists foresee stagnant wages, concentrated wealth, and a permanent class of workers whose skills have been devalued faster than they can learn new ones. History offers evidence for both visions, which is another way of saying that the outcome is not predetermined by technology.',
      'The decisive factors are institutional. Whether automation raises the standard of living or deepens inequality depends on how the gains are distributed: on tax policy, on the strength of education and retraining systems, on the bargaining power of workers, and on whether societies choose to decouple basic security from employment. Universal basic income, portable benefits, and shorter working weeks are no longer fringe proposals; they are responses to a realistic possibility that full employment may no longer absorb everyone.',
      'Education faces an especially hard challenge. Schools cannot know what skills will be valuable in twenty years, because the economy itself is changing too quickly. The most durable preparation may therefore be general: the ability to reason clearly, to communicate, to adapt, and to learn continuously. Specific technical training remains useful, but it ages quickly; habits of mind age more slowly.',
      'The history of automation counsels neither panic nor complacency. Machines are tools, and tools are neither good nor evil in themselves; their consequences follow from the purposes to which they are put and the rules under which they operate. The question that matters is not whether machines can do what humans do, but whether the societies that deploy them will ensure that the benefits are shared and that every person retains the chance to contribute, to learn, and to live with dignity.',
    ],
    keyWords: [
      { headword: 'automation', pos: 'n.', zh: '自动化', en: 'the use of machines to do work' },
      { headword: 'provoke', pos: 'v.', zh: '激起,引发', en: 'to cause a strong reaction' },
      { headword: 'eliminate', pos: 'v.', zh: '消除,淘汰', en: 'to remove completely' },
      { headword: 'displace', pos: 'v.', zh: '取代,使失业', en: 'to take the place of workers' },
      { headword: 'insulated', pos: 'adj.', zh: '隔绝的,不受影响的', en: 'protected from outside effects' },
      { headword: 'cognitive', pos: 'adj.', zh: '认知的', en: 'related to thinking and understanding' },
      { headword: 'stagnant', pos: 'adj.', zh: '停滞的', en: 'not growing or developing' },
      { headword: 'devalue', pos: 'v.', zh: '贬值,降低价值', en: 'to reduce the value of something' },
      { headword: 'decouple', pos: 'v.', zh: '使脱钩,分离', en: 'to separate two connected things' },
      { headword: 'complacency', pos: 'n.', zh: '自满,满足', en: 'a feeling of uncritical satisfaction' },
    ],
  },
  {
    id: 'urbanization-livable-cities',
    title: 'Can Cities Be Both Dense and Livable?',
    summary:
      'Cities concentrate opportunity but also congestion and inequality. This essay examines how urban design shapes daily life and whether density can coexist with well-being.',
    level: 'B2',
    vocab: 5300,
    topicTags: ['社会', '环境', '经济'],
    paragraphs: [
      'More than half of humanity now lives in cities, and the proportion continues to rise. The reasons are not mysterious. Cities concentrate jobs, education, and culture; they make collaboration easier and ideas travel faster. A young person in a small town who dreams of an unusual career usually finds that the city is the only place where the dream can grow. This economic logic explains why people keep arriving even when rents are high and apartments are small.',
      'Yet the same concentration produces familiar complaints. Housing costs consume a growing share of income, pushing many workers to distant suburbs and forcing them to commute for hours. Traffic congests at predictable times each day; public transport strains under peak loads. Air quality suffers where cars dominate, and the noise of a dense city never fully disappears. The very density that makes cities productive can also make them exhausting.',
      'Urban designers argue that the conflict is not inevitable. The shape of a city, they point out, is a design choice with enormous consequences. A city built around the private car spreads outward, consumes land, and isolates residents; a city built around walking, cycling, and reliable transit can accommodate the same population in a fraction of the space. When neighborhoods mix homes, shops, and workplaces, many trips become short enough to make on foot, and the street becomes a public space rather than a thoroughfare for vehicles.',
      'Inequality complicates the picture. Central neighborhoods, once affordable, are transformed by investment and become affordable only to the wealthy, displacing the communities that gave them character. The poor are pushed to the periphery, where transport is slower, services are thinner, and opportunities are farther away. A city can be dense and prosperous while remaining deeply unequal; density alone solves nothing if access to its benefits is distributed by income.',
      'Well-designed density is not the enemy of well-being. Green spaces, safe streets, and buildings that admit daylight can be provided at high density; indeed, compact cities can preserve surrounding countryside better than sprawling ones. What matters is less the number of people per square kilometer than the quality of the public realm they share and the ease with which they can move, meet, and rest. Social connection, not mere proximity, is what makes a dense city feel humane.',
      'The task of the coming decades is to make cities that are dense enough to sustain innovation yet gentle enough to sustain their inhabitants. This will require coordinated investment in transit and housing, honest accounting of environmental costs, and the political will to resist the temptation of treating land as a speculative asset. Cities have always been experiments in living together. Whether the experiment succeeds will be measured not by skylines but by the daily experience of ordinary residents.',
    ],
    keyWords: [
      { headword: 'congestion', pos: 'n.', zh: '拥堵', en: 'the state of being crowded or blocked' },
      { headword: 'concentrate', pos: 'v.', zh: '集中', en: 'to bring together in one place' },
      { headword: 'collaboration', pos: 'n.', zh: '合作', en: 'working together with others' },
      { headword: 'commute', pos: 'v.', zh: '通勤', en: 'to travel regularly between home and work' },
      { headword: 'congest', pos: 'v.', zh: '使堵塞', en: 'to block or crowd something' },
      { headword: 'periphery', pos: 'n.', zh: '边缘,外围', en: 'the outer edge of an area' },
      { headword: 'sprawl', pos: 'v.', zh: '蔓延,无序扩展', en: 'to spread out over a large area' },
      { headword: 'displace', pos: 'v.', zh: '迫使离开,取代', en: 'to force people to leave their homes' },
      { headword: 'proximity', pos: 'n.', zh: '邻近,接近', en: 'the state of being near something' },
      { headword: 'speculative', pos: 'adj.', zh: '投机的', en: 'buying assets hoping their price will rise' },
    ],
  },
  {
    id: 'science-trust-communication',
    title: 'Why People Doubt Science',
    summary:
      'Scientific consensus on vaccines and climate change faces widespread skepticism. Understanding the psychology of doubt is essential to communicating evidence effectively.',
    level: 'C1',
    vocab: 6400,
    topicTags: ['科学', '新闻', '社会'],
    paragraphs: [
      'Science enjoys remarkable authority when it delivers practical results: few people doubt the physics that keeps airplanes aloft or the chemistry that purifies drinking water. Yet on issues where evidence is complex and consequences are distant, such as vaccination or climate change, substantial minorities reject the conclusions of expert communities. The pattern puzzles scientists, who expect evidence to persuade.',
      'Part of the explanation lies in how human reasoning actually works. People do not generally evaluate claims by weighing evidence; they evaluate claims by judging the people who make them and the groups with which those people are associated. A statement that reinforces membership in one\'s community feels true; a statement that threatens that membership feels suspect. Identity, not ignorance, drives much of the skepticism. Someone who distrusts pharmaceutical companies will tend to distrust vaccine research, however rigorous it is, because accepting it would feel like betraying the group.',
      'The structure of scientific communication magnifies the problem. Science proceeds by uncertainty and revision; a finding is published, contested, refined, and sometimes overturned. This process is a strength, but it looks like weakness from outside. When experts revise a recommendation about masks or social distancing, critics cite the change as proof that the experts were never trustworthy, mistaking honest correction for confusion.',
      'Social media accelerates the spread of doubt. Algorithms reward content that provokes emotion, and skepticism is more emotionally engaging than agreement. A video questioning a settled conclusion can travel around the world while the patient response of a dozen researchers gathers dust in a journal. The asymmetry is built into the medium: error is cheap to produce and expensive to refute.',
      'What can be done? Condescending lectures about the importance of science rarely change minds, because they treat the audience as ignorant rather than as reasoning within a different framework. More effective approaches begin by taking concerns seriously, acknowledging genuine uncertainties, and enlisting trusted local voices rather than distant authorities. Transparency about how conclusions are reached, including the honest limits of knowledge, builds more durable trust than confident certainty ever does.',
      'The stakes are high. Public health, environmental policy, and the shared capacity to respond to novel threats all depend on a citizenry that can distinguish reliable expertise from confident noise. Science cannot compel belief, nor should it try. Its task is to make the evidence as clear as possible and to earn trust through honesty, humility, and engagement with the communities it serves. In a world of manufactured doubt, the patient work of explanation is not a luxury; it is a necessity.',
    ],
    keyWords: [
      { headword: 'consensus', pos: 'n.', zh: '共识', en: 'general agreement among a group' },
      { headword: 'skepticism', pos: 'n.', zh: '怀疑态度', en: 'an attitude of doubting claims' },
      { headword: 'reinforce', pos: 'v.', zh: '加强,强化', en: 'to make something stronger' },
      { headword: 'suspect', pos: 'adj.', zh: '可疑的', en: 'believed to be possibly guilty or false' },
      { headword: 'rigorous', pos: 'adj.', zh: '严谨的,严格的', en: 'careful, thorough, and exact' },
      { headword: 'revision', pos: 'n.', zh: '修订,修正', en: 'the act of changing something after review' },
      { headword: 'asymmetry', pos: 'n.', zh: '不对称', en: 'the lack of balance between two things' },
      { headword: 'refute', pos: 'v.', zh: '驳斥,反驳', en: 'to prove a claim is false' },
      { headword: 'condescending', pos: 'adj.', zh: '居高临下的', en: 'treating others as inferior' },
      { headword: 'manufactured', pos: 'adj.', zh: '人为制造的', en: 'produced deliberately rather than naturally' },
    ],
  },
];
