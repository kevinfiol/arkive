import { Database } from '@db/sqlite';
import { join } from '@std/path';
import { existsSync } from '@std/fs';
import { DATA_PATH, ZERO_BYTES } from './constants.ts';
import type { Page, PageCache } from './types.ts';

const DB_FILENAME = 'arkive.db';

// ensure data path exists before opening/creating database
if (!existsSync(DATA_PATH)) Deno.mkdirSync(DATA_PATH);
export const db = new Database(join(DATA_PATH, DB_FILENAME));

// use WAL mode
db.exec('pragma journal_mode = WAL');

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
      select *
      from page
      where filename = :filename
    `);

    page = select.get<Page>({ filename });
  } catch (e) {
    error = e;
  }

  return { data: page, error };
}

export function addPage(page: Page) {
  let ok = true;
  let error = undefined;

  try {
    const insert = db.prepare(`
      insert into page (title, url, filename, size)
      values (:title, :url, :filename, :size)
    `);

    const changes = insert.run({ ...page });
    if (changes !== 1) throw Error('Unable to add page');
  } catch (e) {
    error = e;
    ok = false;
  }

  return { ok, error };
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

export function editPage(filename: string, title: string, url: string) {
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
      select *
      from page
      where filename in (${paramStr})
    `);

    const rows = select.all<Page>(...filenames);
    for (const row of rows) data[row.filename] = row;
  } catch (e) {
    error = e;
    console.error(e);
  }

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

    const changes = deletion.run(...filenames);
    if (changes < 1) throw Error('Unable to delete Pages');
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
