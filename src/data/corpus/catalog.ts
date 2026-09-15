/**
 * 每日语料的"离线目录":一批 Project Gutenberg 公版英文书。
 *
 * 为什么需要它:原来只依赖 gutendex 这个第三方 API,它一宕机(或网络不通)
 * 整个"每日语料"就完全没法用。现在 gutendex 只作为"随机取书"的首选,
 * 失败时改用这里的目录 + Gutenberg 官方镜像直链,保证功能可用。
 *
 * 书目标题用英文原名;文章标题由 annotateBlock 再生成。
 */

export interface CatalogBook {
  /** Gutenberg 书号(决定下载地址) */
  id: number;
  title: string;
  /** 作者(仅展示用) */
  author?: string;
}

export const CORPUS_CATALOG: readonly CatalogBook[] = [
  { id: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll' },
  { id: 12, title: 'Through the Looking-Glass', author: 'Lewis Carroll' },
  { id: 16, title: 'Peter Pan', author: 'J. M. Barrie' },
  { id: 21, title: "Aesop's Fables", author: 'Aesop' },
  { id: 35, title: 'The Time Machine', author: 'H. G. Wells' },
  { id: 36, title: 'The War of the Worlds', author: 'H. G. Wells' },
  { id: 43, title: 'The Strange Case of Dr. Jekyll and Mr. Hyde', author: 'R. L. Stevenson' },
  { id: 45, title: 'Anne of Green Gables', author: 'L. M. Montgomery' },
  { id: 46, title: 'A Christmas Carol', author: 'Charles Dickens' },
  { id: 55, title: 'The Wonderful Wizard of Oz', author: 'L. Frank Baum' },
  { id: 74, title: 'The Adventures of Tom Sawyer', author: 'Mark Twain' },
  { id: 76, title: 'Adventures of Huckleberry Finn', author: 'Mark Twain' },
  { id: 84, title: 'Frankenstein', author: 'Mary Shelley' },
  { id: 98, title: 'A Tale of Two Cities', author: 'Charles Dickens' },
  { id: 108, title: 'The Return of Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { id: 120, title: 'Treasure Island', author: 'R. L. Stevenson' },
  { id: 174, title: 'The Picture of Dorian Gray', author: 'Oscar Wilde' },
  { id: 345, title: 'Dracula', author: 'Bram Stoker' },
  { id: 1232, title: 'The Prince', author: 'Niccolò Machiavelli' },
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen' },
  { id: 1400, title: 'Great Expectations', author: 'Charles Dickens' },
  { id: 1497, title: 'The Republic', author: 'Plato' },
  { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { id: 1952, title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman' },
  { id: 2009, title: 'On the Origin of Species', author: 'Charles Darwin' },
  { id: 2148, title: 'The Works of Edgar Allan Poe, Volume 1', author: 'Edgar Allan Poe' },
  { id: 2591, title: "Grimms' Fairy Tales", author: 'Brothers Grimm' },
  { id: 2600, title: 'War and Peace', author: 'Leo Tolstoy' },
  { id: 2680, title: 'Meditations', author: 'Marcus Aurelius' },
  { id: 2701, title: 'Moby Dick; or, The Whale', author: 'Herman Melville' },
  { id: 64317, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
];

/**
 * 同一本书的正文候选地址(按优先级)。
 * 全部实测可用(2026-09 从国内网络:0.9–1.4s);
 * 国内高校镜像(清华/中科大/南大)并不提供 Gutenberg 正文镜像,故不采用。
 * 只放**直链**,不放会重定向的 /ebooks/ 路径,以便快速失败切换下一个。
 */
export function gutenbergMirrors(id: number): string[] {
  return [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://gutenberg.pglaf.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
  ];
}
