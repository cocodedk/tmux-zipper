import { expect, test } from 'claude-code/testing'

import { FONT } from './font'
import { SHORTCUTS } from './shortcuts'
import { buildTape, frame, ROWS } from './zipper'

const fromBase64 = (s: string) => (Uint8Array as unknown as { fromBase64(s: string): Uint8Array }).fromBase64(s)
const cellsOf = (b64: string) => {
  const bytes = fromBase64(b64)
  return new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
}

// /zipper typed at the prompt, the way the engine raises it.
const typed = (args: string) => ({ command: 'zipper', args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: false, columns: 80 } })

const BAND_PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 12,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 11 },
  view: {},
}

test('all 67 shortcuts are spelled with glyphs the bulb font has', async () => {
  expect(SHORTCUTS.length).toBe(67)
  const text = SHORTCUTS.map(([keys, action]) => keys + action.toUpperCase()).join('')
  const chars = new Set(text.replace(/…/g, '...').replace(/’/g, "'"))
  for (const ch of chars) expect(FONT[ch]).toBeDefined()
  // Six bulbs tall: no glyph lights a seventh.
  for (const columns of Object.values(FONT)) for (const mask of columns) expect(mask).toBeLessThan(64)
})

test('a frame is a brass rail over quarter-block bulbs that stop half a bulb in, and the tape loops', async () => {
  const tape = buildTape([['C-a d', 'Detach']])
  const cells = cellsOf(frame(tape, 0, 40))
  expect(cells.length).toBe(40 * ROWS * 3)
  const cellIn = (c: Uint32Array, row: number, x: number) => Array.from(c.slice((row * 40 + x) * 3, (row * 40 + x) * 3 + 3))
  const cell = (row: number, x: number) => cellIn(cells, row, x)
  expect(cell(0, 0)[0]).toBe(0x2550)
  expect(cell(0, 39)[0]).toBe(0x2550)
  expect(ROWS).toBe(4) // rail and three bulb rows; no dark row and no rail underneath
  // The C's first column lights bulbs 1-4: in the first bulb row its top is dark and its bottom lit (▄), in key white.
  expect(cell(1, 0)).toEqual([0x2584, 0xfff1c9, 0x150f08])
  // Half a bulb in, that cell's left half is the C's first column (bottom lit) and its right half the second (top lit): ▞.
  expect(cellIn(cellsOf(frame(tape, 1, 40)), 1, 0)).toEqual([0x259e, 0xfff1c9, 0x150f08])
  expect(frame(tape, 2 * tape.masks.length, 40)).toBe(frame(tape, 0, 40))
})

test('the zipper runs above the prompt only on an idle terminal', async ($, on) => {
  // Stands for the engine's own band beneath the plugin: an empty box.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine-band" />
  })
  const ui = await $.ui.mount({ plugin: 'tmux-zipper', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect(await ui.find({ key: 'zipper' })).toBeDefined()
  await ui.redraw({ ...BAND_PROPS, isWorking: true })
  expect(await ui.find({ key: 'zipper' })).toBeUndefined()
  expect(await ui.find({ key: 'engine-band' })).toBeDefined()
  await ui.redraw({ ...BAND_PROPS, maxRows: ROWS - 1 })
  expect(await ui.find({ key: 'zipper' })).toBeUndefined()
  await ui.unmount()

  // /zipper off darks it, /zipper brings it back.
  const band = await $.ui.mount({ plugin: 'tmux-zipper', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect((await $.command.run(typed('off'))).text).toBe('Zipper off.')
  await band.redraw()
  expect(await band.find({ key: 'zipper' })).toBeUndefined()
  expect((await $.command.run(typed(''))).text).toBe('Zipper on.')
  await band.redraw()
  expect(await band.find({ key: 'zipper' })).toBeDefined()
  await band.unmount()

  const desk = await $.ui.mount({ plugin: 'tmux-zipper', surface: 'desktop', component: 'AbovePrompt', props: BAND_PROPS })
  expect(await desk.find({ key: 'zipper' })).toBeUndefined()
  await desk.unmount()
})
