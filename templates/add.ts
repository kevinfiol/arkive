import { html } from '@hono/hono/html';
import { Layout } from './layout.ts';
import { MonolithOptions } from './partial/monolith-options.ts';

export const Add = ({ error = '' } = {}) => Layout('Save New Page', html`
  <main>
    <header>
      <a href="/">← Back To Archive</a>
      <p>Enter a page URL and Title (optional) to archive it. Use the checkboxes configure the archiver.</p>
    </header>
    <section>
      <form action="/add" method="post">
        <div class="input-group">
          <input type="text" name="url" placeholder="URL" maxlength="200" required>
        </div>
        <div class="input-group">
          <input type="text" name="title" placeholder="Title (Optional)" maxlength="100">
        </div>
        ${MonolithOptions()}
        ${error !== '' && html`
          <figure class="error">
            ${error}
          </figure>
        `}
        <button type="submit">Save New Page</button>
      </form>
    </section>
  </main>
  <script defer src="/static/add.js"></script>
`);