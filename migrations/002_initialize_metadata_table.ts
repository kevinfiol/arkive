import { db } from '../db.ts';

try {
  const now = (new Date()).toISOString();

  const insert = db.prepare(`
    insert into metadata
    values (:modified)
  `);

  insert.run({ modified: now });
} catch (e) {
  console.error(e);
}