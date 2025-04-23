import type { Database } from '@db/sqlite';

export default function (db: Database) {
  const create = db.prepare(`
    create table if not exists tag (
      id integer primary key,
      name text not null unique
    ) strict;
  `);

  create.run();
}
