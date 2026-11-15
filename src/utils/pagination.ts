export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function parsePagination(
  query: Record<string, unknown>,
  allowedSortFields: string[] = ['createdAt'],
  defaultSortBy: string = 'createdAt',
  defaultSortOrder: 'asc' | 'desc' = 'desc',
): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '10'), 10) || 10));
  const skip = (page - 1) * limit;

  const rawSortBy = String(query.sortBy || defaultSortBy);
  const sortBy = allowedSortFields.includes(rawSortBy) ? rawSortBy : defaultSortBy;

  const rawSortOrder = String(query.sortOrder || defaultSortOrder).toLowerCase();
  const sortOrder = rawSortOrder === 'asc' ? 'asc' : 'desc';

  return { page, limit, skip, sortBy, sortOrder };
}

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
}
