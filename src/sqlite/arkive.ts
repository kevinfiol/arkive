import { join } from '@std/path';
import { Database } from '@db/sqlite';
import { DATA_PATH, ZERO_BYTES } from '../constants.ts';
import type { Page, PageCache, PageRow, PartialPage } from '../types.ts';

const DB_PATH = join(DATA_PATH, 'arkive.db');
export const db = new Database(DB_PATH);

db.exec('pragma journal_mode = WAL;');
db.exec('pragma foreign_keys = true;');
db.exec('pragma temp_store = memory;');

export function updateModified(isoTimestamp: string) {
  let ok = true;
  let error = undefined;

  try {
    const update = db.prepare(`
      update metadata
      set modified_time = :modifiedTime
      where rowid = 1
    `);

    const changes = update.run({ modifiedTime: isoTimestamp });
    if (changes < 1) throw Error('Unable to update modified_time');
  } catch (e) {
    ok = false;
    error = e;
  }

  return { ok, error };
}

export function checkModified(isoTimestamp: string) {
  let changed = true; // lean on updating
  let error = undefined;

  try {
    const select = db.prepare(`
      select modified_time
      from metadata
      where rowid = 1;
    `);

    const row = select.get<{ modified_time: string }>();
    changed = row?.modified_time !== isoTimestamp;

    if (changed) {
      const update = updateModified(isoTimestamp);
      if (!update.ok) throw update.error;
    }
  } catch (e) {
    error = e;
  }

  return { data: changed, error };
}

export function getCache() {
  let data: PageCache = { pages: [], size: ZERO_BYTES };
  let error = undefined;

  try {
    const select = db.prepare(`
      select page_cache
      from metadata
      where rowid = 1;
    `);

    const row = select.get<{ page_cache?: string }>();

    if (row && row.page_cache) {
      data = JSON.parse(row.page_cache) as PageCache;
    }
  } catch (e) {
    error = e;
  }

  return { data, error };
}

export function setCache({ pages, size }: PageCache) {
  let error = undefined;

  try {
    const update = db.prepare(`
      update metadata
      set page_cache = :pageCache
      where rowid = 1;
    `);

    const json = JSON.stringify({ pages, size });
    update.run({ pageCache: json });
  } catch (e) {
    error = e;
    console.error(e);
  }

  return { error };
}

export function getPage(filename: string) {
  let page: Page | undefined = undefined;
  let error = undefined;

  try {
    const select = db.prepare(`
      select
        p.*,
        group_concat(t.name, ',') as tags
      from page p
      left join page_tag pt on p.id = pt.page_id
      left join tag t on pt.tag_id = t.id
      where filename = :filename;
    `);

    const row = select.get<PageRow>({ filename });

    if (row) {
      const tags = row.tags ? row.tags.split(',') : [];
      page = { ...row, tags };
    }
  } catch (e) {
    error = e;
  }

  return { data: page, error };
}

export function addPage(page: PartialPage) {
  let id = undefined;
  let error = undefined;

  try {
    const insert = db.prepare(`
      insert into page (title, url, filename, size)
      values (:title, :url, :filename, :size)
    `);

    const changes = insert.run({
      title: page.title,
      url: page.url,
      filename: page.filename,
      size: page.size,
    });
    if (changes !== 1) throw Error('Unable to add page');
    id = db.lastInsertRowId;
  } catch (e) {
    error = e;
  }

  return { data: id, error };
}

