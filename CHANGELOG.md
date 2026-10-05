# Changelog

## Unreleased

- New command **New Claude terminal**, also a ✳ Claude button next to **+** in
  the terminal panel. Opens a terminal and starts `claude` in it.
- Restored and new Claude terminals show the ✳ Claude icon on their tab.
- Restore always opens a plain login bash (`bash -l`). A default terminal profile that starts
  `claude` itself no longer receives the resume command as a prompt.

## 0.1.0

First public release.

- Restore Claude Code sessions killed by a reboot, a VS Code update or a closed
  window, one bash terminal each.
- Reopen tabs in the order their terminals were first opened.
- Let Claude set the tab title, so the working and done symbols show.
- Offer to end and reopen sessions that still run without a terminal.
- Offer to add the Claude Code hooks; new command **Set up Claude hooks**.
- Bundle the helper; no separate install.
- Skip sessions that ended before their first prompt, and headless `claude -p`
  runs.
- Linux and WSL only.
