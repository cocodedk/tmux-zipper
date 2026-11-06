import { DARK, KEYS, LIT, SEPARATOR } from './constants'
import { SHORTCUTS } from './shortcuts'

// The whole bulletin as cells: a code point and a colour per character.
export type Tape = { codePoints: Uint32Array; colors: Uint32Array }
// A cassette: [keys, what they do] pairs, played in order.
export type Cassette = readonly (readonly [string, string])[]

export function buildTape(items: Cassette = SHORTCUTS): Tape {
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

// One row of the Raster, `columns` wide, starting `step` characters into the tape (it loops).
export function frame(tape: Tape, step: number, columns: number): string {
  const words = new Uint32Array(columns * 3)
  for (let x = 0; x < columns; x++) {
    const i = (step + x) % tape.codePoints.length
    words[x * 3] = tape.codePoints[i] ?? 0x20
    words[x * 3 + 1] = tape.colors[i] ?? LIT
    words[x * 3 + 2] = DARK
  }

  // The environment has Uint8Array.prototype.toBase64; the es2023 lib does not declare it.
  return (new Uint8Array(words.buffer) as Uint8Array & { toBase64(): string }).toBase64()
}
