import type { ServiceResult } from './service-result';

export function mapServiceResultToHttp<T>(result: ServiceResult<T>): { statusCode: number; body: any } {
  if (result.type === 'success') {
    return {
      statusCode: result.statusCode || 200,
      body: result.payload,
    };
  }

  if (result.type === 'system_error') {
    return {
      statusCode: result.statusCode,
      body: { error: 'Si è verificato un errore interno. Riprova più tardi.' },
    };
  }

  return {
    statusCode: result.statusCode,
    body: { error: result.message },
  };
}
