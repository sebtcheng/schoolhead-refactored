const { Client } = require('ssh2');
const SERVER_IP = "20.24.58.49";
const USER = "Administrator1";
const PASS = "<REDACTED_SSH_PASS>";

const conn = new Client();

const commands = [
    'echo "--- Deleting Ollama Models ---"',
    'sudo rm -rf /usr/share/ollama/.ollama/models && echo "Ollama models deleted"',
    'echo "--- Deleting R DuckDB Library ---"',
    'sudo rm -rf /usr/local/lib/R/site-library/duckdb && echo "R DuckDB library deleted"',
    'echo "--- Pruning Docker Data ---"',
    'docker system prune -af --volumes 2>/dev/null || echo "Docker prune failed or docker not installed"',
    'echo "--- Final Disk Usage ---"',
    'df -h | grep -v tmpfs'
];

conn.on('ready', () => {
    console.log('SSH Connection Established for Cleanup.');
    let currentCmd = 0;

    function runNext() {
        if (currentCmd >= commands.length) {
            conn.end();
            return;
        }
        const cmd = commands[currentCmd++];
        console.log(`\n> Running: ${cmd}`);
        conn.exec(cmd, (err, stream) => {
            if (err) {
                console.error(err);
                runNext();
                return;
            }
            stream.on('close', (code) => {
                runNext();
            }).on('data', (data) => {
                process.stdout.write(data);
            }).stderr.on('data', (data) => {
                process.stderr.write(data);
            });
        });
    }
    runNext();
}).connect({
    host: SERVER_IP,
    port: 22,
    username: USER,
    password: PASS
});
