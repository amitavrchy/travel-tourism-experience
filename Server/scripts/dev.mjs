import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
async function freePort(first) {
  for (let port = first; port < first + 20; port++) {
    const available = await new Promise((resolve) => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error(`No free port near ${first}.`);
}
const [clientPort, serverPort] = await Promise.all([
  freePort(3000),
  freePort(4000),
]);
const children = [];
function start(directory, script, args, env) {
  const child = spawn(process.execPath, [script, ...args], {
    cwd: `${root}/${directory}`,
    env: { ...process.env, ...env },
    stdio: 'inherit',
    windowsHide: true,
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(error.message);
    stop();
  });
  child.on('exit', (code) => {
    if (code && !stopping) stop(code);
  });
}
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32')
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });
    else child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500).unref();
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
start('Server', 'node_modules/@nestjs/cli/bin/nest.js', ['start', '--watch'], {
  PORT: String(serverPort),
  CLIENT_ORIGIN: `http://127.0.0.1:${clientPort}`,
});
start(
  'Client',
  'node_modules/next/dist/bin/next',
  ['dev', '--hostname', '127.0.0.1', '--port', String(clientPort)],
  { API_URL: `http://127.0.0.1:${serverPort}` },
);
console.log(
  `\nWanderline → http://127.0.0.1:${clientPort}\nTravel API → http://127.0.0.1:${serverPort}\n`,
);
