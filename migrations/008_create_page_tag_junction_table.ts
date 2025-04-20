import type { Database } from '@db/sqlite';

export default function (db: Database) {
  const create = db.prepare(`
    create table if not exists page_tag (
      page_rowid integer not null,
      tag_rowid integer not null,
      primary key (page_rowid, tag_rowid),
      foreign key (page_rowid) references page(rowid) on delete cascade,
      foreign key (tag_rowid) references tag(rowid) on delete cascade
    ) strict;

    -- create index
    create index if not exists idx_page_tag_tag_rowid on page_tag(tag_rowid);
  `);

  create.run();
}
