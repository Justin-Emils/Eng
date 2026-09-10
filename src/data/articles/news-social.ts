/**
 * 语料 · 新闻 / 社会 / 更多科学 类(原创短文)。
 * 完整英文正文,禁止占位文本。
 */

import type { RawArticle } from './build';

export const NEWS_SOCIAL_ARTICLES: RawArticle[] = [
  {
    id: 'sleep-science',
    title: 'Why Sleep Is Your Superpower',
    summary:
      'Sleep is not wasted time. During sleep, the brain cleans itself, memories are saved, and the body repairs. Cutting sleep short harms thinking, mood, and health.',
    level: 'B2',
    vocab: 4300,
    topicTags: ['科学', '生活'],
    paragraphs: [
      'Many people treat sleep as the enemy of productivity. They brag about sleeping only five hours and drink coffee to push through the afternoon. Modern science says this attitude is deeply wrong: sleep may be the most powerful tool we have.',
      'During deep sleep, something remarkable happens in the brain. The space between brain cells widens slightly, allowing a kind of cleaning fluid to wash away waste products that build up during waking hours. Researchers compare it to running a dishwasher in the brain while you rest.',
      'Sleep is also when memory is saved. Throughout the day, experiences are stored in a temporary area of the brain. At night, the brain replays the day\'s important moments and moves them into long-term storage. A student who studies and then sleeps well often remembers more than one who studies all night without rest.',
      'The cost of lost sleep appears quickly. After one poor night, attention and reaction speed drop. After many poor nights, people become more anxious, more forgetful, and more likely to make careless mistakes. Long-term sleep loss is linked to heart disease, weight gain, and a weaker immune system.',
      'Teenagers face an extra problem. Their internal clocks naturally run late, so they fall asleep late and struggle to wake early. Forcing school to start before seven means asking teenage brains to work at the worst possible hour.',
      'Good sleep is not mysterious. It helps to keep a regular schedule, even on weekends, and to see bright light in the morning but dim light in the evening. Screens before bed are a particular enemy, because their blue light tells the brain that it is still daytime.',
      'We admire people who sacrifice sleep for success, but the evidence points the other way. The best decisions, the kindest moods, and the clearest thinking all begin with a good night\'s rest. Sleep is not the reward after hard work; it is the fuel before it.',
    ],
    keyWords: [
      { headword: 'productivity', pos: 'n.', zh: '生产力,效率', en: 'the rate at which useful work is done' },
      { headword: 'brag', pos: 'v.', zh: '吹嘘', en: 'to talk about yourself in a proud way' },
      { headword: 'remarkable', pos: 'adj.', zh: '非凡的', en: 'unusual and surprising, worth noticing' },
      { headword: 'temporary', pos: 'adj.', zh: '暂时的', en: 'lasting only for a short time' },
      { headword: 'immune', pos: 'adj.', zh: '免疫的', en: 'protected against disease by the body\'s defenses' },
      { headword: 'sacrifice', pos: 'v.', zh: '牺牲', en: 'to give up something important for another goal' },
    ],
  },
  {
    id: 'fake-news-how-to-spot',
    title: 'How to Spot Fake News',
    summary:
      'Misinformation spreads faster than ever. Readers can defend themselves by checking sources, reading past headlines, and looking for evidence.',
    level: 'B2',
    vocab: 3900,
    topicTags: ['新闻', '社会'],
    paragraphs: [
      'A shocking headline appears in your feed: a famous person has said something outrageous, or a terrible event is happening somewhere. Your finger moves toward the share button. This is exactly the moment when a careful reader pauses.',
      'Fake news is not a single thing. It includes hoaxes created for money, rumors spread by accident, and propaganda designed to change how people vote or think. What these share is a simple fact: false information travels faster than the truth, because lies are often more surprising and more emotional.',
      'The first defense is to slow down. Studies show that people who read quickly share misinformation more often than careful readers. Before sharing, ask yourself whether the story makes you angry or excited. Strong emotion is a warning sign, not a proof of truth.',
      'The second defense is to check the source. Does the website have a clear name, a contact page, and a history? Many fake stories come from sites that imitate real news organizations with almost identical names. Look at the address bar, not just the logo.',
      'Then read past the headline. Headlines are often written to attract clicks, and some are so exaggerated that they contradict the article below. Open the story and ask whether the body supports the claim.',
      'Finally, look for other sources. If an event really happened, multiple independent news outlets will report it. If you can find only one obscure website telling the story, treat it with deep suspicion, no matter how convincing it sounds.',
      'None of these steps makes you immune to error. But together they change you from a passive receiver of information into an active judge. In an age when anyone can publish anything, the ability to question is not just a skill; it is a responsibility.',
    ],
    keyWords: [
      { headword: 'misinformation', pos: 'n.', zh: '错误信息', en: 'false or inaccurate information' },
      { headword: 'outrageous', pos: 'adj.', zh: '骇人的,离谱的', en: 'shocking and unacceptable' },
      { headword: 'hoax', pos: 'n.', zh: '骗局', en: 'a trick that makes people believe something false' },
      { headword: 'propaganda', pos: 'n.', zh: '宣传', en: 'information used to push a political view' },
      { headword: 'exaggerated', pos: 'adj.', zh: '夸大的', en: 'made to seem larger or worse than reality' },
      { headword: 'contradict', pos: 'v.', zh: '与…矛盾', en: 'to say the opposite of something' },
      { headword: 'suspicion', pos: 'n.', zh: '怀疑', en: 'a feeling that something may be wrong' },
    ],
  },
  {
    id: 'city-versus-country',
    title: 'City Life or Country Life?',
    summary:
      'Cities offer opportunity and excitement; the countryside offers space and calm. Each choice carries costs that people rarely consider before moving.',
    level: 'B1',
    vocab: 2700,
    topicTags: ['社会', '生活'],
    paragraphs: [
      'Every year, millions of young people move to big cities, drawn by jobs, universities, and the promise of a more interesting life. Every year, a smaller number move in the opposite direction, tired of noise, rent, and crowded trains. Both groups are chasing something real.',
      'The city rewards ambition. In a large city, there are more jobs, more schools, more restaurants, and more chances to meet people who share your interests. If your dream is rare, a city is usually the only place where it can grow.',
      'But the city also takes a quiet tax. Housing is expensive, so many people live in small rooms far from the center. Commuting can eat two hours of every working day. The endless energy of a city can become exhausting when you have no quiet corner to rest in.',
      'The countryside offers the opposite trade. Space is cheap, the air is cleaner, and the pace of life is slower. Neighbors may actually know your name, and children can play outside without constant worry about traffic.',
      'Yet rural life has its own costs. Good jobs are fewer, and specialist skills often find no local market. Hospitals, theaters, and universities may be an hour away. For some people, the quiet that feels peaceful in summer becomes loneliness in winter.',
      'There is no correct answer, only a correct question: what do you need most at this stage of your life? A person in their twenties may need the city\'s ladder, while a family with young children may need the countryside\'s space. Many people change their answer as their lives change.',
      'Perhaps the smartest choice is not a permanent one. Try a city for two years; try the countryside for a season. Listen to what each place gives you and what it costs you, and choose with your eyes open.',
    ],
    keyWords: [
      { headword: 'ambition', pos: 'n.', zh: '雄心,抱负', en: 'a strong wish to succeed' },
      { headword: 'commute', pos: 'v.', zh: '通勤', en: 'to travel regularly between home and work' },
      { headword: 'exhausting', pos: 'adj.', zh: '令人疲惫的', en: 'making you very tired' },
      { headword: 'rural', pos: 'adj.', zh: '乡村的', en: 'relating to the countryside' },
      { headword: 'specialist', pos: 'n.', zh: '专家,专科人才', en: 'a person skilled in one particular area' },
      { headword: 'permanent', pos: 'adj.', zh: '永久的', en: 'lasting forever or for a very long time' },
    ],
  },
];
