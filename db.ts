/// <reference lib="deno.unstable" />
import type { ArchivePage } from './types.ts';
import { join } from 'std/path/mod.ts';

const DB_FILENAME = 'store';
const ARTICLES = ['articles'];
const COUNT = ['count'];

const INCREMENT = 1n;
const DECREMENT = 0xffffffffffffffffn; // weird KV beta workaround

export async function Database(path: string) {
  const KV = await Deno.openKv(join(path, DB_FILENAME));

  return {
    async getCount() {
      let data = 0, error = undefined;

      try {
        const entry = await KV.get<bigint>(COUNT);
        if (entry.value === null) throw Error('KV: count not set.');
        data = Number(entry.value);
      } catch (e) {
        error = e;
      }

      return { data, error };
    },

    async getPage(id: string) {
      let data: ArchivePage | undefined = undefined,
        error = undefined;

      try {
        const entry = await KV.get<ArchivePage>([...ARTICLES, id]);
        if (entry.value === null) throw Error('KV: article not found.');
        data = entry.value;
      } catch (e) {
        error = e;
      }

      return { data, error };
    },

    async deletePage(id: string) {
      let ok = true,
        error = undefined;

      try {
        const result = await KV.atomic()
          .delete([...ARTICLES, id])
          .sum(COUNT, DECREMENT)
          .commit();

        if (!result.ok) throw Error('KV: Delete Page Failed.');
      } catch (e) {
        error = e;
        ok = false;
      }

      return { ok, error };
    },

    async addPage(page: ArchivePage) {
      let ok = true,
        error = undefined;

      try {
        const result = await KV.atomic()
          .set([...ARTICLES, page.id], page)
          .sum(COUNT, INCREMENT)
          .commit();

        if (!result.ok) throw Error('KV: Add Page Failed.');
      } catch (e) {
        error = e;
        ok = false;
      }

      return { ok, error };
    },

    async getPages() {
      const data: ArchivePage[] = [];
      let error = undefined;

      try {
        const entries = KV.list<ArchivePage>({
          prefix: ARTICLES,
        });

        for await (const entry of entries) {
          data.push(entry.value);
        }
      } catch (e) {
        error = e;
      }

      return { data, error };
    },
  };
}
