import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log("🚀 Starting InsightEd Turbo Dev...");

// 1. Port Cleanup (3000, 5173)
const ports = [3000, 5173];
console.log("🧹 Cleaning up ports " + ports.join(", ") + "...");

for (const port of ports) {
  try {
    if (process.platform === 'win32') {
      // Windows: Use netstat to find PID and taskkill
      const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`).toString();
      const lines = out.split('\n').filter(l => l.trim().length > 0);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid)) {
          console.log(`Killing process ${pid} on port ${port}...`);
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
        }
      }
    } else {
      // Unix: Use lsof
      execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore' });
    }
  } catch (e) {
    // Port likely already clear
  }
}

console.log("✨ Launching concurrent servers...");

// 2. Run dev:full
const dev = spawn('npm', ['run', 'dev:full'], {
  stdio: 'inherit',
  shell: true
});

dev.on('exit', (code) => {
  process.exit(code || 0);
});
