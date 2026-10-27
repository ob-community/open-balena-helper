const http = require('node:http');
const { installGracefulShutdown } = require('../dist/shutdown');

async function startServer() {
  let release = () => undefined;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/slow') {
      held.then(() => res.end('done'));
      return;
    }
    res.end('ok');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, release, url: (path) => `http://127.0.0.1:${port}${path}` };
}

function connections(server) {
  return new Promise((resolve) => server.getConnections((_, n) => resolve(n)));
}

async function waitFor(check) {
  for (let i = 0; i < 100; i++) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('condition not met');
}

describe('installGracefulShutdown', () => {
  it('lets a running request finish, refuses new ones, then exits 0', async () => {
    const { server, release, url } = await startServer();
    const exit = jest.fn();
    const shutdown = installGracefulShutdown(server, { signals: [], exit });

    const slow = fetch(url('/slow')).then((r) => r.text());
    await waitFor(async () => (await connections(server)) === 1);

    shutdown('SIGTERM');
    await expect(fetch(url('/'))).rejects.toThrow();
    expect(exit).not.toHaveBeenCalled();

    release();
    expect(await slow).toBe('done');
    await waitFor(() => exit.mock.calls.length > 0);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits 1 when requests outlast the timeout', async () => {
    const { server, release, url } = await startServer();
    const exit = jest.fn();
    const shutdown = installGracefulShutdown(server, {
      signals: [],
      exit,
      timeoutMs: 50,
    });

    const slow = fetch(url('/slow')).catch(() => undefined);
    await waitFor(async () => (await connections(server)) === 1);
    shutdown('SIGTERM');

    await waitFor(() => exit.mock.calls.length > 0);
    expect(exit).toHaveBeenCalledWith(1);
    release();
    await slow;
    server.closeAllConnections();
  });

  it('handles a repeated signal only once', async () => {
    const { server } = await startServer();
    const exit = jest.fn();
    const shutdown = installGracefulShutdown(server, { signals: [], exit });

    shutdown('SIGTERM');
    shutdown('SIGINT');
    await waitFor(() => exit.mock.calls.length > 0);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
