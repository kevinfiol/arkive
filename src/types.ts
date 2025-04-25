export type Page = {
  id: number;
  title: string;
  url: string;
  filename: string;
  size: number;
  tags: string[];
};

export type PageRow = Omit<Page, 'tags'> & {
  tags: string | null
};

export type PartialPage = Omit<Page, 'id' | 'tags'> & {
  id?: number;
  tags?: string[];
};

// type Example = PartialProps<Foo, 'baz' | 'buz'>;
// type PartialProps<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type PageCache = {
  pages: Page[];
  size: number;
};

export interface Session {
  token: string;
  expires_at: number;
  now: number;
}
