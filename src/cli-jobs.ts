import { join } from '@std/path';
import { deadline } from '@std/async';
import {
  ARCHIVE_PATH,
  MONOLITH_TIME_LIMIT,
  YT_DLP_TIME_LIMIT,
} from './constants.ts';
import { createFilename, fetchDocumentTitle, getSize } from './util.ts';
import * as DB from './sqlite/arkive.ts';
import type { PartialPage } from './types.ts';

export function parseOpts(
  formEntries: IterableIterator<[string, FormDataEntryValue]>,
  allOptions: Record<string, { flag: string; label: string }>,
) {
  const opts: string[] = [];

  for (const entry of formEntries) {
    // collect opt flags
    const key = entry[0] as keyof typeof allOptions;
    if (key in allOptions && entry[1] === 'on') {
      // if valid option and item is checked
      const flag = allOptions[key].flag;
      opts.push(flag);
    }
  }

  return opts;
}

export async function monolithJob(
  opts: string[],
  attrs: { title: string; url: string; tags: string[] },
) {
  let process: Deno.ChildProcess | null = null;
  let { title, url, tags } = attrs;
  let filename = '';

  try {
    if (title.trim() === '') {
      // if user did not set title, fetch from document url
      const docTitle = await fetchDocumentTitle(url);
      title = docTitle.data;
    }

    const timestamp = Date.now();
    filename = createFilename(timestamp, title) + '.html';
    const path = join(ARCHIVE_PATH, filename);

    const cmd = new Deno.Command('monolith', {
      args: [`--output=${path}`, ...opts, url],
      stderr: 'piped',
    });

    process = cmd.spawn();
    const result = await deadline(process.output(), MONOLITH_TIME_LIMIT);
    process = null;

    if (!result.success) {
      console.error(new TextDecoder().decode(result.stderr));
      throw Error(`Job for ${filename} failed`);
    }

    const size = await getSize(path);
    const page: PartialPage = { filename, title, url, size, tags: [] };

    const { data: pageId, error } = DB.addPage(page);
    if (error) throw error;
    if (pageId === undefined) throw Error('Error occurred while adding page');
    if (tags.length) DB.setTags(pageId, tags);
  } catch (e) {
    console.error(e);

    if (process) {
      try {
        process.kill('SIGTERM');
      } catch {
        console.error('Failed to kill process for ' + filename);
      }
    }

    throw e;
  }
}

export async function ytdlpJob(
  opts: string[],
  attrs: { url: string; tags: string[]; maxres: string },
) {
  let process: Deno.ChildProcess | null = null;
  let filename = '';
  const { url, tags, maxres } = attrs;

  try {
    const doc = await fetchDocumentTitle(url);
    if (doc.error) throw Error('Could not retrieve filename');

    const title = doc.data;
    const timestamp = Date.now();
    filename = createFilename(timestamp, title);

    const cmd = new Deno.Command('yt-dlp', {
      args: [
        ...opts,
        '--no-playlist',
        '--windows-filenames',
        '--max-filesize',
        '5.0G',
        '-P',
        ARCHIVE_PATH,
        '-o',
        `${filename}.%(ext)s`,
        url,
        '-f',
        `bestvideo[height<=${maxres}]+bestaudio`,
      ],
      stderr: 'piped',
    });

    process = cmd.spawn();
    const result = await deadline(process.output(), YT_DLP_TIME_LIMIT);
    process = null;

    if (!result.success) {
      console.error(new TextDecoder().decode(result.stderr));
      throw Error(`Job for ${filename} failed`);
    }

    const size = await getSize(join(ARCHIVE_PATH, filename + '.mp4'));
    const page: PartialPage = {
      filename: filename + '.mp4',
      title,
      url,
      size,
      tags: [],
    };

    const { data: pageId, error } = DB.addPage(page);
    if (error) throw error;
    if (pageId === undefined) throw Error('Error occurred while adding page');
    if (tags.length) DB.setTags(pageId, tags);
  } catch (e) {
    console.error(e);

    if (process) {
      try {
        process.kill('SIGTERM');
      } catch {
        console.error('Failed to kill process for ' + filename);
      }
    }

    throw e;
  }
}
