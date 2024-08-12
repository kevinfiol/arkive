import type { Database } from '@db/sqlite';

export default function (db: Database) {
  const create = db.prepare(`
    create table if not exists user (
      hashed text not null,
      user text default ""
    );
  `);

  create.run();
}
