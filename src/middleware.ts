import type { Context, Next, Env, Input } from '@hono/hono';
import { deleteCookie, getSignedCookie } from '@hono/hono/cookie';
import { ACCESS_TOKEN_NAME } from './constants.ts';
import { Initialize } from './templates/index.ts';
import * as SESSION from './sqlite/session.ts';
import * as DB from './sqlite/arkive.ts';

export const auth = (secret: string) => {
  return async (c: Context<Env, string, Input>, next: Next) => {
    const token = await getSignedCookie(c, secret, ACCESS_TOKEN_NAME);
    const { data: isValidToken } = SESSION.validateSession(token);

    if (isValidToken) return next();
    if (token) SESSION.deleteSession(token);

    deleteCookie(c, ACCESS_TOKEN_NAME);

    // TODO: shouldnt affect api routes
    if (c.req.method === 'GET') {
      const { data: isInit } = DB.checkInitialized();
      if (isInit) return c.redirect('/login');

      // TODO: use session
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
  };
};
