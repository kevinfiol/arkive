import { html } from '@hono/hono/html';
import { YT_DLP_OPTIONS } from '../../constants.ts';

export const YtDlpOptions = () => html`
  <ul>
    ${Object.entries(YT_DLP_OPTIONS).map(([name, opt]) => html`
      <li>
        <label for="${name}">
          <span>${opt.label}</span>
          <input
            type="checkbox"
            name="${name}"
            id="${name}"
          />
        </label>
      </li>
    `)}

    <li>
      <label>
        Max Resolution
        <select name="maxres">
          <option value="360">360p</option>
          <option value="480">480p</option>
          <option value="720">720p</option>
          <option value="1080">1080p</option>
          <option value="1440">1440p</option>
        </select>
      </label>
    </li>
  </ul>
`;
