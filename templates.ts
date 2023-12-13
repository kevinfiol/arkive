import type { ArchivePage } from './types.ts';
import { MONOLITH_OPTIONS } from './main.ts';

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
    <link rel="stylesheet" href="/main.css">
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

export const Home = ({ pages, size, count }: { pages: Array<ArchivePage>, size: string, count: number }) => Layout('Archive', `
  <main>
    <header>
      <div class="header-info">
        <span>Disk Usage: ${size}</span>
        <span>${count} page${count === 1 ? '' : 's'} saved</span>
      </div>
    </header>
    <section class="controls">
      <a href="/add">Save New Page</a>
      <div class="input-group">
        <input type="text" placeholder="Type to Search..." id="search-bar" />
      </div>
    </section>
    <section class="articles">
      ${_forEach<ArchivePage>(pages, (page) => `
        <article class="article">
          <header>
            <a href="/archive/${page.filename}">${page.title}</a>
          </header>
          <div class="info">
            <small><a href="${page.url}">${page.url}</a></small>
          </div>
          <div class="info">
            <small>${page.size}</small>
            <small>
              <a href="/delete/${page.id}">
                delete
              </a>
            </small>
          </div>
        </article>
      `)}
    </section>
  </main>
  <script defer src="home.js"></script>
`);

export const Add = ({ error = '' } = {}) => Layout('Save New Page', `
  <main>
    <a href="/">← Back To Archive</a>
    <p>Enter a page URL and Title (optional) to archive it. Use the checkboxes configure the archiver.</p>
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
  </main>
  <script defer src="./add.js"></script>
`);

export const Delete = ({ id, title }: { id: string, title: string }) => Layout('Delete Page', `
  <main>
    <a href="/">← Back To Archive</a>
    <p>
      <em>Are you sure you want to delete <strong>${title}</strong>?</em>
    </p>
    <form action="/delete/${id}" method="post">
      <div class="input-group">
        <button type="submit">
          Delete
        </button>
      </div>
    </form>
  </main>
`);