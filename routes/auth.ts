import { Hono } from '@hono/hono';
import { hash, verify } from '@denorg/scrypt';
import * as database from '../db.ts';

const app = new Hono();

app.post('/init', async (c) => {
  const form = await c.req.formData();

  const password = form.get('password') as string;
  const confirm = form.get('confirm') as string;

  if (password !== confirm) {
    return c.redirect('/?init=confirm_error', 302);
  }

  const hashed = hash(password);
  const { error } = database.createUser(hashed);

  if (error) {
    console.error(error);
    return c.redirect('/?init=init_error', 302);
  }

  // store token in memory
  const sessionToken = crypto.randomUUID();
  SESSION.set(sessionToken, true);

  // set cookie
  await setSignedCookie(c, ACCESS_TOKEN_NAME, sessionToken, SESSION_SECRET, {
    secure: true,
    httpOnly: true,
    sameSite: 'Strict',
    expires: new Date(Date.now() + SESSION_MAX_AGE),
  });

  // set init flag
  database.initialize();

  // set cookie with session token
  return c.redirect('/');
});

app.get('/logout', async (c) => {
  const token = await getSignedCookie(c, SESSION_SECRET, ACCESS_TOKEN_NAME);

  if (token) {
    deleteCookie(c, ACCESS_TOKEN_NAME);
    SESSION.delete(token);
  }

  return c.redirect('/login');
});

app.get('/login', async (c) => {
  const token = await getSignedCookie(c, SESSION_SECRET, ACCESS_TOKEN_NAME);
  const isValidToken = token && SESSION.get(token) && v4.validate(token);
  if (isValidToken) return c.redirect('/');

  const { data: isInit } = database.checkInitialized();
  if (!isInit) return c.redirect('/');

  const html = Login();
  return c.html(html);
});

app.post('/login', async (c) => {
  const form = await c.req.formData();

  const password = form.get('password') as string;
  const { data: hashed } = database.getHashedPassword();
  const isValid = verify(password, hashed);

  if (!isValid) {
    const html = Login({ error: 'Invalid password' });
    c.status(500);
    return c.html(html);
  }

  // store token in memory
  const sessionToken = crypto.randomUUID();
  SESSION.set(sessionToken, true);

  // set cookie
  await setSignedCookie(c, ACCESS_TOKEN_NAME, sessionToken, SESSION_SECRET, {
    secure: true,
    httpOnly: true,
    sameSite: 'Strict',
    expires: new Date(Date.now() + SESSION_MAX_AGE),
  });

  return c.redirect('/');
});