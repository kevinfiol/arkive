import type { Database } from '@db/sqlite';

export default function (db: Database) {
  const create = db.prepare(`
    create table if not exists page (
      title text not null,
      url text default "" not null,
      filename text not null,
      size integer not null
    );
  `);

  create.run();
}
