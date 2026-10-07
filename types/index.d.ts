// Whether the zipper runs, switched by /zipper; on when the session starts.
export type IsOn = boolean

declare module 'claude-code' {
  interface PluginState {
    'tmux-zipper': { isOn: IsOn }
  }
}
