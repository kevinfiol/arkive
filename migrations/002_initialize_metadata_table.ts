import { db } from '../db.ts';

try {
  const now = (new Date()).toISOString();

  const insert = db.prepare(`
    insert into metadata (modified_time, page_cache)
    values (:modified_time, :page_cache)
  `);

  insert.run({ modified_time: now, page_cache: null });
} catch (e) {
  console.error(e);
}