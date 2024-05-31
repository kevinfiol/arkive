import type { Page } from './types.ts';
import { MONOLITH_OPTIONS } from './constants.ts';
import { escapeHtml, formatBytes } from './util.ts';

function _if(condition: unknown, template: string) {
  return condition ? template : '';
}

function _forEach<T>(arr: T[], fn: (x: T) => string) {
  return arr.reduce((a: string, c: T) =>
    a += (fn(c) || ''),
    ''
  );
}

const Layout = (title: string, content: string) => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <meta name="description" content="personal article archive" >
    <link rel="stylesheet" href="/static/main.css">
    <title>
      ${title || 'Archive'}
    </title>
  </head>
  <body>
    ${content}
  </body>
  </html>
`;

const MonolithOptions = () => `
  <ul>
    ${_forEach(Object.entries(MONOLITH_OPTIONS), ([name, opt]) => `
      <li>
        <label for="${name}">
          <span>${opt.label}</span>
          <input
            type="checkbox"
            name="${name}"
            id="${name}"
          >
        </label>
      </li>
    `)}
  </ul>
`;

export const Home = ({ pages, size, count }: { pages: Array<Page>, size: number, count: number }) => Layout('Archive', `
  <main>
    <header>
      <div class="header-info">
        <span>Disk Usage: ${formatBytes(size)}</span>
        <span>Showing ${count < 50 ? count : '50'} of ${count} saved pages</span>
      </div>
    </header>
    <section class="controls">
      <a href="/add">Save New Page</a>
      <a href="/logout">Logout</a>
      <div class="input-group">
        <input type="text" placeholder="Type to Search..." id="search-bar" />
      </div>
    </section>
    <section class="articles">
      <dialog id="edit-dialog">
        <div>
          <form id="edit-form" method="dialog">
            <input type="text" placeholder="Title" name="title" required />
            <input type="text" placeholder="URL" name="url" required />
            <div class="input-group">
              <button id="submit-dialog">Save</button>
              <button id="close-dialog">Cancel</button>
            </div>
            <figure class="error -hidden" id="edit-error">
            </figure>
          </form>
        </div>
      </dialog>

      ${_forEach<Page>(pages, (page) => {
        const url = escapeHtml(page.url);
        const title = escapeHtml(page.title);

        return `
          <article class="article">
            <header>
              <a href="/archive/${page.filename}" class="title">${title}</a>
            </header>
            <div class="info">
              <small><a href="${url}" class="url">${url}</a></small>
            </div>
            <div class="info">
              <small>${formatBytes(page.size)}</small>
              <small>
                <a
                  data-filename="${page.filename}"
                  data-title="${title}"
                  data-url="${url}"
                  class="link-btn edit-button"
                  role="button"
                  onclick="window.openEditDialog(this)"
                >
                  edit
                </a>
              </small>
              <small>
                <a href="/delete/${page.filename}">
                  delete
                </a>
              </small>
            </div>
          </article>
        `;
      })}
    </section>
  </main>
  <script defer src="/static/home.js"></script>
`);

export const Add = ({ error = '' } = {}) => Layout('Save New Page', `
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
        ${_if(error !== '', `
          <figure class="error">
            ${error}
          </figure>
        `)}
        <button type="submit">Save New Page</button>
      </form>
    </section>
  </main>
  <script defer src="/static/add.js"></script>
`);

export const Delete = ({ filename, title }: { filename: string, title: string }) => Layout('Delete Page', `
  <main>
    <header>
      <a href="/">← Back To Archive</a>
      <p>
        <em>Are you sure you want to delete <strong>${escapeHtml(title)}</strong>?</em>
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

export const Initialize = ({ error = '' } = {}) => Layout('Initialize', `
  <main>
    <header>
      <h1>Initialize</h1>
    </header>
    <section>
      <p>Enter the password you will use to access your bookmarks.</p>
      <form action="/init" method="post">
        <div class="input-group">
          <input type="password" name="password" id="password" placeholder="Password" minlength="7" required>
        </div>
        <div class="input-group">
          <input type="password" name="confirm" id="confirm-password" placeholder="Confirm Password" minlength="7" required>
        </div>

        ${_if(error !== '', `
          <figure class="error">
            ${error}
          </figure>
        `)}

        <div class="input-group">
          <button type="submit">
            Submit
          </button>
        </div>
      </form>
    </section>
  </main>
`)

export const Login = ({ error = '' } = {}) => Layout('Login', `
  <main>
    <header>
      <h1>Login</h1>
    </header>
    <section>
      <form action="/login" method="post">
        <div class="input-group">
          <input type="password" name="password" id="password" placeholder="Password" required>
        </div>

        ${_if(error !== '', `
          <figure class="error">
            ${error}
          </figure>
        `)}

        <div class="input-group">
          <button type="submit">
            Submit
          </button>
        </div>
      </form>
    </section>
  </main>
`);