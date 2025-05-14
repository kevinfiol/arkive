import { html } from '@hono/hono/html';
import { Layout } from './layout.ts';

export const Login = ({ error = '' } = {}) =>
  Layout('Login', html`
  <main>
    <header>
      <h1>Login</h1>
    </header>
    <section>
      <form action="/login" method="post">
        <div class="input-group">
          <input type="password" name="password" id="password" placeholder="Password" required>
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
`,
  );
