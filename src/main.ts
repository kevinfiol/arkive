import { Hono } from '@hono/hono';
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
import { Add, Delete, Home, Login, PageTile } from './templates/index.ts';
import {
  ACCESS_TOKEN_NAME,
  ARCHIVE_PATH,
  CONTENT_SECURITY_POLICY,
  JOB_STATUS,
  JOB_TIME_LIMIT,
  MIMES,
  MONOLITH_OPTIONS,
  SESSION_MAX_AGE,
  ZERO_BYTES,
} from './constants.ts';
import * as DB from './sqlite/arkive.ts';
import * as SESSION from './sqlite/session.ts';
import {
  createEmptyPage,
  createFilename,
  createQueue,
  fetchDocumentTitle,
  getSize,
  parseDirectory,
} from './util.ts';
import { auth } from './middleware.ts';
import { deadline } from '@std/async';

import type { Page } from './types.ts';

// load .env file
loadSync({ export: true });

const SERVER_PORT = Number(Deno.env.get('SERVER_PORT')) || 8080;
const SESSION_SECRET = Deno.env.get('SESSION_SECRET') || 'hunter2';

// ensure archive path exists
if (!existsSync(ARCHIVE_PATH)) {
  Deno.mkdirSync(ARCHIVE_PATH, { recursive: true });
}

const JOBS = new Map<string, string>();
const JOB_QUEUE = createQueue(2);
const app = new Hono<{ Variables: SecureHeadersVariables }>();

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
        page = createEmptyPage(file.name, file.size);
        const { error } = DB.addPage(page);
        if (error) console.error(error);
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
    count: pages.length,
    nonce,
  });

  return c.html(html);
});

app.get('/add', (c) => {
  const nonce = c.get('secureHeadersNonce') ?? '';
  const url = c.req.query('url') || '';
  const title = c.req.query('title') || '';

  const html = Add({ url, title, nonce });
  return c.html(html);
});

app.post('/add-job', async (c) => {
  const monolithOpts: string[] = [];
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

  JOB_QUEUE.add(async () => {
    let process: Deno.ChildProcess | null = null;

    try {
      const cmd = new Deno.Command('monolith', {
        args: [`--output=${path}`, ...monolithOpts, url],
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
      const page: Page = { filename, title, url, size };

      const insert = DB.addPage(page);
      if (!insert.ok) throw insert.error;

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
  });

  return c.json({ jobId });
});

app.get('/add-event/:jobId', (c) => {
  const { jobId } = c.req.param();

  // TODO: job shouldn't fail or end if user navigates away from page
  const stream = new ReadableStream({
    start(ctrl) {
      const encoder = new TextEncoder();
      const interval = setInterval(() => {
        const status = JOBS.get(jobId);
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
  const url = form.get('url') as string;
  const title = form.get('title') as string;
  const filename = form.get('filename') as string;

  try {
    DB.editPage(filename, title, url);
    c.status(200);
    return c.text('200');
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.text('500');
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
    const { data: results, error } = DB.searchPages(query);
    console.log({ results });
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

Deno.serve({ port: SERVER_PORT }, app.fetch);
