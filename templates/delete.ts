import { html } from '@hono/hono/html';
import { Layout } from './layout.ts';

export const Delete = ({ filename, title }: { filename: string, title: string }) => Layout('Delete Page', html`
  <main>
    <header>
      <a href="/">← Back To Archive</a>
      <p>
        <em>Are you sure you want to delete <strong>${title}</strong>?</em>
      </p>
    </header>
    <section>
      <form action="/delete/${filename}" method="post">
        <div class="input-group">
          <button type="submit">
            Delete
          </button>
        </div>
      </form>
    </section>
  </main>
`);