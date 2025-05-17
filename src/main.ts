import { Hono } from '@hono/hono';
import { logger } from '@hono/hono/logger';
import {
  deleteCookie,
  getSignedCookie,
  setSignedCookie,
} from '@hono/hono/cookie';
import { serveStatic } from '@hono/hono/deno';
import {
  secureHeaders,
  type SecureHeadersVariables,
} from '@hono/hono/secure-headers';
import { loadSync } from '@std/dotenv';
import { join } from '@std/path';
import { existsSync } from '@std/fs';
import { hash, verify } from '@denorg/scrypt';
import {
  Add,
  Delete,
  Home,
  Jobs,
  Login,
  Media,
  PageTile,
} from './templates/index.ts';
import {
  ACCESS_TOKEN_NAME,
  ARCHIVE_PATH,
  CLI,
  CONTENT_SECURITY_POLICY,
  JOB_STATUS,
  MIMES,
  MONOLITH_OPTIONS,
  SESSION_MAX_AGE,
  YT_DLP_OPTIONS,
  ZERO_BYTES,
} from './constants.ts';
import * as DB from './sqlite/arkive.ts';
import * as SESSION from './sqlite/session.ts';
import {
  createEmptyPage,
  createQueue,
  fetchDocumentTitle,
  isValidHttpUrl,
  isYouTubeUrl,
  parseDirectory,
  parseTagCSV,
} from './util.ts';
import { auth } from './middleware.ts';
import { monolithJob, parseOpts, ytdlpJob } from './cli-jobs.ts';

import type { Job, Page } from './types.ts';

// load .env file
loadSync({ export: true });

const SERVER_PORT = Number(Deno.env.get('SERVER_PORT')) || 8080;
const SESSION_SECRET = Deno.env.get('SESSION_SECRET') || 'hunter2';

// ensure archive path exists
if (!existsSync(ARCHIVE_PATH)) {
  Deno.mkdirSync(ARCHIVE_PATH, { recursive: true });
}

const JOBS = new Map<string, Job>();
const FAILED_JOBS = new Map<string, Job>();
const JOB_QUEUE = createQueue(2);
const app = new Hono<{ Variables: SecureHeadersVariables }>();

app.use(logger());
app.use(
  secureHeaders({
    contentSecurityPolicy: CONTENT_SECURITY_POLICY,
  }),
);

app.use('/static/*', serveStatic({ root: './src/', mimes: MIMES }));
app.use('/archive/*', serveStatic({ root: './data/', mimes: MIMES }));

app.on(
  ['GET', 'POST'],
  ['/', '/add', '/delete/*', '/api/*'],
  auth(SESSION_SECRET),
);

app.post('/init', async (c) => {
  const form = await c.req.formData();

  const password = form.get('password') as string;
  const confirm = form.get('confirm') as string;

  if (password !== confirm) {
    return c.redirect('/?init=confirm_error', 302);
  }

  const hashed = hash(password);
  const { error } = DB.createUser(hashed);

  if (error) {
    console.error(error);
    return c.redirect('/?init=init_error', 302);
  }

  const sessionToken = crypto.randomUUID();
  SESSION.setSession(sessionToken);

  // set cookie
  await setSignedCookie(c, ACCESS_TOKEN_NAME, sessionToken, SESSION_SECRET, {
    secure: true,
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: SESSION_MAX_AGE * 2,
  });

  // set init flag
  DB.initialize();

  // set cookie with session token
  return c.redirect('/');
});

