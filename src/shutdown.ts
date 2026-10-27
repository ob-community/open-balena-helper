import type { Server } from 'node:http';
import logger from './logger';

const component = 'shutdown';

export const SHUTDOWN_TIMEOUT_MS = 25_000;

interface ShutdownOptions {
  timeoutMs?: number;
  signals?: NodeJS.Signals[];
  exit?: (code: number) => void;
}

/**
 * Stops accepting connections on SIGTERM/SIGINT, lets running requests
 * finish and exits 0. Exits 1 if requests are still running after timeoutMs.
 * Returns the handler so it can be triggered without a signal.
 */
export function installGracefulShutdown(
  server: Server,
  {
    timeoutMs = SHUTDOWN_TIMEOUT_MS,
    signals = ['SIGTERM', 'SIGINT'],
    exit = (code) => process.exit(code),
  }: ShutdownOptions = {}
): (signal: string) => void {
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ component, signal }, 'Closing HTTP server');
    const force = setTimeout(() => {
      logger.warn(
        { component, timeoutMs },
        'Requests still running after timeout, exiting'
      );
      exit(1);
    }, timeoutMs);
    force.unref();
    const sweep = setInterval(() => server.closeIdleConnections(), 250);
    sweep.unref();
    server.close((err) => {
      clearTimeout(force);
      clearInterval(sweep);
      if (err) {
        logger.error({ component, err }, 'Closing HTTP server failed');
      }
      exit(err ? 1 : 0);
    });
    server.closeIdleConnections();
  };
  for (const signal of signals) {
    process.on(signal, () => shutdown(signal));
  }
  return shutdown;
}
