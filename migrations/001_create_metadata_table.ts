import { db } from '../db.ts';

try {
  const create = db.prepare(`
    create table if not exists metadata (
      modified_time text not null,
      page_cache text
    );
  `);

  create.run();
} catch (e) {
  console.error(e);
}