# Claude Revive

Get your Claude Code sessions back after a reboot, a VS Code update or a closed
window.

You run five Claude Code sessions in VS Code terminals. VS Code updates and
restarts. The terminals are gone, and so is the list of which session ran in
which tab. Claude Revive remembers the open sessions and reopens each one in
its own bash terminal with `claude --resume <id>`.

*Unofficial. Not made by or affiliated with Anthropic.*

## Features

- **Restore on startup.** When VS Code starts and sessions were killed, it
  offers to reopen them.
- **Original order.** Tabs reopen in the order their terminals were first
  opened.
- **Live tab titles.** Each tab is a normal bash terminal, so Claude's own
  title, with its working and done symbols, shows in the tab.
- **One window only.** When several VS Code windows start at once, only the
  first one that restores gets the sessions.
- **Sessions without a terminal.** Sometimes `claude` keeps running after its
  tab closed, stopped and out of reach. Claude Revive finds these and offers to
  end them and reopen them in the current window. The conversation is kept.

## Requirements

- Linux, or Windows with [WSL](https://code.visualstudio.com/docs/remote/wsl).
  macOS and native Windows are not supported.
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI as
  `claude` on the `PATH` of your terminal.
- Python 3.8 or newer as `python3`.

## Getting started

1. Install the extension. With WSL, install it in the WSL window.
2. Click **Add hooks** when it asks. This adds two hooks to
   `~/.claude/settings.json` and keeps the old file as
   `settings.json.claude-revive.bak`.
3. Start Claude sessions as usual. Sessions that were already running are not
   tracked; see [Limits](#limits).

From now on, VS Code offers to restore sessions after a restart.

## Commands

| Command | What it does |
|---|---|
| **Claude Revive: Restore killed sessions** | Reopens every killed session in this window. Asks first about sessions that run without a terminal. |
| **Claude Revive: Set up Claude hooks** | Adds the two hooks if they are missing. |

## When is a session restorable?

A session is restorable when it is registered and its `claude` process is gone.

- **Registered:** the SessionStart hook registers every session when it starts.
- **Unregistered:** only a deliberate end removes a session: `/exit`, Ctrl+D,
  `/clear` or logout.
- **Not restorable:** a session that ended before its first prompt. Claude has
  no conversation to resume yet, so Claude Revive drops it.

So closing a tab while Claude runs leaves the session restorable. That is on
purpose: a VS Code update closes tabs the same way.

## How it works

The extension ships a small Python helper and copies it to
`~/.local/share/claude-revive/claude-revive`. Claude Code calls it from the
hooks. The extension calls it to ask what to restore.

1. **Track.** On SessionStart the helper writes one JSON file per session to
   `~/.claude/open-sessions/`: session ID, folder, process ID and a sort key.
   On a deliberate SessionEnd it deletes the file.
2. **Check.** On startup the extension asks the helper for registered sessions
   whose process is gone.
3. **Claim.** When you restore, the helper marks those sessions as claimed for
   two minutes, so a second window does not open them too.
4. **Resume.** The extension opens one bash terminal per session in the
   session's folder and types `claude --resume <id>`. When Claude exits, the
   bash stays.

The sort key is the start time of the bash that ran Claude. A session keeps
its first key across resumes, so tabs keep their order through any number of
restarts.

## Command-line helper

You can run the helper yourself:

```sh
~/.local/share/claude-revive/claude-revive list      # all sessions: alive, DEAD or ORPHN
~/.local/share/claude-revive/claude-revive add <id> <folder>   # track a session by hand
```

`claim`, `orphans` and `reap` exist for the extension.

## Files it touches

| Path | Why |
|---|---|
| `~/.claude/settings.json` | Two hooks, added only after you agree. Honors `CLAUDE_CONFIG_DIR`. |
| `~/.claude/open-sessions/` | One small JSON file per open session. |
| `~/.local/share/claude-revive/` | The helper. Honors `XDG_DATA_HOME`. |

Claude Revive makes no network requests.

## Limits

- Sessions started before the hooks were added are not tracked. Add one by hand
  with `claude-revive add <id> <folder>`, or resume it once with
  `claude --resume <id>`.
- `claude --resume` only finds a session from the folder it was started in.
  Claude Revive opens each terminal in that folder.
- The hooks track every interactive Claude session on the machine, also ones
  started outside VS Code. Headless `claude -p` runs are skipped.

## Uninstall

1. Remove the two `claude-revive hook` entries from `~/.claude/settings.json`.
2. Uninstall the extension.
3. Delete `~/.claude/open-sessions/` and `~/.local/share/claude-revive/`.

## Develop

```sh
git clone https://github.com/coezbek/claude-revive
cd claude-revive
./install.sh   # packages and installs the extension, links the helper into ~/.local/bin
```

Run it from a VS Code terminal so `code` installs into the right host. Then run
**Developer: Reload Window**.

## License

[MIT](LICENSE)
