import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// --- ANSI Colors ---
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const green = '\x1b[32m';
const cyan = '\x1b[36m';
const yellow = '\x1b[33m';
const blue = '\x1b[34m';
const red = '\x1b[31m';
const gray = '\x1b[90m';

// --- Parse .env directly for DB status ---
function getDbInfo() {
  const envPath = path.join(rootDir, '.env');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }

  const env = {};
  for (const rawLine of envContent.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      env[key] = val;
    }
  }

  const mainDbUrl = env.CLOUD_DATABASE_URL || env.DATABASE_URL || 'postgres://Administrator1:pRZTbQ2T1JD7@stride-posgre-prod-01.postgres.database.azure.com:5432/insighted-staging';
  const siifDbUrl = env.SIIF_DATABASE_URL || '';
  const usersDbUrl = env.USERS_DATABASE_URL || '';

  const parseUrl = (str) => {
    try {
      const u = new URL(str);
      const isLoopback = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
      return {
        isLocal: isLoopback,
        host: u.host,
        database: u.pathname.replace(/^\//, '') || 'default'
      };
    } catch {
      const isLoopback = str.includes('localhost') || str.includes('127.0.0.1');
      return {
        isLocal: isLoopback,
        host: isLoopback ? 'localhost:5432' : 'remote',
        database: 'database'
      };
    }
  };

  const mainInfo = parseUrl(mainDbUrl);
  const siifInfo = siifDbUrl ? parseUrl(siifDbUrl) : null;
  const usersInfo = usersDbUrl ? parseUrl(usersDbUrl) : null;

  return {
    main: mainInfo,
    siif: siifInfo,
    users: usersInfo
  };
}

const dbInfo = getDbInfo();
const appUrl = 'http://localhost:5173/insighted-schoolhead/';
const apiUrl = 'http://127.0.0.1:5010';

function printDashboard() {
  // Clear screen & print clean organized banner
  process.stdout.write('\x1b[2J\x1b[3J\x1b[H');

  console.log(`${bold}${cyan}┌────────────────────────────────────────────────────────────────────────┐${reset}`);
  console.log(`${bold}${cyan}│                     ${green}InsightEd SchoolHead Dev Server${cyan}                    │${reset}`);
  console.log(`${bold}${cyan}├────────────────────────────────────────────────────────────────────────┤${reset}`);
  console.log(`${bold}${cyan}│${reset}  🌐 ${bold}Site Link:${reset}    ${bold}${green}${appUrl}${reset}`);
  console.log(`${bold}${cyan}│${reset}  🚀 ${bold}API Server:${reset}   ${cyan}${apiUrl}${reset}`);
  console.log(`${bold}${cyan}│${reset}`);

  if (dbInfo.main.isLocal) {
    console.log(`${bold}${cyan}│${reset}  💾 ${bold}Database:${reset}     ${bold}${green}🟢 LOCAL${reset} (${green}${dbInfo.main.host}/${dbInfo.main.database}${reset})`);
  } else {
    console.log(`${bold}${cyan}│${reset}  💾 ${bold}Database:${reset}     ${bold}${yellow}🌐 REMOTE (Cloud / Azure)${reset}`);
    console.log(`${bold}${cyan}│${reset}                 ${gray}Host: ${dbInfo.main.host} | DB: ${dbInfo.main.database}${reset}`);
  }

  if (dbInfo.siif || dbInfo.users) {
    const siifTag = dbInfo.siif ? (dbInfo.siif.isLocal ? `${green}LOCAL${reset}` : `${yellow}REMOTE${reset}`) : 'N/A';
    const usersTag = dbInfo.users ? (dbInfo.users.isLocal ? `${green}LOCAL${reset}` : `${yellow}REMOTE${reset}`) : 'N/A';
    console.log(`${bold}${cyan}│${reset}                 ${gray}Modules: SIIF [${siifTag}${gray}] | Users [${usersTag}${gray}]${reset}`);
  }

  console.log(`${bold}${cyan}├────────────────────────────────────────────────────────────────────────┤${reset}`);
  console.log(`${bold}${cyan}│${reset}  ${gray}Press Ctrl+C to stop all servers${reset}`);
  console.log(`${bold}${cyan}└────────────────────────────────────────────────────────────────────────┘${reset}\n`);
}

printDashboard();

// --- Filter noise from child logs ---
const ignoredPatterns = [
  'VITE v',
  'ready in',
  'Local:',
  'Network:',
  'use --host to expose',
  'injected env',
  'RUNNING: [apps/school-head/api/index.js]',
  'Initializing InsightEd Master Services',
  'InsightEd Master Server active on',
  'Pre-flight migrations complete',
  'Running boot-time migrations',
  'CLEANUP SERVICE',
  'Restarting',
  'Database Connection:',
  'Mounted inside SchoolHead',
  'Nuclear-Lock',
  'Port 5173 is in use'
];

function filterLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return null;
  for (const pat of ignoredPatterns) {
    if (trimmed.includes(pat)) return null;
  }
  return trimmed;
}

function pipeOutput(stream, prefix, isErr = false) {
  const rl = readline.createInterface({ input: stream, terminal: false });
  rl.on('line', (line) => {
    const clean = filterLine(line);
    if (!clean) return;

    if (isErr || /error|exception|fail|crash|warning/i.test(clean)) {
      console.log(`${prefix} ${clean}`);
    }
  });
}

// --- Spawn Processes ---
const isWin = process.platform === 'win32';
const nodeCmd = process.execPath;
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');

// 1. API Server
const apiProcess = spawn(nodeCmd, ['--watch', 'index.js'], {
  cwd: path.join(rootDir, 'apps', 'school-head', 'api'),
  env: { ...process.env, PORT: '5010' },
  stdio: ['ignore', 'pipe', 'pipe']
});

pipeOutput(apiProcess.stdout, `${blue}[API]${reset}`);
pipeOutput(apiProcess.stderr, `${red}[API Error]${reset}`, true);

// 2. Vite Web Server
const webProcess = spawn(nodeCmd, [viteBin, '--port', '5173'], {
  cwd: path.join(rootDir, 'apps', 'school-head', 'web'),
  env: { ...process.env },
  stdio: ['ignore', 'pipe', 'pipe']
});

pipeOutput(webProcess.stdout, `${blue}[WEB]${reset}`);
pipeOutput(webProcess.stderr, `${yellow}[WEB Warn]${reset}`, true);

// --- Graceful Cleanup ---
let isExiting = false;
function shutdown() {
  if (isExiting) return;
  isExiting = true;
  console.log(`\n${yellow}Shutting down servers...${reset}`);

  if (isWin) {
    if (apiProcess.pid) {
      spawn('taskkill', ['/pid', apiProcess.pid.toString(), '/T', '/F'], { shell: true });
    }
    if (webProcess.pid) {
      spawn('taskkill', ['/pid', webProcess.pid.toString(), '/T', '/F'], { shell: true });
    }
  } else {
    try { apiProcess.kill('SIGTERM'); } catch {}
    try { webProcess.kill('SIGTERM'); } catch {}
  }

  setTimeout(() => process.exit(0), 400);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', shutdown);
