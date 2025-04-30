import { join } from '@std/path';
import { deadline } from '@std/async';
import { MONOLITH_OPTIONS, YT_DLP_OPTIONS, ARCHIVE_PATH, JOB_TIME_LIMIT, JOB_STATUS } from './constants.ts';
import { fetchDocumentTitle, createFilename } from './util.ts';

export function parseMonolithOpts(formEntries: IterableIterator<[string, FormDataEntryValue]>) {
  const monolithOpts: string[] = [];

  for (const entry of formEntries) {
    // collect monolith opt flags
    const key = entry[0] as keyof typeof MONOLITH_OPTIONS;
    if (key in MONOLITH_OPTIONS && entry[1] === 'on') {
      // if valid option and item is checked
      const flag = MONOLITH_OPTIONS[key].flag;
      monolithOpts.push(flag);
    }
  }

  return monolithOpts;
}

export async function monolithJob(queue: any, opts: string[], jobId: string, { title = '', url = '' }) {
  let process: Deno.ChildProcess | null = null;

  try {
    if (title.trim() === '') {
      // if user did not set title, fetch from document url
      const docTitle = await fetchDocumentTitle(url);
      title = docTitle.data;
    }

    const timestamp = Date.now();
    const filename = createFilename(timestamp, title);
    const path = join(ARCHIVE_PATH, filename);

    const cmd = new Deno.Command('monolith', {
      args: [`--output=${path}`, ...opts, url],
      stderr: 'piped',
    });

    process = cmd.spawn();
    const result = await deadline(process.output(), JOB_TIME_LIMIT);
    process = null;

    if (!result.success) {
      console.error(new TextDecoder().decode(result.stderr));
      throw Error(`Job ${jobId} for ${path} failed`);
    }

    const size = await getSize(path);
    const page: PartialPage = { filename, title, url, size, tags: [] };

    const { data: pageId, error } = DB.addPage(page);
    if (error) throw error;
    if (pageId === undefined) throw Error('Error occurred while adding page');

    const tags = parseTagCSV(tagCSV);
    if (tags.length) DB.setTags(pageId, tags);

    JOBS.set(jobId, JOB_STATUS.completed);
  } catch (e) {
    console.error(e);
    JOBS.set(jobId, JOB_STATUS.failed);

    if (process) {
      try {
        process.kill('SIGTERM');
      } catch {
        console.error('Failed to kill process for ' + jobId);
      }
    }
  } finally {
    JOB_QUEUE.done();
  }
}