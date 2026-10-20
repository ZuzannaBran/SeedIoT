const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function main() {
  const cwd = process.cwd();
  const expoPackageJson = require.resolve('expo/package.json', { paths: [cwd] });
  const expoCli = path.join(path.dirname(expoPackageJson), 'bin', 'cli');
  const preload = path.join(__dirname, 'workdir-realpath-preload.js');
  const args = process.argv.slice(2);

  const child = spawn(process.execPath, ['-r', preload, expoCli, ...args], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      CODEX_WORKDIR_REALPATH_ROOT: cwd,
    },
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