export function deletePage(filename: string) {
  let ok = true;
  let error = undefined;

  try {
    const deletion = db.prepare(`
      delete from page
      where filename = :filename
    `);

    const changes = deletion.run({ filename });
    if (changes < 1) throw Error('Unable to delete Page');
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
}

export function editPage(
  pageId: number,
  filename: string,
  title: string,
  url: string,
  tags: string[],
) {
  let ok = true;
  let error = undefined;

  try {
    const update = db.prepare(`
      update page
      set title = :title,
          url = :url
      where filename = :filename
    `);

    const changes = update.run({ filename, title, url });
    if (changes < 1) throw Error('Unable to edit Page');

    const setTagsOp = setTags(pageId, tags);
    if (!setTagsOp.ok) throw setTagsOp.error;

    // bust cache
    const isoTimestamp = (new Date()).toISOString();
    updateModified(isoTimestamp);
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
}

export function getPagesData(filenames: string[]) {
  const data: { [filename: string]: Page } = {};
  let error = undefined;

  try {
    const paramStr = Array(filenames.length).fill('?').join(',');
    const select = db.prepare(`
      select
        p.*,
        group_concat(t.name, ',') as tags
      from page p
      left join page_tag pt on p.id = pt.page_id
      left join tag t on pt.tag_id = t.id
      where filename in (${paramStr})
    `);

    const rows = select.all<PageRow>(...filenames);
    for (const row of rows) {
      if (row.id === null) continue;

      const tags = row.tags ? row.tags.split(',') : [];
      const page: Page = { ...row, tags };
      data[page.filename] = page;
    }
  } catch (e) {
    error = e;
    console.error(e);
  }

  console.log({ data });
  return { data, error };
}

export function deleteRemovedPages(filenames: string[]) {
  let ok = true;
  let error = undefined;

  try {
    const paramStr = Array(filenames.length).fill('?').join(',');
    const deletion = db.prepare(`
      delete from page
      where filename not in (${paramStr})
    `);

    deletion.run(...filenames);
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
}

export function createUser(hashed: string) {
  let ok = true;
  let error = undefined;

  try {
    const insert = db.prepare(`
      insert into user (hashed)
      values(:hashed)
    `);

    const changes = insert.run({ hashed });
    if (changes !== 1) throw Error('Unable to create user');
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
}

export function initialize() {
  let ok = true;
  let error = undefined;

  try {
    const update = db.prepare(`
      update metadata
      set initialized = true
      where rowid = 1
    `);

    const changes = update.run();
    if (changes < 1) throw Error('Unable to initialize');
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
}

export function checkInitialized() {
  let init = false;
  let error = undefined;

  try {
    const select = db.prepare(`
      select initialized
      from metadata
      where rowid = 1
    `);

    const row = select.get<{ initialized: boolean }>();
    init = row ? row.initialized : false;
  } catch (e) {
    error = e;
  }

  return { data: init, error };
}

export function getHashedPassword() {
  let hashed = '';
  let error = undefined;

  try {
    const select = db.prepare(`
      select hashed
      from user
      where rowid = 1
    `);

    const row = select.get<{ hashed: string }>();
    if (row) hashed = row.hashed;
  } catch (e) {
    error = e;
  }

  return { data: hashed, error };
}

export function searchPages(query: string) {
  let results: { filename: Page['filename'] }[] = [];
  let error = undefined;

  query = '"' + query + '"'; // surround with quotes so SQLite respects punctuation & special chars

  try {
    const select = db.prepare(`
      select filename
      from page_fts
      where page_fts match :query
    `);

    results = select.all<{ filename: Page['filename'] }>({ query });
  } catch (e) {
    error = e;
  }

  return { data: results, error };
}

export function setTags(pageId: number, tags: string[]) {
  let ok = true;
  let error = undefined;

  try {
    const paramsStr = tags.map(() => '?').join(',');

    const tagInsert = db.prepare(`
      insert or ignore into tag (name) values (?)
    `);

    const pageTagInsert = db.prepare(`
      insert or ignore into page_tag (page_id, tag_id)
      select ?, id from tag where name = ?
    `);

    const pageTagDelete = db.prepare(`
      delete from page_tag
      where page_id = ?
      and tag_id not in (
        select id from tag
        where name in
        (${paramsStr})
      )
    `);

    const transaction = db.transaction((pageId: number, tags: string[]) => {
      for (const tag of tags) {
        tagInsert.run(tag);
        pageTagInsert.run(pageId, tag);
      }

      if (tags.length > 0) {
        pageTagDelete.run(pageId, ...tags);
      } else {
        const deleteFromPageTag = db.prepare(`
          delete from page_tag where page_id = ?
        `);

        deleteFromPageTag.run(pageId);
      }
    });

    transaction(pageId, tags);
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
}
