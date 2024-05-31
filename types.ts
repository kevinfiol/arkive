export interface Page {
  title: string;
  url: string;
  filename: string;
  size: number;
}

export interface PageCache {
  pages: Page[];
  size: string;
}
