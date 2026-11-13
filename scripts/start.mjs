// Arranque Cero-Instalación de ClaimShield: backend (SQLite) + frontend con un solo comando.
// Multiplataforma (Windows, macOS, Linux), sin bash ni dependencias externas.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const args = process.argv.slice(2);
const setupOnly = args.includes('--setup-only');
const devMode = args.includes('--dev');

const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;
const MIN_NODE_MAJOR = 22;

const COLORS = { api: '\x1b[36m', web: '\x1b[35m', setup: '\x1b[33m' };
const RESET = '\x1b[0m';

function log(message) {
  console.log(message);
}

function fail(message) {
  console.error(`\n[ClaimShield] ${message}\n`);
  process.exit(1);
}

function prefixed(tag, stream, target) {
  let pending = '';
  stream.on('data', (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? '';
    for (const line of lines) {
      target.write(`${COLORS[tag]}[${tag}]${RESET} ${line}\n`);
    }
  });
  stream.on('end', () => {
    if (pending) target.write(`${COLORS[tag]}[${tag}]${RESET} ${pending}\n`);
  });
}

function checkNodeVersion() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < MIN_NODE_MAJOR) {
    fail(`Se requiere Node.js ${MIN_NODE_MAJOR} o superior (detectado ${process.versions.node}). Descárgalo en https://nodejs.org`);
  }
}

function runNpmSync(cwd, npmArgs, label) {
  log(`${COLORS.setup}[setup]${RESET} ${label}...`);
  const result = spawnSync('npm', npmArgs, { cwd, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) {
    fail(`Falló "npm ${npmArgs.join(' ')}" en ${path.basename(cwd)}. Revisa tu conexión a internet y vuelve a intentarlo.`);
  }
}

function ensureDependencies() {
  for (const folder of ['backend', 'frontend']) {
    const dir = path.join(root, folder);
    if (!existsSync(path.join(dir, 'node_modules'))) {
      const command = existsSync(path.join(dir, 'package-lock.json')) ? 'ci' : 'install';
      runNpmSync(dir, [command, '--ignore-scripts'], `Instalando dependencias de ${folder} (solo la primera vez)`);
    }
  }
}

function canListen(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => resolve(err.code !== 'EADDRINUSE' && err.code !== 'EACCES'));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

// Se prueba en IPv4 (loopback y todas las interfaces) e IPv6 para detectar cualquier proceso que use el puerto.
async function isPortFree(port) {
  for (const host of ['127.0.0.1', '0.0.0.0', '::']) {
    if (!(await canListen(port, host))) return false;
  }
  return true;
}

async function checkPorts() {
  for (const [name, port] of [['Backend', BACKEND_PORT], ['Frontend', FRONTEND_PORT]]) {
    if (!(await isPortFree(port))) {
      const hint = isWindows ? `netstat -ano | findstr :${port}` : `lsof -i :${port}`;
      fail(
        `El puerto ${port} (${name}) está ocupado. Cierra el proceso que lo usa (puedes localizarlo con: ${hint}) ` +
          'o detén Docker (npm run docker:down) y vuelve a ejecutar npm start.',
      );
    }
  }
}

const children = [];
let shuttingDown = false;

function stopChild(child) {
  if (!child.pid || child.exitCode !== null) return;
  if (isWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      child.kill('SIGTERM');
    }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach(stopChild);
  setTimeout(() => process.exit(code), 500);
}

function launch(tag, folder, npmScript, extraEnv = {}) {
  const child = spawn('npm', ['run', npmScript], {
    cwd: path.join(root, folder),
    env: { ...process.env, ...extraEnv },
    shell: isWindows,
    detached: !isWindows,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  prefixed(tag, child.stdout, process.stdout);
  prefixed(tag, child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`\n[ClaimShield] El proceso ${tag} terminó (código ${code}). Deteniendo el resto...`);
      shutdown(code ?? 1);
    }
  });
  children.push(child);
}

async function waitForApi(retries = 60) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(`http://localhost:${BACKEND_PORT}/api/health`);
      if (res.ok) return true;
    } catch {
      // el backend aún no responde
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
}

async function main() {
  checkNodeVersion();
  ensureDependencies();
  if (setupOnly) {
    log('\n[ClaimShield] Dependencias listas. Ejecuta "npm start" para levantar la aplicación.\n');
    return;
  }
  await checkPorts();

  process.on('SIGINT', () => shutdown(0));
  process.on('SIGTERM', () => shutdown(0));

  log('\n[ClaimShield] Modo Cero-Instalación (SQLite, sin Docker). Iniciando backend y frontend...\n');
  launch('api', 'backend', devMode ? 'dev:sqlite' : 'start:sqlite', {
    DB_CLIENT: 'sqlite',
    PORT: String(BACKEND_PORT),
  });
  launch('web', 'frontend', 'dev');

  if (await waitForApi()) {
    log(`
==============================================================
  ClaimShield está listo
  Frontend : http://localhost:${FRONTEND_PORT}
  API      : http://localhost:${BACKEND_PORT}/api
  Swagger  : http://localhost:${BACKEND_PORT}/api-docs
  Base de datos SQLite: backend/data/claimshield.db
  (npm run db:reset la recrea con los datos de ejemplo)
  Presiona Ctrl+C para detener todo.
==============================================================
`);
  } else {
    console.error('\n[ClaimShield] El backend no respondió en 60 segundos. Revisa los mensajes [api] de arriba.\n');
    shutdown(1);
  }
}

main();
