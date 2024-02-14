/// <reference lib="deno.unstable" />
import type { Page, PageCache } from './types.ts';
import { join } from 'std/path/mod.ts';

const DB_FILENAME = 'store';
const INIT = ['init'];
const PASSWORD = ['password'];
const PAGE_CACHE = ['page_cache'];
const PAGE_DATA = ['page_data'];
const MOD_TIME = ['last_modified'];

export async function Database(path: string) {
  const KV = await Deno.openKv(join(path, DB_FILENAME));

  return {
    async checkInit() {
      let data = false;
      let error = undefined;

      try {
        const res = await KV.get<boolean>(INIT);
        data = res.value !== null;
      } catch (e) {
        error = e;
      }

      return { data, error };
    },

    async initApp(hashed: string) {
      let ok = true;
      let error = undefined;

      try {
        await KV.atomic()
          .set(INIT, true)
          .set(PASSWORD, hashed)
          .commit();
      } catch (e) {
        error = e;
        ok = false;
      }

      return { ok, error };
    },

    async getHashedPassword() {
      let data = '';
      let error = undefined;

      try {
        const res = await KV.get<string>(PASSWORD);

        if (res.value === null) {
          throw Error('Password does not exist. App may be uninitialized.');
        }

        data = res.value;
      } catch (e) {
        error = e;
      }

      return { data, error };
    },

    async setCache({ pages, size }: PageCache) {
      let error = undefined;

      try {
        await KV.set(PAGE_CACHE, { pages, size });
      } catch (e) {
        error = e;
      }

      return { error };
    },

    async getCache() {
      const data: PageCache = {
        pages: [],
        size: '0 B',
      };

      let error = undefined;

      try {
        const res = await KV.get<PageCache>(PAGE_CACHE);
        data.pages = res.value !== null ? res.value.pages : [];
        data.size = res.value !== null ? res.value.size : '0 B';
      } catch (e) {
        error = e;
      }

      return { data, error };
    },

    async getPageData(files: Array<{ name: string; size: string }>) {
      const data: { [filename: string]: Page } = {};
      let error = undefined;

      try {
        const unsaved: Page[] = [];
        const keys = files.map((file) => [...PAGE_DATA, file.name]);
        const results = await KV.getMany<Page[]>(keys);

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const filename = result.key[1] as string;

          if (result.value !== null) {
            data[filename] = result.value;
          } else {
            // we don't have data for that filename saved
            // lets create a blank slate for it
            const newPage = {
              title: filename,
              url: '',
              filename,
              size: files[i].size,
            };

            unsaved.push(newPage);
            data[filename] = newPage;
          }
        }

        if (unsaved.length > 0) {
          // save all the new pages
          const operation = KV.atomic();

          for (const page of unsaved) {
            operation.set([...PAGE_DATA, page.filename], page);
          }

          await operation.commit();
        }
      } catch (e) {
        error = e;
      }

      return { data, error };
    },

    async checkModified(isoString: string) {
      let changed = true,
        error = undefined;

      try {
        const modTime = await KV.get<string>(MOD_TIME);

        if (modTime.value !== isoString) {
          changed = true;
          await KV.set(MOD_TIME, isoString);
        } else {
          changed = false;
        }
      } catch (e) {
        error = e;
      }

      return { data: changed, error };
    },

    async getPage(filename: string) {
      let data: Page | undefined = undefined,
        error = undefined;

      try {
        const entry = await KV.get<Page>([...PAGE_DATA, filename]);
        if (entry.value === null) throw Error('KV: article not found.');
        data = entry.value;
      } catch (e) {
        error = e;
      }

      return { data, error };
    },

    async deletePage(filename: string) {
      let ok = true,
        error = undefined;

      try {
        const result = await KV.atomic()
          .delete([...PAGE_DATA, filename])
          .commit();

        if (!result.ok) throw Error('KV: Delete Page Failed.');
      } catch (e) {
        error = e;
        ok = false;
      }

      return { ok, error };
    },

    async addPage(page: Page) {
      let ok = true,
        error = undefined;

      try {
        const result = await KV.set([...PAGE_DATA, page.filename], page);
        if (!result.ok) throw Error('KV: Add Page Failed.');
      } catch (e) {
        error = e;
        ok = false;
      }

      return { ok, error };
    },

    async editPage(
      { filename, title, url }: {
        filename: string;
        title: string;
        url: string;
      },
    ) {
      let ok = true;
      let error = undefined;

      try {
        const key = [...PAGE_DATA, filename];
        const result = await KV.get<Page>(key);
        if (result.value === null) {
          throw Error('KV: Edit Page Failed; does not exist');
        }
        const page: Page = { ...result.value, title, url };
        await KV.set(key, page);

        // need to bust cache
        const now = (new Date()).toISOString();
        await KV.set(MOD_TIME, now);
      } catch (e) {
        error = e;
        ok = false;
      }

      return { ok, error };
    },
  };
}
