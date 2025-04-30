import { html } from '@hono/hono/html';
import { YT_DLP_OPTIONS } from '../../constants.ts';

export const MonolithOptions = () =>
  html`
  <ul>
    ${
    Object.entries(YT_DLP_OPTIONS).map(([name, opt]) =>
      html`
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
    `
    )
  }
  </ul>
`;
