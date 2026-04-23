import { execSync } from 'child_process';

console.log("🧹 Cleaning up rogue harvester processes...");

try {
    if (process.platform === 'win32') {
        // Find all node processes running esf7_harvester.js
        const out = execSync('wmic process where "commandline like \'%esf7_harvester.js%\' and name=\'node.exe\'" get processid').toString();
        const pids = out.split('\n').map(l => l.trim()).filter(l => l && !isNaN(l) && l !== 'ProcessId');
        
        if (pids.length > 0) {
            console.log(`Found ${pids.length} processes. Killing them...`);
            pids.forEach(pid => {
                try {
                    execSync(`taskkill /F /PID ${pid}`);
                    console.log(`✅ Killed PID ${pid}`);
                } catch (e) {}
            });
        } else {
            console.log("✅ No rogue harvesters found.");
        }
    } else {
        execSync('pkill -f esf7_harvester.js || true');
        console.log("✅ Killed rogue harvesters (Unix).");
    }
} catch (err) {
    console.log("✅ All clear (no processes found).");
}
