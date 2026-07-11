export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListParams extends PaginationParams, SortParams {
  keyword?: string;
}

export interface PageInfo {
  mode: 'offset' | 'cursor';
  page?: number;
  pageSize?: number;
  totalItems?: string;
  totalPages?: number;
  nextCursor?: string;
  hasMore?: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pageInfo: PageInfo;
}

export const delay = (ms: number = 300) => new Promise((resolve) => setTimeout(resolve, ms));