app.get('/', async (c) => {
  const nonce = c.get('secureHeadersNonce') ?? '';
  const info = await Deno.stat(ARCHIVE_PATH);
  const date = info.mtime ?? new Date();
  const modifiedTime = date.toISOString();
  const { data: hasChanged } = DB.checkModified(modifiedTime);

  let pages: Page[] = [];
  let size = ZERO_BYTES;

  if (hasChanged) {
    const directory = await parseDirectory(ARCHIVE_PATH);
    const filenames = directory.files.map((file) => file.name);
    const { data: pagesData } = DB.getPagesData(filenames);

    for (const file of directory.files) {
      let page;

      if (file.name in pagesData) {
        page = pagesData[file.name];
      } else {
        const partial = createEmptyPage(file.name, file.size);
        const { data: pageId, error } = DB.addPage(partial);
        if (error) console.error(error);
        page = { ...partial, id: pageId } as Page;
      }

      pages.push(page);
    }

    // remove files from db that no longer exist
    const { ok } = DB.deleteRemovedPages(filenames);
    if (!ok) {
      console.error('Warning: Failed to delete removed pages from database');
    }

    size = directory.size;
    DB.setCache({ pages, size });
  } else {
    const { data: cache } = DB.getCache();
    pages = cache.pages;
    size = cache.size;
  }

  const html = Home({
    size,
    pages,
    jobCount: JOBS.size,
    count: pages.length,
    nonce,
  });

  return c.html(html);
});

app.get('/add', (c) => {
  const nonce = c.get('secureHeadersNonce') ?? '';
  const url = c.req.query('url') || '';
  const title = c.req.query('title') || '';
  const mode = c.req.query('mode') || CLI.MONOLITH;

  const html = Add({ url, title, mode, nonce });
  return c.html(html);
});

app.get('/media/:filename', (c) => {
  const nonce = c.get('secureHeadersNonce') ?? '';
  const filename = c.req.param('filename');
  const { data: page, error } = DB.getPage(filename);

  if (!page || error) {
    c.status(404);
    return c.text('404');
  } else {
    const { title, url, tags } = page;
    const html = Media({ filename, url, title, nonce, tags });
    return c.html(html);
  }
});

app.post('/add', async (c) => {
  const form = await c.req.formData();
  const jobId = (form.get('failed-id') as string) || crypto.randomUUID();

  let job: Job;

  if (FAILED_JOBS.has(jobId)) {
    job = FAILED_JOBS.get(jobId) as Job;
    FAILED_JOBS.delete(jobId);
  } else {
    let title = form.get('title') as string;
    const tagCSV = form.get('tags') as string;
    const url = form.get('url') as string;
    const mode = (form.get('mode') as string) || CLI.MONOLITH;
    const maxres = (form.get('maxres') as string) || '720';

    const tags = parseTagCSV(tagCSV);
    const formIter = form.entries();
    const opts = mode === CLI.YT_DLP
      ? parseOpts(formIter, YT_DLP_OPTIONS)
      : parseOpts(formIter, MONOLITH_OPTIONS);

    const doc = await fetchDocumentTitle(url);
    if (!doc.error && !title.trim()) title = doc.data;

    job = {
      id: jobId,
      status: JOB_STATUS.pending,
      url,
      title,
      mode,
      opts,
      tags,
      maxres,
    };
  }

  let jobCmd = undefined;

  if (job.mode === CLI.YT_DLP) {
    jobCmd = ytdlpJob(job.opts, {
      title: job.title,
      url: job.url,
      tags: job.tags,
      maxres: job.maxres ?? '720',
    });
  } else {
    jobCmd = monolithJob(job.opts, {
      title: job.title,
      url: job.url,
      tags: job.tags,
    });
  }

  JOBS.set(jobId, job);

  JOB_QUEUE.add(async () => {
    try {
      job.status = JOB_STATUS.processing;
      await jobCmd;
      job.status = JOB_STATUS.completed;
    } catch {
      job.status = JOB_STATUS.failed;
      FAILED_JOBS.set(jobId, job);
    } finally {
      setTimeout(() => {
        JOBS.delete(jobId);
      }, 4000);

      JOB_QUEUE.done();
    }
  });

  return c.json({ jobId });
});

