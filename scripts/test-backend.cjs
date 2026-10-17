const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, '..');
const rulesPath = path.join(root, 'backend', 'firestore.rules');

async function ownedFirestoreProcesses() {
  if (process.platform !== 'win32') return [];
  const quoted = rulesPath.replaceAll("'", "''");
  const script = `@(Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" | Where-Object { $_.CommandLine.Contains('${quoted}') -and $_.CommandLine.Contains('--project_id demo-lensflow') } | Select-Object -ExpandProperty ProcessId) | ConvertTo-Json -Compress`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true });
  const parsed = stdout.trim() ? JSON.parse(stdout) : [];
  return (Array.isArray(parsed) ? parsed : [parsed]).filter((id) => Number.isInteger(id) && id > 0);
}

(async () => {
  const before = new Set(await ownedFirestoreProcesses());
  let code = 1;
  try {
    const cli = path.join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
    const command = `"${process.execPath}" --test backend/tests/auth.test.mjs`;
    code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [cli, 'emulators:exec', '--project', 'demo-lensflow', '--only', 'auth,firestore', command], { cwd: root, stdio: 'inherit', windowsHide: true });
      child.once('error', reject);
      child.once('exit', (exitCode) => resolve(exitCode ?? 1));
    });
  } finally {
    // Some Windows/Java combinations leave Firestore alive after the CLI exits.
    // Only clean up newly-created demo processes bound to this exact rules file;
    // never stop an emulator that was running before these tests began.
    const leftovers = (await ownedFirestoreProcesses()).filter((id) => !before.has(id));
    if (leftovers.length) await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Stop-Process -Id ${leftovers.join(',')} -ErrorAction SilentlyContinue`], { windowsHide: true });
  }
  process.exitCode = code;
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
