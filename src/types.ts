export type Page = {
  title: string;
  url: string;
  filename: string;
  size: number;
};

export type PageCache = {
  pages: Page[];
  size: number;
};

export interface Session {
  token: string;
  expires_at: number;
  now: number;
}
