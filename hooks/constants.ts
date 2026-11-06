// The Raster's key in the band, and its size: one row, as wide as the band within these bounds.
export const KEY = 'zipper'
export const ROWS = 1
export const MIN_COLUMNS = 20
export const MAX_COLUMNS = 512

// Colours: warm white keys, amber actions, on a dark background.
export const KEYS = 0xfff1c9
export const LIT = 0xffb000
export const DARK = 0x150f08
export const SEPARATOR = '   ◆   '

// Speed in characters a second: the default, the range /zipper speed takes, and the $.store key it is kept under.
export const DEFAULT_SPEED = 2.3
export const MIN_SPEED = 0.5
export const MAX_SPEED = 20
export const SPEED_KEY = 'speed'

// How long blits may be refused in a row before the band counts as gone (the next draw sets it again).
export const GIVE_UP_MS = 1000
