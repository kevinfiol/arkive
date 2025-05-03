import type { Database } from '@db/sqlite';

export default function (db: Database) {
  const create = db.prepare(`
    create table if not exists page (
      id integer primary key,
      title text not null,
      url text default "" not null,
      filename text not null unique,
      size integer not null,
      is_media integer not null,
      created_time text default (datetime('now'))
    ) strict;
  `);

  create.run();
}
