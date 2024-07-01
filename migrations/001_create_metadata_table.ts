import type { Database } from '@db/sqlite';

export default function(db: Database) {
  const create = db.prepare(`
    create table if not exists metadata (
      modified_time text not null,
      page_cache text
    );
  `);

  create.run()
}