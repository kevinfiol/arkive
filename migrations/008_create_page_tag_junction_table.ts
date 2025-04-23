import type { Database } from '@db/sqlite';

export default function (db: Database) {
  const create = db.prepare(`
    create table if not exists page_tag (
      page_id integer not null,
      tag_id integer not null,
      primary key (page_id, tag_id),
      foreign key (page_id) references page(id) on delete cascade,
      foreign key (tag_id) references tag(id) on delete cascade
    ) strict;

    -- create index
    create index if not exists idx_page_tag_tag_id on page_tag(tag_id);
  `);

  create.run();
}
