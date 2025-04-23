import type { Database } from '@db/sqlite';

export default function (db: Database) {
  const create = db.prepare(`
    create virtual table page_fts
    using fts5(title, url, filename, tokenize="trigram")
  `);

  create.run();
}
