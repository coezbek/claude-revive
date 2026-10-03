// Reopens Claude sessions killed by a reboot.
// On startup it asks ~/.local/bin/claude-revive which sessions died. If any did,
// it offers to restore them: one normal bash terminal per session, with
// `claude --resume <id>` typed in. When Claude exits, the bash stays.
const vscode = require('vscode');
const { execFile } = require('child_process');
const os = require('os');
const path = require('path');

const CLI = path.join(os.homedir(), '.local', 'bin', 'claude-revive');

function claim(dryRun) {
  const args = dryRun ? ['claim', '--dry-run'] : ['claim'];
  return new Promise((resolve, reject) => {
    execFile(CLI, args, (err, stdout) => {
      if (err) return reject(err);
      try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
    });
  });
}

async function restore() {
  // Claiming unregisters the sessions, so a second window will not reopen them.
  const sessions = await claim(false);
  for (const s of sessions) {
    const term = vscode.window.createTerminal({ name: s.title, cwd: s.cwd });
    term.sendText(`claude --resume ${s.id}`);
  }
  if (sessions.length) {
    vscode.window.showInformationMessage(`Restored ${sessions.length} Claude session(s).`);
  } else {
    vscode.window.showInformationMessage('No killed Claude sessions to restore.');
  }
}

async function offer() {
  let pending;
  try {
    pending = await claim(true);
  } catch (e) {
    return; // claude-revive missing or broken: stay silent on startup
  }
  if (!pending.length) return;
  const n = pending.length;
  const choice = await vscode.window.showInformationMessage(
    `${n} Claude session${n > 1 ? 's were' : ' was'} killed by a restart. Restore ${n > 1 ? 'them' : 'it'} as terminals?`,
    'Restore', 'Not now'
  );
  if (choice === 'Restore') await restore();
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeRevive.restore', () =>
      restore().catch(e => vscode.window.showErrorMessage(`claude-revive failed: ${e.message}`)))
  );
  offer();
}

function deactivate() {}

module.exports = { activate, deactivate };
