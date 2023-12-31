export interface Page {
  title: string;
  url: string;
  filename: string;
  size: string;
}

export interface PageCache {
  pages: Page[];
  size: string;
}