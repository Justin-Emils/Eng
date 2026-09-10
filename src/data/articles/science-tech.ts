/**
 * 语料 · 科学 / 科技 类(原创科普短文)。
 * 完整英文正文,禁止占位文本。
 */

import type { RawArticle } from './build';

export const SCIENCE_ARTICLES: RawArticle[] = [
  {
    id: 'why-sky-blue',
    title: 'Why Is the Sky Blue?',
    summary:
      'Sunlight looks white, but it is really a mix of colors. Small particles in the air scatter blue light more than other colors, which is why the sky appears blue.',
    level: 'B1',
    vocab: 2400,
    topicTags: ['科学'],
    paragraphs: [
      'Have you ever looked up on a clear day and asked why the sky is blue? The answer has to do with light and the air around us.',
      'Sunlight may look white, but it is actually a mixture of many colors. You can see these colors when light passes through a glass prism or when a rainbow appears after rain. Each color is a different kind of light wave.',
      'As sunlight travels through the atmosphere, it bumps into tiny molecules of gas in the air. These molecules are much smaller than the waves of light, and they scatter the light in every direction. This process is called Rayleigh scattering.',
      'Here is the key point: blue light has a shorter wavelength than red or yellow light, and short waves are scattered much more strongly. As a result, blue light is spread across the whole sky, and that is the color we see when we look upward.',
      'At sunrise and sunset, the sun is low in the sky. Its light must pass through much more air before it reaches your eyes. Most of the blue light is scattered away along the way, so the light that remains is rich in red and orange. That is why sunsets look red and warm.',
      'On other planets, the sky can look different. On Mars, for example, the atmosphere is thin and full of dust, so the sky often appears reddish or butterscotch colored. The color of a sky, it turns out, is a window into the air above a world.',
    ],
    keyWords: [
      { headword: 'atmosphere', pos: 'n.', zh: '大气层', en: 'the layer of gases around a planet' },
      { headword: 'particle', pos: 'n.', zh: '微粒', en: 'a very small piece of something' },
      { headword: 'scatter', pos: 'v.', zh: '散射,散布', en: 'to throw or spread things in different directions' },
      { headword: 'wavelength', pos: 'n.', zh: '波长', en: 'the distance between two waves of light or sound' },
      { headword: 'molecule', pos: 'n.', zh: '分子', en: 'the smallest unit of a chemical substance' },
      { headword: 'prism', pos: 'n.', zh: '棱镜', en: 'a glass object that splits light into colors' },
    ],
  },
  {
    id: 'internet-history-short',
    title: 'A Short History of the Internet',
    summary:
      'From a small military network to a worldwide web, the internet grew through research, the personal computer, and the mobile phone.',
    level: 'B2',
    vocab: 4200,
    topicTags: ['科技', '历史'],
    paragraphs: [
      'The internet is so central to modern life that it is easy to forget how young it is. The story begins in the 1960s, when researchers wanted computers to share information with one another.',
      'An early network called ARPANET connected universities and research centers in the United States. It was designed to keep working even if part of the system failed, a feature that came from Cold War thinking about survival after an attack.',
      'For years, the network stayed mostly in the hands of scientists. Ordinary people could not easily use it, because sending a message required technical knowledge and expensive equipment.',
      'Everything changed in 1989, when a British scientist named Tim Berners-Lee proposed a system for linking documents through clickable connections. His invention, the World Wide Web, turned a difficult network into something anyone could browse. The first websites were plain pages of text, but they were a revolution.',
      'In the 1990s, fast connections and cheaper computers brought the web into homes. People could suddenly read news, send email, and buy goods without leaving their chairs. Companies that had no physical stores, like early online booksellers, began to grow.',
      'The next great shift came with the smartphone. When millions of people began carrying a computer in their pocket, the web moved off the desk and into daily life. Social networks turned every user into a publisher, and maps, payments, and instant messages became ordinary tools.',
      'Today the internet connects most of the human race, yet its history is still short. The network that began as a small experiment now shapes how we learn, work, and relate to one another, and it continues to change faster than any generation can fully absorb.',
    ],
    keyWords: [
      { headword: 'central', pos: 'adj.', zh: '核心的,中心的', en: 'most important; in the middle' },
      { headword: 'researcher', pos: 'n.', zh: '研究者', en: 'a person who studies something carefully' },
      { headword: 'survival', pos: 'n.', zh: '生存', en: 'the state of continuing to live' },
      { headword: 'browse', pos: 'v.', zh: '浏览', en: 'to look at pages or goods without a fixed plan' },
      { headword: 'revolution', pos: 'n.', zh: '革命,巨变', en: 'a complete change in the way something is done' },
      { headword: 'publisher', pos: 'n.', zh: '发布者', en: 'a person or company that makes content public' },
      { headword: 'absorb', pos: 'v.', zh: '吸收,理解', en: 'to take in and understand information' },
    ],
  },
  {
    id: 'how-smartphones-change-us',
    title: 'How Smartphones Changed Daily Life',
    summary:
      'Smartphones put a computer, a camera, and a map in our pockets. They changed how we talk, travel, shop, and even how we remember things.',
    level: 'B1',
    vocab: 2600,
    topicTags: ['科技', '生活'],
    paragraphs: [
      'It is hard to imagine a day without a smartphone. For many people, the small screen is the first thing they see in the morning and the last thing they look at before sleeping.',
      'Before smartphones, a camera, a music player, a map, an alarm clock, and a telephone were separate objects. Now all of them live inside one device. If you lose your phone today, you lose not just a way to call people but also your photos, your notes, and your sense of direction.',
      'Communication has changed the most. We no longer need to wait at home for a call; we can message a friend from a bus or a park. At the same time, some people feel that they talk less face to face. A family at dinner may sit together while each person looks at a screen.',
      'Travel has also become easier. A map app can guide you turn by turn, and a ride-sharing service can bring a car to your door in minutes. In the past, getting lost in a new city could be a real problem; today, it is almost impossible to stay lost for long.',
      'Our memories have changed too. Because we can photograph everything, we store thousands of pictures but sometimes forget the moments behind them. Experts say that taking too many photos may weaken our memory of an experience, since we trust the camera to remember for us.',
      'Smartphones are powerful tools, but they are tools all the same. The question is not whether to use them, but how to use them without letting the small screen rule our attention.',
    ],
    keyWords: [
      { headword: 'imagine', pos: 'v.', zh: '想象', en: 'to form a picture of something in your mind' },
      { headword: 'separate', pos: 'adj.', zh: '分开的,独立的', en: 'not joined or connected to something' },
      { headword: 'device', pos: 'n.', zh: '设备', en: 'a machine or tool made for a purpose' },
      { headword: 'ride-sharing', pos: 'adj.', zh: '网约车的,拼车的', en: 'a service where people order car rides through an app' },
      { headword: 'weaken', pos: 'v.', zh: '削弱', en: 'to make something less strong' },
      { headword: 'attention', pos: 'n.', zh: '注意力', en: 'the act of watching or listening carefully' },
    ],
  },
];
