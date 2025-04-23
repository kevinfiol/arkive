import type { Database } from '@db/sqlite';

export default function (db: Database) {
  const create = db.prepare(`
    create table if not exists user (
      id integer primary key,
      hashed text not null,
      user text default "",
      created_time text default (datetime('now'))
    ) strict;
  `);

  create.run();
}
