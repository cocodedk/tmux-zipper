import { SHORTCUTS } from './shortcuts'

// One row of ordinary terminal text scrolling past, a character a step.
export const ROWS = 1

export const KEYS = 0xfff1c9 // warm white: the keys
const LIT = 0xffb000 // amber: what they do
export const DARK = 0x150f08 // the ribbon behind the text
const SEPARATOR = '   ◆   '

// The whole bulletin as cells: a code point and a colour per character.
export type Tape = { codePoints: Uint32Array; colors: Uint32Array }

export function buildTape(items: readonly (readonly [string, string])[] = SHORTCUTS): Tape {
  const codePoints: number[] = []
  const colors: number[] = []
  const write = (text: string, color: number) => {
    for (const ch of text) {
      codePoints.push(ch.codePointAt(0) ?? 0x20)
      colors.push(color)
    }
  }
  for (const [keys, action] of items) {
    write(keys, KEYS)
    write(`  ${action}${SEPARATOR}`, LIT)
  }

  return { codePoints: Uint32Array.from(codePoints), colors: Uint32Array.from(colors) }
}

// One frame of the Raster, `columns` wide, starting `step` characters into the tape (it loops).
export function frame(tape: Tape, step: number, columns: number): string {
  const words = new Uint32Array(columns * ROWS * 3)
  for (let x = 0; x < columns; x++) {
    const i = (step + x) % tape.codePoints.length
    words[x * 3] = tape.codePoints[i] ?? 0x20
    words[x * 3 + 1] = tape.colors[i] ?? LIT
    words[x * 3 + 2] = DARK
  }

  // The environment has Uint8Array.prototype.toBase64; the es2023 lib does not declare it.
  return (new Uint8Array(words.buffer) as Uint8Array & { toBase64(): string }).toBase64()
}