app.get('/jobs', (c) => {
  const nonce = c.get('secureHeadersNonce') ?? '';
  const html = Jobs({ nonce });
  return c.html(html);
});

app.get('/add-event/:jobId', (c) => {
  const { jobId } = c.req.param();

  const stream = new ReadableStream({
    start(ctrl) {
      const encoder = new TextEncoder();
      const interval = setInterval(() => {
        const { status } = JOBS.get(jobId) as Job;
        const message = encoder.encode(
          `data: ${status ?? JOB_STATUS.processing}\n\n`,
        );

        try {
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
        } catch {
          clearInterval(interval);
          console.log(
            `Client has disconnected for ${jobId}. Job continues to run in queue.`,
          );
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

app.get('/job-event', (c) => {
  const stream = new ReadableStream({
    start(ctrl) {
      const encoder = new TextEncoder();
      const interval = setInterval(() => {
        const message = encoder.encode(
          `data: ${JOBS.size}\n\n`,
        );

        try {
          ctrl.enqueue(message);
        } catch {
          clearInterval(interval);
        }
      }, 1000);
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

app.get('/job-status-event', (c) => {
  const stream = new ReadableStream({
    start(ctrl) {
      const jobs: Job[] = [];

      for (const job of JOBS.values()) {
        console.log('job in JOBS', job);
        jobs.push(job);
      }

      for (const job of FAILED_JOBS.values()) {
        console.log('job in FAILED_JOBS', job);
        jobs.push(job);
      }

      const encoder = new TextEncoder();
      const interval = setInterval(() => {
        const message = encoder.encode(
          `data: ${JSON.stringify(jobs)}\n\n`,
        );

        try {
          ctrl.enqueue(message);
        } catch {
          clearInterval(interval);
        }
      }, 1000);
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

app.get('/delete/:filename', (c) => {
  const filename = c.req.param('filename');
  const { data: page, error } = DB.getPage(filename);

  if (!page || error) {
    c.status(404);
    return c.text('404');
  } else {
    const { title } = page;
    const html = Delete({ filename, title });
    return c.html(html);
  }
});

app.post('/delete/:filename', async (c) => {
  const filename = c.req.param('filename');
  const page = DB.getPage(filename);

  try {
    if (!page.data || page.error) {
      throw Error('Page with that ID does not exist');
    }

    const deletion = DB.deletePage(page.data.filename);
    if (!deletion.ok) throw deletion.error;

    await Deno.remove(join(ARCHIVE_PATH, page.data.filename));
    return c.redirect('/');
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.text('500');
  }
});

app.post('/edit', async (c) => {
  const form = await c.req.formData();
  const pageIdStr = form.get('pageId') as string;
  const url = form.get('url') as string;
  const title = form.get('title') as string;
  const tagsCSV = form.get('tags') as string;
  const filename = form.get('filename') as string;

  const pageId = Number(pageIdStr);
  const tags = parseTagCSV(tagsCSV);

  try {
    DB.editPage(pageId, filename, title, url, tags);
    c.status(200);
    return c.json({
      pageId,
      filename,
      title,
      url,
      tags,
    });
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.json({});
  }
});

app.get('/logout', async (c) => {
  const token = await getSignedCookie(c, SESSION_SECRET, ACCESS_TOKEN_NAME);

  if (token) {
    deleteCookie(c, ACCESS_TOKEN_NAME);
    SESSION.deleteSession(token);
  }

  return c.redirect('/login');
});

app.get('/login', async (c) => {
  const token = await getSignedCookie(c, SESSION_SECRET, ACCESS_TOKEN_NAME);
  const { data: isValidToken } = SESSION.validateSession(token);
  if (isValidToken) return c.redirect('/');

  const { data: isInit } = DB.checkInitialized();
  if (!isInit) return c.redirect('/');

  const html = Login();
  return c.html(html);
});

app.post('/login', async (c) => {
  const form = await c.req.formData();

  const password = form.get('password') as string;
  const { data: hashed } = DB.getHashedPassword();
  const isValid = verify(password, hashed);

  if (!isValid) {
    const html = Login({ error: 'Invalid password' });
    c.status(500);
    return c.html(html);
  }

  const sessionToken = crypto.randomUUID();
  SESSION.setSession(sessionToken);

  // set cookie
  await setSignedCookie(c, ACCESS_TOKEN_NAME, sessionToken, SESSION_SECRET, {
    secure: true,
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: SESSION_MAX_AGE * 2,
  });

  return c.redirect('/');
});

app.get('/api/search', (c) => {
  const query = c.req.query('query') ?? '';
  let html = '';

  if (!query.trim().length) {
    const { data, error } = DB.getCache();
    if (!error) {
      const pages = data.pages;
      const pageTiles = pages.map((page) => PageTile(page));
      html += pageTiles.join('');
    } else {
      console.error('Failed to retrieve cache during blank search');
    }
  } else {
    let searchQuery = '';
    const tagQueries = [];
    const tokens = query
      .split(' ')
      .filter((x) => x !== '');

    for (const token of tokens) {
      if (token[0] === '#' && token[1] !== undefined) {
        tagQueries.push(token.slice(1));
      } else if (token[0] !== '#') {
        searchQuery += (searchQuery ? ' ' : '') + token;
      }
    }

    const { data: results, error } = DB.searchPages(searchQuery, tagQueries);
    if (results.length > 0 && !error) {
      const filenames = results.map((result) => result.filename);
      const { data: pagesData } = DB.getPagesData(filenames);

      for (const filename of filenames) {
        const page = pagesData[filename];
        html += PageTile(page);
      }
    }
  }

  return c.text(html);
});

app.delete('/job', (c) => {
  const jobId = c.req.query('id') ?? '';
  JOBS.delete(jobId);
  FAILED_JOBS.delete(jobId);
  return c.text('OK');
});

app.post('/bookmarks', async (c) => {
  const body = await c.req.parseBody();
  const file = body['file'];

  if (
    !(file instanceof File) ||
    !(file.type === 'text/plain')
  ) {
    c.status(500);
    return c.text('error');
  }

  try {
    const content = await file.text();
    const lines = content.split('\n');

    // limit to 1000 links
    let cur = 0;
    const max = 500;
    for (let line of lines) {
      if (cur >= max) break;

      line = line.replace(/\s/g, '');
      if (!isValidHttpUrl(line)) continue;
      cur += 1;

      const mode = isYouTubeUrl(line) ? CLI.YT_DLP : CLI.MONOLITH;

      const job: Job = {
        id: crypto.randomUUID(),
        status: JOB_STATUS.pending,
        url: line,
        title: line,
        mode,
        opts: [],
        tags: [],
      };

      JOBS.set(job.id, job);

      JOB_QUEUE.add(async () => {
        const doc = await fetchDocumentTitle(job.url);
        if (!doc.error) job.title = doc.data;

        let jobCmd = undefined;
        if (job.mode === CLI.YT_DLP) {
          jobCmd = ytdlpJob(job.opts, {
            title: job.title,
            url: job.url,
            tags: job.tags,
            maxres: job.maxres ?? '720',
          });
        } else {
          jobCmd = monolithJob(job.opts, {
            title: job.title,
            url: job.url,
            tags: job.tags,
          });
        }

        try {
          job.status = JOB_STATUS.processing;
          await jobCmd;
          job.status = JOB_STATUS.completed;
        } catch {
          job.status = JOB_STATUS.failed;
          FAILED_JOBS.set(job.id, job);
        } finally {
          setTimeout(() => {
            JOBS.delete(job.id);
          }, 4000);

          JOB_QUEUE.done();
        }
      });
    }
  } catch (e) {
    console.error('Error parsing file', e);
  }

  return c.text('OK');
});

Deno.serve({ port: SERVER_PORT }, app.fetch);
