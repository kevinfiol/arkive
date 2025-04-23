import type { HtmlEscapedString } from '@hono/hono/utils/html';
export type Partial = string | HtmlEscapedString | Promise<HtmlEscapedString>;

export { Add } from './add.ts';
export { Delete } from './delete.ts';
export { Home } from './home.ts';
export { Initialize } from './initialize.ts';
export { Login } from './login.ts';
export { PageTile } from './partial/page-tile.ts';
