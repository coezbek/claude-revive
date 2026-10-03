// Reopens Claude sessions killed by a reboot.
// On startup it asks the claude-revive helper which sessions died. If any did,
// it offers to restore them: one normal bash terminal per session, with
// `claude --resume <id>` typed in. When Claude exits, the bash stays.
// It also asks about orphans: sessions whose terminal closed while claude kept
// running. They sit stopped with no tab, and restore skips them as alive.
const vscode = require('vscode');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// The Claude hooks call the helper at this fixed path. The extension folder
// changes with every version, so activate() copies the bundled helper here.
const DATA = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
const CLI = path.join(DATA, 'claude-revive', 'claude-revive');

function installCli(context) {
  const src = fs.readFileSync(context.asAbsolutePath(path.join('bin', 'claude-revive')));
  if (fs.existsSync(CLI) && fs.readFileSync(CLI).equals(src)) return;
  fs.mkdirSync(path.dirname(CLI), { recursive: true });
  fs.writeFileSync(CLI, src);
  fs.chmodSync(CLI, 0o755); // the .vsix zip drops the exec bit
}

function run(args) {
  return new Promise((resolve, reject) => {
    execFile(CLI, args, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr.trim() || err.message));
      resolve(stdout);
    });
  });
}

// Claude Code settings, where the SessionStart and SessionEnd hooks live.
const SETTINGS = path.join(
  process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'), 'settings.json');
const HOOK_EVENTS = ['SessionStart', 'SessionEnd'];

function readSettings() {
  return fs.existsSync(SETTINGS) ? JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) : {};
}

function missingHooks(settings) {
  return HOOK_EVENTS.filter(event => !(settings.hooks?.[event] || []).some(group =>
    (group.hooks || []).some(h => /claude-revive\S*"? hook\b/.test(h.command || ''))));
}

// Adds our hook to each event that lacks it. Keeps a backup of the old file.
// Rewrites settings.json with 2-space indent.
async function setupHooks() {
  let settings;
  try {
    settings = readSettings();
  } catch (e) {
    vscode.window.showErrorMessage(`Cannot parse ${SETTINGS}: ${e.message}`);
    return vscode.window.showTextDocument(vscode.Uri.file(SETTINGS));
  }
  const missing = missingHooks(settings);
  if (!missing.length) {
    return vscode.window.showInformationMessage('Claude Revive hooks are already set up.');
  }
  if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, SETTINGS + '.claude-revive.bak');
  settings.hooks = settings.hooks || {};
  for (const event of missing) {
    settings.hooks[event] = settings.hooks[event] || [];
    settings.hooks[event].push({ hooks: [{ type: 'command', command: `"${CLI}" hook` }] });
  }
  fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
  fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
  vscode.window.showInformationMessage(
    'Claude Revive hooks added. Claude sessions started from now on can be restored.');
}

async function offerHooks(context) {
  let missing;
  try {
    missing = missingHooks(readSettings());
  } catch (e) {
    return; // unreadable settings: setupHooks reports it when run by hand
  }
  if (!missing.length || context.globalState.get('hooksDeclined')) return;
  const choice = await vscode.window.showInformationMessage(
    `Claude Revive tracks open Claude sessions with two Claude Code hooks. Add them to ${SETTINGS}?`,
    'Add hooks', 'Not now', "Don't ask again"
  );
  if (choice === 'Add hooks') await setupHooks();
  if (choice === "Don't ask again") await context.globalState.update('hooksDeclined', true);
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
  // The helper reads /proc. On macOS or native Windows it cannot work.
  if (process.platform !== 'linux') {
    const explain = () => vscode.window.showWarningMessage(
      'Claude Revive works on Linux and WSL only. On Windows, open the folder in WSL.');
    for (const id of ['claudeRevive.restore', 'claudeRevive.setupHooks']) {
      context.subscriptions.push(vscode.commands.registerCommand(id, explain));
    }
    return;
  }
  installCli(context);
  context.subscriptions.push(
    vscode.commands.registerCommand('claudeRevive.restore', () =>
      restore().catch(e => vscode.window.showErrorMessage(`claude-revive failed: ${e.message}`))),
    vscode.commands.registerCommand('claudeRevive.setupHooks', () =>
      setupHooks().catch(e => vscode.window.showErrorMessage(`claude-revive failed: ${e.message}`)))
  );
  offerHooks(context);
  offer();
}

function deactivate() {}

module.exports = { activate, deactivate };
