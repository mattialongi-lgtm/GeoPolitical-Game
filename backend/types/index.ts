/**
 * Consolidated backend type definitions.
 *
 * Re-exports the route-level types already defined in
 * `backend/routes/types.ts` and adds API-level response shapes.
 */

export type { AuthenticatedRequest, RouteHandler, RouteDeps } from '../routes/types';

/**
 * Standard API error response shape returned by the
 * `errorHandler` middleware.
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
    path: string;
    context?: Record<string, unknown>;
  };
}

/**
 * Generic paginated list wrapper used by several GET endpoints.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}
