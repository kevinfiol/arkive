import { Hono } from '@hono/hono';
import { join } from '@std/path';
import { Add } from '../templates/index.ts';
import { MONOLITH_OPTIONS, JOB_STATUS, ARCHIVE_PATH } from '../constants.ts';
import { fetchDocumentTitle, createFilename, getSize } from '../util.ts';
import * as database from '../db.ts';
import type { SecureHeadersVariables } from '@hono/hono/secure-headers';
import type { Page } from '../types.ts';

const app = new Hono<{ Variables: SecureHeadersVariables }>();
const JOBS = new Map<string, string>();

app.get('/', (c) => {
  const nonce = c.get('secureHeadersNonce') ?? '';
  const url = c.req.query('url') || '';
  const title = c.req.query('title') || '';

  const html = Add({ url, title, nonce });
  return c.html(html);
});

app.post('/job', async (c) => {
  const monolithOpts = [];
  const form = await c.req.formData();
  const jobId = crypto.randomUUID();
  JOBS.set(jobId, JOB_STATUS.processing);

  const url = form.get('url') as string;
  let title = form.get('title') as string;

  for (const entry of form.entries()) {
    // collect monolith opt flags
    const key = entry[0] as keyof typeof MONOLITH_OPTIONS;
    if (key in MONOLITH_OPTIONS && entry[1] === 'on') {
      // if valid option and item is checked
      const flag = MONOLITH_OPTIONS[key].flag;
      monolithOpts.push(flag);
    }
  }

  if (title.trim() === '') {
    // if user did not set title, fetch from document url
    const docTitle = await fetchDocumentTitle(url);
    title = docTitle.data;
  }

  const timestamp = Date.now();
  const filename = createFilename(timestamp, title);
  const path = join(ARCHIVE_PATH, filename);

  (async () => {
    try {
      const cmd = new Deno.Command('monolith', {
        args: [`--output=${path}`, ...monolithOpts, url],
        stderr: 'piped',
      });

      const process = cmd.spawn();
      const result = await process.output();

      if (!result.success) {
        console.error(new TextDecoder().decode(result.stderr));
        throw Error(`Job ${jobId} for ${path} failed`);
      }

      const size = await getSize(path);
      const page: Page = { filename, title, url, size };

      const insert = database.addPage(page);
      if (!insert.ok) throw insert.error;

      JOBS.set(jobId, JOB_STATUS.completed);
    } catch (e) {
      console.error(e);
      JOBS.set(jobId, JOB_STATUS.failed);
    }
  })();

  return c.json({ jobId });
});

app.get('/job/:jobId', (c) => {
  const { jobId } = c.req.param();

  const stream = new ReadableStream({
    start(ctrl) {
      const encoder = new TextEncoder();
      const interval = setInterval(() => {
        const status = JOBS.get(jobId);
        const message = encoder.encode(
          `data: ${status ?? JOB_STATUS.processing}\n\n`,
        );
        ctrl.enqueue(message);

        if (
          !status || status === JOB_STATUS.completed ||
          status === JOB_STATUS.failed
        ) {
          clearInterval(interval);
          ctrl.close();
          JOBS.delete(jobId);
          return;
        }
      }, 500);
    },
  });

  return c.newResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

export { app as add };