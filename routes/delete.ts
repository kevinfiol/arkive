import { Hono } from '@hono/hono';
import { join } from '@std/path';
import { Delete } from '../templates/index.ts';
import * as database from '../db.ts';
import { ARCHIVE_PATH } from '../constants.ts';

const app = new Hono();

app.get('/:filename', (c) => {
  const filename = c.req.param('filename');
  const { data: page, error } = database.getPage(filename);

  if (!page || error) {
    c.status(404);
    return c.text('404');
  } else {
    const { title } = page;
    const html = Delete({ filename, title });
    return c.html(html);
  }
});

app.post('/:filename', async (c) => {
  const filename = c.req.param('filename');
  const page = database.getPage(filename);

  try {
    if (!page.data || page.error) {
      throw Error('Page with that ID does not exist');
    }

    const deletion = database.deletePage(page.data.filename);
    if (!deletion.ok) throw deletion.error;

    await Deno.remove(join(ARCHIVE_PATH, page.data.filename));
    return c.redirect('/');
  } catch (e) {
    console.error(e);
    c.status(500);
    return c.text('500');
  }
});

export { app as delete_ };