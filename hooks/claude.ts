import type { CoreEngineInterface } from 'claude-code'

import { BUILTIN } from './constants'
import type { Cassette } from './zipper'

// The Raster takes printable width-1 characters only; built-in descriptions are English, so they are made plain ASCII.
const plain = (text: string) =>
  text.replace(/\s+/g, ' ').replaceAll('…', '...').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\x20-\x7e]/g, '?')

// The claude cassette as the running Claude Code has it: its built-in slash commands, in typeahead order.
export async function builtins($: Pick<CoreEngineInterface, 'command'>): Promise<Cassette> {
  return (await $.command.list()).filter(c => c.source === BUILTIN).map(c => [`/${c.name}`, plain(c.description)] as const)
}

// The Claude Code cassette, in order: [command, what it does]. Built-in slash commands as of 2.1.319;
// /zipper update claude replaces it with the running version's.
export const CLAUDE: Cassette = [
  ["/help", "Show help and the available commands"],
  ["/clear", "Start fresh with empty context; the old session stays resumable"],
  ["/compact", "Free up context by summarizing the conversation so far"],
  ["/context", "Show context usage as a coloured grid"],
  ["/resume", "Resume a previous conversation"],
  ["/rewind", "Restore the code and/or conversation to an earlier point"],
  ["/branch", "Branch the conversation at this point"],
  ["/fork", "Copy this conversation into a background session"],
  ["/rename", "Rename the conversation"],
  ["/export", "Export the conversation to a file or the clipboard"],
  ["/copy", "Copy Claude's last response (/copy N for the Nth-latest)"],
  ["/btw", "Ask a side question without interrupting"],
  ["/model", "Set the model"],
  ["/effort", "Set the effort level"],
  ["/fast", "Toggle fast mode"],
  ["/plan", "Enable plan mode or view the current plan"],
  ["/goal", "Set a goal Claude checks before stopping"],
  ["/advisor", "Let Claude consult a stronger model at key moments"],
  ["/usage", "Session cost, plan usage and activity (/cost, /stats)"],
  ["/status", "Version, model, account and connectivity"],
  ["/config", "Open settings"],
  ["/permissions", "Allow and deny rules for tools"],
  ["/hooks", "View the hook configurations"],
  ["/mcp", "Manage MCP servers"],
  ["/plugin", "Manage plugins and marketplaces"],
  ["/reload-plugins", "Activate pending plugin changes"],
  ["/skills", "List the available skills"],
  ["/reload-skills", "Pick up skills changed on disk"],
  ["/memory", "Edit CLAUDE.md files and memory settings"],
  ["/init", "Write a CLAUDE.md for the codebase"],
  ["/add-dir", "Add a working directory"],
  ["/cd", "Move this session to another directory"],
  ["/tasks", "Everything running in the background (/bashes)"],
  ["/diff", "Uncommitted changes and per-turn diffs"],
  ["/ide", "Manage IDE integrations"],
  ["/theme", "Change the theme"],
  ["/color", "Set the prompt bar colour"],
  ["/statusline", "Set up the status line"],
  ["/terminal-setup", "Install Shift+Enter for newlines"],
  ["/keybindings", "Open your keyboard shortcuts file"],
  ["/focus", "Just your prompt, the summary and the response"],
  ["/tui", "Default or fullscreen renderer"],
  ["/schedule", "Scheduled cloud agents (/routines)"],
  ["/loops", "List, create and delete loops"],
  ["/remote-control", "Drive this session from your phone or claude.ai (/rc)"],
  ["/teleport", "Send this session to the cloud, or resume one from there"],
  ["/artifacts", "Browse your published and shared artifacts"],
  ["/workflows", "Browse running and finished workflows"],
  ["/insights", "A report on your Claude Code sessions"],
  ["/release-notes", "View the release notes"],
  ["/version", "This session's version"],
  ["/feedback", "Send feedback or report a bug"],
  ["/login", "Sign in to your Anthropic account"],
  ["/logout", "Sign out"],
  ["/exit", "Exit Claude Code"],
]
