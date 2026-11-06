import { expect, test } from 'claude-code/testing'

import { SHORTCUTS } from './shortcuts'
import { buildTape, DARK, frame, KEYS, ROWS } from './zipper'

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

test('every character of the 67 shortcuts is one the Raster takes', async ($, on) => {
  expect(SHORTCUTS.length).toBe(67)
  const chars = [...new Set(SHORTCUTS.map(([keys, action]) => keys + action).join(''))].join('')
  const tape = buildTape([[chars, '']])
  // Beneath the zipper, switched off: draws every character once; a cell the Raster refuses skips the tree.
  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    if (e.surface !== 'terminal') return next(e)
    const { Raster } = $.ui.resolve(e)
    return <Raster key="every-char" columns={tape.codePoints.length} rows={ROWS} cells={frame(tape, 0, tape.codePoints.length)} />
  })
  await $.command.run(typed('off'))
  const ui = await $.ui.mount({ plugin: 'tmux-zipper', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect(await ui.find({ key: 'every-char' })).toBeDefined()
  await ui.unmount()
})

test('a frame is one row of text, keys in white, that steps a character at a time and loops', async () => {
  const tape = buildTape([['C-a d', 'Detach']])
  const cells = cellsOf(frame(tape, 0, 40))
  expect(cells.length).toBe(40 * ROWS * 3)
  const cell = (c: Uint32Array, x: number) => Array.from(c.slice(x * 3, x * 3 + 3))
  expect(cell(cells, 0)).toEqual(['C'.charCodeAt(0), KEYS, DARK])
  expect(cell(cellsOf(frame(tape, 1, 40)), 0)).toEqual(['-'.charCodeAt(0), KEYS, DARK])
  expect(frame(tape, tape.codePoints.length, 40)).toBe(frame(tape, 0, 40))
})

test('the zipper runs above the prompt on a terminal, through a turn, where it fits', async ($, on) => {
  // Stands for the engine's own band beneath the plugin: an empty box.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Box } = $.ui.resolve(e)
    return <Box key="engine-band" />
  })
  const ui = await $.ui.mount({ plugin: 'tmux-zipper', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect(await ui.find({ key: 'zipper' })).toBeDefined()
  await ui.redraw({ ...BAND_PROPS, isWorking: true })
  expect(await ui.find({ key: 'zipper' })).toBeDefined()
  await ui.redraw({ ...BAND_PROPS, hasSurvey: true })
  expect(await ui.find({ key: 'zipper' })).toBeUndefined()
  expect(await ui.find({ key: 'engine-band' })).toBeDefined()
  await ui.redraw({ ...BAND_PROPS, bodyColumns: 19 })
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
