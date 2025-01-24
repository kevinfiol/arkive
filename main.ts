import { Hono } from '@hono/hono';
import {
  deleteCookie,
  getSignedCookie,
} from '@hono/hono/cookie';
import { serveStatic } from '@hono/hono/deno';
import {
  secureHeaders,
  type SecureHeadersVariables,
} from '@hono/hono/secure-headers';
import { loadSync } from '@std/dotenv';
import { existsSync } from '@std/fs';
import { v4 } from '@std/uuid';
import {
  Initialize,
} from './templates/index.ts';
import {
  ACCESS_TOKEN_NAME,
  // CONTENT_SECURITY_POLICY,
  MIMES,
  ARCHIVE_PATH
} from './constants.ts';
import * as database from './db.ts';
import { session, SESSION_SECRET } from './session.ts';

// TODO: i think everything should live in a src dir now; put a `main.ts` or `run.ts` at the root that loads the env first, before doing anything
// load .env file
loadSync({ export: true });

const SERVER_PORT = Number(Deno.env.get('SERVER_PORT')) ?? 8080;

// ensure archive path exists
if (!existsSync(ARCHIVE_PATH)) Deno.mkdirSync(ARCHIVE_PATH);

const app = new Hono<{ Variables: SecureHeadersVariables }>();

app.use(
  secureHeaders({
    // contentSecurityPolicy: CONTENT_SECURITY_POLICY,
  }),
);

app.use('/static/*', serveStatic({ root: './', mimes: MIMES }));

app.on(
  ['GET', 'POST'],
  ['/', '/add', '/delete/*', '/api/*'],
  async (c, next) => {
    const token = await getSignedCookie(c, SESSION_SECRET, ACCESS_TOKEN_NAME);
    const isValidToken = token && session.get(token) && v4.validate(token);

    if (isValidToken) {
      return next();
    } else if (token) {
      session.delete(token);
    }

    deleteCookie(c, ACCESS_TOKEN_NAME);

    if (c.req.method === 'GET') {
      const { data: isInit } = database.checkInitialized();
      if (isInit) return c.redirect('/login');

      const query = c.req.query('init');
      const error = query === 'confirm_error'
        ? 'Passwords do not match.'
        : query === 'init_error'
        ? 'Could not initialize user. Check system logs.'
        : '';

      const html = Initialize({ error });
      return c.html(html);
    }

    c.status(401);
    return c.text('Unauthorized');
  },
);

Deno.serve({ port: SERVER_PORT }, app.fetch);
