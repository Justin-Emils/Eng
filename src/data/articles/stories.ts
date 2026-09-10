/**
 * 语料 · 故事类(Aesop 公版寓言,现代简单英文改写,非原文照抄)。
 * 完整英文正文,禁止占位文本。
 */

import type { RawArticle } from './build';

export const STORY_ARTICLES: RawArticle[] = [
  {
    id: 'aesop-tortoise-hare',
    title: 'The Tortoise and the Hare',
    summary:
      'A slow tortoise challenges a fast hare to a race and wins by never giving up. A classic lesson about steady effort.',
    level: 'A2',
    vocab: 1200,
    topicTags: ['故事'],
    paragraphs: [
      'One day, a hare was laughing at a tortoise because the tortoise moved so slowly. "You are the slowest animal in the forest," said the hare. "I can run faster than the wind."',
      'The tortoise did not get angry. Instead, he smiled and said, "Let us have a race. I am slow, but I will not stop until I reach the end."',
      'The hare thought this was very funny. "A race with you will be easy," he said. "I will win while I am still half asleep."',
      'When the race began, the hare ran very fast and soon disappeared ahead. After a while, he looked back and could not see the tortoise at all. "I have so much time," he thought. "I will rest under this tree for a little while."',
      'So the hare lay down under a tree and fell asleep. Meanwhile, the tortoise kept walking. He did not stop, and he did not look back. Step by step, he passed the sleeping hare.',
      'When the hare woke up, the sun was low. He ran as fast as he could, but it was too late. The tortoise had already reached the finish line and was waiting for him with a calm smile.',
      'The hare learned a hard lesson that day: being fast is not enough. If you stop and rest, a slow and steady friend can pass you. Slow but steady wins the race.',
    ],
    keyWords: [
      { headword: 'tortoise', pos: 'n.', zh: '乌龟', en: 'a slow land animal with a hard shell' },
      { headword: 'hare', pos: 'n.', zh: '野兔', en: 'a fast animal like a large rabbit' },
      { headword: 'challenge', pos: 'v.', zh: '挑战', en: 'to ask someone to compete with you' },
      { headword: 'steady', pos: 'adj.', zh: '稳步的,持续的', en: 'moving or happening at a regular pace' },
      { headword: 'meanwhile', pos: 'adv.', zh: '与此同时', en: 'at the same time' },
      { headword: 'finish line', pos: 'n.', zh: '终点线', en: 'the line that marks the end of a race' },
    ],
    credit: 'Aesop fable, retold in simple English.',
  },
  {
    id: 'aesop-boy-wolf',
    title: 'The Boy Who Cried Wolf',
    summary:
      'A shepherd boy tricks his village twice by shouting about a wolf. When a real wolf comes, nobody believes him.',
    level: 'A2',
    vocab: 1100,
    topicTags: ['故事'],
    paragraphs: [
      'A long time ago, a young shepherd boy watched his sheep on a hill near a small village. The work was boring, and the boy wanted some excitement.',
      'One afternoon, he decided to play a trick. He shouted as loudly as he could, "Wolf! Wolf! A wolf is attacking my sheep!"',
      'The villagers heard his cry and ran up the hill with sticks and tools to help him. But when they arrived, there was no wolf. The boy laughed and said, "I was only joking!"',
      'The villagers were annoyed, but they returned to their homes. A few days later, the boy played the same trick again. Once more, the villagers ran to help him, and once more, they found nothing.',
      'They were very angry. "Do not lie about danger," they warned him. "One day, we will not come when you call."',
      'Then one evening, a real wolf came quietly out of the forest. The boy was terrified. He shouted with all his strength, "Wolf! Wolf! Please come and help me!"',
      'This time, the villagers heard his voice, but they shook their heads. "He is lying again," they said, and they stayed in their homes.',
      'When the wolf had gone and the sheep were lost, the boy sat alone on the hill and understood his mistake. Nobody trusts a person who tells lies, even when that person finally tells the truth.',
    ],
    keyWords: [
      { headword: 'shepherd', pos: 'n.', zh: '牧羊人', en: 'a person who takes care of sheep' },
      { headword: 'village', pos: 'n.', zh: '村庄', en: 'a small group of houses in the countryside' },
      { headword: 'trick', pos: 'n.', zh: '恶作剧,把戏', en: 'something done to fool someone' },
      { headword: 'annoyed', pos: 'adj.', zh: '恼火的', en: 'slightly angry' },
      { headword: 'terrified', pos: 'adj.', zh: '惊恐的', en: 'very afraid' },
      { headword: 'trust', pos: 'v.', zh: '信任', en: 'to believe that someone is honest' },
    ],
    credit: 'Aesop fable, retold in simple English.',
  },
  {
    id: 'aesop-north-wind-sun',
    title: 'The North Wind and the Sun',
    summary:
      'The wind and the sun argue about who is stronger. A traveler shows that kindness can do what force cannot.',
    level: 'A2',
    vocab: 1300,
    topicTags: ['故事'],
    paragraphs: [
      'The North Wind and the Sun were arguing one day. Each one claimed to be stronger than the other. "I can blow down trees and ships," roared the wind. "No one can stop me."',
      'The Sun smiled warmly. "Strength is not about making noise," it said. "Let me prove that I am stronger in a quiet way."',
      'At that moment, they saw a traveler walking along the road below. He wore a thick coat to protect himself from the cold.',
      '"Here is our test," said the Sun. "Whoever can make that traveler take off his coat is the stronger. You try first."',
      'The North Wind agreed and began to blow as hard as it could. The wind screamed around the traveler and tried to tear the coat from his back.',
      'But the harder the wind blew, the tighter the traveler held his coat. He wrapped his arms around himself and walked on, bending against the cold.',
      'Then it was the Sun\'s turn. The Sun shone gently and warmly from the clear sky. Little by little, the traveler began to feel warm. He loosened his coat, then opened it, and finally took it off and carried it over his arm.',
      'The North Wind had to admit that the Sun had won. Warmth and kindness had done what force and anger could not. Gentle persuasion is often stronger than hard pressure.',
    ],
    keyWords: [
      { headword: 'roar', pos: 'v.', zh: '咆哮', en: 'to make a very loud, deep sound' },
      { headword: 'prove', pos: 'v.', zh: '证明', en: 'to show that something is true' },
      { headword: 'traveler', pos: 'n.', zh: '旅行者', en: 'a person who is going on a journey' },
      { headword: 'thick', pos: 'adj.', zh: '厚的', en: 'wide or deep from one side to the other' },
      { headword: 'loosen', pos: 'v.', zh: '松开', en: 'to make something less tight' },
      { headword: 'persuasion', pos: 'n.', zh: '说服', en: 'the act of making someone agree by talking' },
    ],
    credit: 'Aesop fable, retold in simple English.',
  },
];
