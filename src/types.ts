import { JOB_STATUS } from './constants.ts';

export type Page = {
  id: number;
  title: string;
  url: string;
  filename: string;
  size: number;
  tags: string[];
  is_media: boolean;
};

export type PageRow = Omit<Page, 'tags'> & {
  tags: string | null;
};

export type PartialPage = Omit<Page, 'id' | 'tags'> & {
  id?: number;
  tags?: string[];
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

export interface Job {
  id: string;
  status: typeof JOB_STATUS[keyof typeof JOB_STATUS];
  url: Page['url'];
  title: Page['title'];
  mode: string;
  opts: string[];
  tags: string[];
  maxres?: string;
}
