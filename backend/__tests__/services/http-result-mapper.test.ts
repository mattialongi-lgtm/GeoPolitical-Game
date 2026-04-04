import { mapServiceResultToHttp } from '../../services/http-result.mapper';
import {
  serviceSuccess,
  validationError,
  forbiddenError,
  notFoundError,
  conflictError,
  systemError,
} from '../../services/service-result';

describe('mapServiceResultToHttp', () => {
  describe('success results', () => {
    it('should map success to 200 with payload as body', () => {
      const result = serviceSuccess({ id: '1', name: 'test' });
      const http = mapServiceResultToHttp(result);
      expect(http.statusCode).toBe(200);
      expect(http.body).toEqual({ id: '1', name: 'test' });
    });

    it('should respect custom statusCode on success', () => {
      const result = serviceSuccess({ id: '2' }, 201);
      const http = mapServiceResultToHttp(result);
      expect(http.statusCode).toBe(201);
    });

    it('should handle null payload', () => {
      const result = serviceSuccess(null);
      const http = mapServiceResultToHttp(result);
      expect(http.statusCode).toBe(200);
      expect(http.body).toBeNull();
    });

    it('should handle array payload', () => {
      const result = serviceSuccess([1, 2, 3]);
      const http = mapServiceResultToHttp(result);
      expect(http.body).toEqual([1, 2, 3]);
    });
  });

  describe('system_error results', () => {
    it('should return generic Italian message for system errors', () => {
      const result = systemError('db connection failed');
      const http = mapServiceResultToHttp(result);
      expect(http.statusCode).toBe(500);
      expect(http.body).toEqual({
        error: 'Si è verificato un errore interno. Riprova più tardi.',
      });
    });

    it('should NOT expose internal error messages', () => {
      const result = systemError('SQL injection detected at line 42');
      const http = mapServiceResultToHttp(result);
      expect(http.body.error).not.toContain('SQL');
    });
  });

  describe('client error results', () => {
    it('should map validation_error to 400 with message', () => {
      const result = validationError('campo obbligatorio');
      const http = mapServiceResultToHttp(result);
      expect(http.statusCode).toBe(400);
      expect(http.body).toEqual({ error: 'campo obbligatorio' });
    });

    it('should map forbidden to 403', () => {
      const result = forbiddenError('accesso negato');
      const http = mapServiceResultToHttp(result);
      expect(http.statusCode).toBe(403);
      expect(http.body).toEqual({ error: 'accesso negato' });
    });

    it('should map not_found to 404', () => {
      const result = notFoundError('risorsa non trovata');
      const http = mapServiceResultToHttp(result);
      expect(http.statusCode).toBe(404);
    });

    it('should map conflict to 409', () => {
      const result = conflictError('duplicato');
      const http = mapServiceResultToHttp(result);
      expect(http.statusCode).toBe(409);
    });
  });
});
