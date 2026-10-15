import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Find python executable: check .venv first, then fallback to python
let pythonCmd = 'python';
const venvPythonWin = path.join(rootDir, '.venv', 'Scripts', 'python.exe');
const venvPythonPosix = path.join(rootDir, '.venv', 'bin', 'python');

if (fs.existsSync(venvPythonWin)) {
  pythonCmd = venvPythonWin;
} else if (fs.existsSync(venvPythonPosix)) {
  pythonCmd = venvPythonPosix;
}

console.log('----------------------------------------------------');
console.log(' [LABGUARD] Starting Full-Stack Local Environment ');
console.log('----------------------------------------------------');
console.log(`> Python runtime: ${pythonCmd}`);
console.log('> Starting Backend (FastAPI on http://127.0.0.1:8000)...');

const backend = spawn(
  pythonCmd,
  ['-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', '8000', '--reload'],
  { cwd: rootDir, stdio: 'inherit', shell: true }
);

console.log('> Starting Frontend (Vite on http://localhost:3000)...');
const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

const frontend = spawn(
  npxCmd,
  ['vite', '--port=3000', '--host=0.0.0.0'],
  { cwd: rootDir, stdio: 'inherit', shell: true }
);

const cleanExit = () => {
  console.log('\n[LABGUARD] Shutting down frontend & backend processes...');
  try {
    if (backend && !backend.killed) {
      if (isWin && backend.pid) {
        spawn('taskkill', ['/pid', backend.pid.toString(), '/f', '/t']);
      } else {
        backend.kill('SIGINT');
      }
    }
  } catch {}

  try {
    if (frontend && !frontend.killed) {
      if (isWin && frontend.pid) {
        spawn('taskkill', ['/pid', frontend.pid.toString(), '/f', '/t']);
      } else {
        frontend.kill('SIGINT');
      }
    }
  } catch {}

  process.exit(0);
};

process.on('SIGINT', cleanExit);
process.on('SIGTERM', cleanExit);

backend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[LABGUARD] Backend process exited with code ${code}`);
  }
});

frontend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`[LABGUARD] Frontend process exited with code ${code}`);
  }
});
