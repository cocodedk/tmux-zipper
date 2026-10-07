# tmux-zipper

A Claude Code mod that runs tmux shortcuts above the prompt in amber bulbs, like the 1928 Motograph news zipper on Times Square. It keeps running while Claude works, and picks up where it was after a reload.

## Install

In a Claude Code terminal session:

```
/plugin install tmux-zipper --marketplace cocodedk/tmux-zipper
```

Answer `y` to add the marketplace, then pick a scope.

## Use

- `/zipper` turns it on or off; `/zipper on` and `/zipper off` set it directly.
- `ctrl+x ctrl+a`, or the `[-]` beside it, collapses the band.

The 67 shortcuts in `hooks/shortcuts.ts` assume a prefix of `C-a` and the tmux-resurrect and tmux-continuum plugins. `cheat-sheet.html` is the same list as a page; keep the two in step.

## Develop

```
claude --plugin-dir .      # run it from this folder
claude plugin validate .
claude plugin test .
```
