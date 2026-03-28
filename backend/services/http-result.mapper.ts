import type { ServiceResult } from './service-result';

export function mapServiceResultToHttp<T>(result: ServiceResult<T>): { statusCode: number; body: any } {
  if (result.type === 'success') {
    return {
      statusCode: result.statusCode || 200,
      body: result.payload,
    };
  }

  return {
    statusCode: result.statusCode,
    body: { error: result.message },
  };
}
