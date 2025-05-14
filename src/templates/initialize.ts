import { html } from '@hono/hono/html';
import { Layout } from './layout.ts';

export const Initialize = ({ error = '' } = {}) =>
  Layout('Initialize', html`
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

        ${error !== '' && html`
          <figure class="error">
            ${error}
          </figure>
        `}

        <div class="input-group">
          <button type="submit">
            Submit
          </button>
        </div>
      </form>
    </section>
  </main>
`);
