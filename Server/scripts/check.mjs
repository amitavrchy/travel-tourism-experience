import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const npm = process.env.npm_execpath;
if (!npm)
  throw new Error('Run this helper through npm run setup, build, or test.');
async function run(directory, args) {
  const child = spawn(process.execPath, [npm, ...args], {
    cwd: path.join(root, directory),
    stdio: 'inherit',
    windowsHide: true,
  });
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) process.exit(Number(code) || 1);
}
const action = process.argv[2];
if (action === 'setup') {
  await run('Server', ['ci']);
  await run('Client', ['ci']);
} else if (action === 'build') {
  await run('Server', ['run', 'build']);
  await run('Client', ['run', 'build']);
} else if (action === 'test') {
  await run('Server', ['run', 'build']);
  await run('Server', ['test']);
  await run('Server', ['run', 'test:e2e']);
  await run('Client', ['run', 'lint']);
  await run('Client', ['run', 'build']);
  await run('Client', ['run', 'test:e2e']);
} else throw new Error('Choose setup, build, or test.');
