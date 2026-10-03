// Reopens Claude sessions killed by a reboot.
// On startup it asks ~/.local/bin/claude-revive which sessions died. If any did,
// it offers to restore them: one normal bash terminal per session, with
// `claude --resume <id>` typed in. When Claude exits, the bash stays.
// It also asks about orphans: sessions whose terminal closed while claude kept
// running. They sit stopped with no tab, and restore skips them as alive.
const vscode = require('vscode');
const { execFile } = require('child_process');
const os = require('os');
const path = require('path');

const CLI = path.join(os.homedir(), '.local', 'bin', 'claude-revive');

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(CLI, args, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr.trim() || err.message));
      resolve(stdout);
    });
  });
}

async function claim(dryRun) {
  return JSON.parse(await run(dryRun ? ['claim', '--dry-run'] : ['claim']));
}

// Asks whether to end orphaned sessions. Returns true if it ended any.
async function handleOrphans() {
  const orphans = JSON.parse(await run(['orphans']));
  if (!orphans.length) return false;
  const n = orphans.length;
  const choice = await vscode.window.showWarningMessage(
    `${n} Claude session${n > 1 ? 's lost their terminal' : ' lost its terminal'} but ${n > 1 ? 'are' : 'is'} still running.`,
    {
      modal: true,
      detail: orphans.map(o => `• ${o.title}`).join('\n') +
        '\n\nEnd them and reopen them here? Any turn in progress is lost; the conversation is kept.',
    },
    'End and restore here', 'Leave running'
  );
  if (choice !== 'End and restore here') return false;
  for (const o of orphans) {
    try {
      await run(['reap', o.id]);
    } catch (e) {
      vscode.window.showErrorMessage(`Could not end "${o.title}": ${e.message}`);
    }
  }
  return true;
}

async function restore() {
  await handleOrphans();
  // Claiming unregisters the sessions, so a second window will not reopen them.
  const sessions = await claim(false);
  for (const s of sessions) {
    // No `name`: a fixed name blocks the titles Claude sets (✳ working, moon done).
    const term = vscode.window.createTerminal({ cwd: s.cwd });
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
    // The user already chose to restore the orphans, so skip the second prompt.
    if (await handleOrphans()) return await restore();
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
