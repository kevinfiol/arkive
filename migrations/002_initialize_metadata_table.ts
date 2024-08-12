import type { Database } from '@db/sqlite';

export default function (db: Database) {
  const modified_time = (new Date()).toISOString();

  const insert = db.prepare(`
    insert into metadata (modified_time, page_cache)
    values (:modified_time, :page_cache)
  `);

  insert.run({ modified_time, page_cache: null });
}
