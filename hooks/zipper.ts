import { FONT } from './font'
import { SHORTCUTS } from './shortcuts'

// The ribbon, top to bottom: a brass rail with the label, then three rows of bulbs (six bulbs tall, two to a cell).
export const ROWS = 4

const KEYS = 0xfff1c9 // warm white bulbs: the keys
const LIT = 0xffb000 // amber bulbs: what they do
const DARK = 0x150f08 // the ribbon behind unlit bulbs
const RAIL = 0x8a6d3b
const DEFAULT = 0x01000000 // the terminal's own background
// A cell is 2x2 quarters, so the tape can stop half a bulb in: indexed by top-left, top-right, bottom-left,
// bottom-right lit (bits 3..0), drawn lit in the foreground and dark in the background.
const QUARTERS = [0x20, 0x2597, 0x2596, 0x2584, 0x259d, 0x2590, 0x259e, 0x259f, 0x2598, 0x259a, 0x258c, 0x2599, 0x2580, 0x259c, 0x259b, 0x2588]
const RAIL_LINE = 0x2550 // ═
const LABEL = ' TMUX BULLETIN | PREFIX C-a ' // ASCII: every cell must be one column wide

// The whole bulletin as bulb columns: a 6-bit mask (bit 0 the top bulb) and a colour per column.
export type Tape = { masks: Uint8Array; colors: Uint32Array }

export function buildTape(items: readonly (readonly [string, string])[] = SHORTCUTS): Tape {
  const masks: number[] = []
  const colors: number[] = []
  const write = (text: string, color: number) => {
    for (const ch of text.replace(/…/g, '...').replace(/’/g, "'")) {
      const glyph = FONT[ch] ?? FONT['?'] ?? []
      // A glyph lit to its last column ($, #, +) gets a dark one so it does not touch the next.
      for (const mask of glyph.at(-1) ? [...glyph, 0] : glyph) {
        masks.push(mask)
        colors.push(color)
      }
    }
  }
  for (const [keys, action] of items) {
    write(keys, KEYS)
    write('  ', LIT)
    write(action.toUpperCase(), LIT)
    write('   ◆   ', LIT)
  }

  return { masks: Uint8Array.from(masks), colors: Uint32Array.from(colors) }
}

// One frame of the Raster, `columns` wide, starting `half` half-bulbs into the tape (it loops).
export function frame(tape: Tape, half: number, columns: number): string {
  const words = new Uint32Array(columns * ROWS * 3)
  const put = (row: number, x: number, codePoint: number, fg: number, bg: number) => {
    const i = (row * columns + x) * 3
    words[i] = codePoint
    words[i + 1] = fg
    words[i + 2] = bg
  }
  const label = columns >= LABEL.length + 4 ? LABEL : ''
  for (let x = 0; x < columns; x++) {
    put(0, x, x >= 2 && x - 2 < label.length ? label.charCodeAt(x - 2) : RAIL_LINE, RAIL, DEFAULT)
    // The cell's left half shows one bulb column, its right half the same one or, half a bulb in, the next.
    const left = Math.floor((half + 2 * x) / 2) % tape.masks.length
    const right = Math.floor((half + 2 * x + 1) / 2) % tape.masks.length
    const maskL = tape.masks[left] ?? 0
    const maskR = tape.masks[right] ?? 0
    const color = (maskL ? tape.colors[left] : tape.colors[right]) ?? LIT
    for (let r = 0; r < ROWS - 1; r++) {
      const bit = (mask: number, row: number) => (mask >> row) & 1
      const quarters = (bit(maskL, 2 * r) << 3) | (bit(maskR, 2 * r) << 2) | (bit(maskL, 2 * r + 1) << 1) | bit(maskR, 2 * r + 1)
      put(r + 1, x, QUARTERS[quarters] ?? 0x20, color, DARK)
    }
  }

  // The environment has Uint8Array.prototype.toBase64; the es2023 lib does not declare it.
  return (new Uint8Array(words.buffer) as Uint8Array & { toBase64(): string }).toBase64()
}
