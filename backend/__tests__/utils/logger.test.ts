import { logger } from '../../utils/logger';

describe('logger', () => {
  let consoleSpy: Record<string, jest.SpyInstance>;

  beforeEach(() => {
    consoleSpy = {
      log: jest.spyOn(console, 'log').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      debug: jest.spyOn(console, 'debug').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.DEBUG;
  });

  it('info should call console.log with [INFO] prefix', () => {
    logger.info('test message');
    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[INFO] test message',
      '',
    );
  });

  it('info should stringify context', () => {
    logger.info('msg', { key: 'val' });
    expect(consoleSpy.log).toHaveBeenCalledWith(
      '[INFO] msg',
      JSON.stringify({ key: 'val' }),
    );
  });

  it('warn should call console.warn', () => {
    logger.warn('warning');
    expect(consoleSpy.warn).toHaveBeenCalledWith('[WARN] warning', '');
  });

  it('error should call console.error', () => {
    logger.error('failure', { code: 500 });
    expect(consoleSpy.error).toHaveBeenCalledWith(
      '[ERROR] failure',
      JSON.stringify({ code: 500 }),
    );
  });

  it('debug should NOT log when DEBUG is not set', () => {
    delete process.env.DEBUG;
    logger.debug('hidden');
    expect(consoleSpy.debug).not.toHaveBeenCalled();
  });

  it('debug should log when DEBUG env var is set', () => {
    process.env.DEBUG = 'true';
    logger.debug('visible');
    expect(consoleSpy.debug).toHaveBeenCalledWith(
      '[DEBUG] visible',
      '',
    );
  });
});
