# claude-revive

Reopens Claude Code sessions in VS Code after a reboot, a VS Code update or a
closed window.

- `bin/claude-revive` keeps a registry of open sessions in
  `~/.claude/open-sessions`, fed by Claude's SessionStart and SessionEnd hooks.
- `extension/` is a VS Code extension. On startup it offers to restore killed
  sessions, one bash terminal each, in the order their terminals were first
  opened. It also offers to restore sessions that lost their terminal but
  still run. The command is **Claude: Restore killed sessions**.

## Install

```sh
./install.sh
```

Then add the hooks to `~/.claude/settings.json`:

```json
"hooks": {
  "SessionStart": [{ "hooks": [{ "type": "command", "command": "/home/coezbek/.local/bin/claude-revive hook" }] }],
  "SessionEnd":   [{ "hooks": [{ "type": "command", "command": "/home/coezbek/.local/bin/claude-revive hook" }] }]
}
```

## Traps

- Only `/exit`, Ctrl+D, `/clear` or logout unregister a session. Closing a tab
  while Claude runs leaves it restorable.
- Sessions started before the hooks existed are not tracked. Register them with
  `claude-revive add <id> <cwd>`.
- `claude-revive list` shows every registered session as alive, DEAD or ORPHN.
