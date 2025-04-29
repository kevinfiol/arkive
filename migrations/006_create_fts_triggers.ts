import type { Database } from '@db/sqlite';

export default function (db: Database) {
  const afterInsert = db.prepare(`
    create trigger pages_after_insert after insert on page
    begin
      insert into page_fts(rowid, id, title, url, filename)
      values (new.rowid, new.id, new.title, new.url, new.filename);
    end;
  `);

  const afterUpdate = db.prepare(`
    create trigger pages_after_update after update on page
    begin
      update page_fts
      set title = new.title,
          url = new.url,
          filename = new.filename
      where rowid = old.rowid;
    end;
  `);

  const afterDelete = db.prepare(`
    create trigger pages_after_delete after delete on page
    begin
      delete from page_fts
      where rowid = old.rowid;
    end;
  `);

  // create triggers
  afterInsert.run();
  afterUpdate.run();
  afterDelete.run();
}
