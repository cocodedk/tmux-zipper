import { expect, mock, test } from 'claude-code/testing'

import { BASH } from './bash'
import { CLAUDE } from './claude'
import { FISH } from './fish'
import { SHORTCUTS } from './shortcuts'
import { DARK, KEYS, ROWS } from './constants'
import { buildTape, frame } from './zipper'

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

test('every character of the cassettes (67 tmux, 56 fish, 56 bash, 55 claude) is one the Raster takes', async ($, on) => {
  expect(SHORTCUTS.length).toBe(67)
  expect(FISH.length).toBe(56)
  expect(BASH.length).toBe(56)
  expect(CLAUDE.length).toBe(55)
  const chars = [...new Set([...SHORTCUTS, ...FISH, ...BASH, ...CLAUDE].map(([keys, action]) => keys + action).join(''))].join('')
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

test('/zipper speed sets how many characters a second, keeps it in the store, and refuses what is out of range', async ($, on) => {
  mock.store(on)
  expect((await $.command.run(typed('speed'))).text).toBe('Zipper speed 2.3 characters a second.')
  expect((await $.command.run(typed('speed 4'))).text).toBe('Zipper speed 4 characters a second.')
  expect((await $.command.run(typed('speed'))).text).toBe('Zipper speed 4 characters a second.')
  for (const bad of ['speed 0.1', 'speed 100', 'speed fast', 'faster']) {
    expect((await $.command.run(typed(bad))).text).toContain('/zipper speed 0.5-20')
  }
})

test('a speed set in an earlier session is the one the zipper starts with', async ($, on) => {
  mock.store(on, { speed: 5 })
  expect((await $.command.run(typed('speed'))).text).toBe('Zipper speed 5 characters a second.')
})

test('/zipper <cassette> plays that cassette and turns the zipper on; an unknown name lists the cassettes', async ($, on) => {
  mock.store(on)
  const band = await $.ui.mount({ plugin: 'tmux-zipper', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  await $.command.run(typed('off'))
  expect((await $.command.run(typed('fish'))).text).toBe('Playing the fish cassette.')
  await band.redraw()
  expect(await band.find({ key: 'zipper' })).toBeDefined()
  expect((await $.command.run(typed('bash'))).text).toBe('Playing the bash cassette.')
  expect((await $.command.run(typed('claude'))).text).toBe('Playing the claude cassette.')
  expect((await $.command.run(typed('list'))).text).toBe('Cassettes: tmux, fish, bash, claude.')
  expect((await $.command.run(typed('help'))).text).toContain('/zipper speed 0.5-20')
  expect((await $.command.run(typed('tmux'))).text).toBe('Playing the tmux cassette.')
  for (const bad of ['jazz', 'constructor']) expect((await $.command.run(typed(bad))).text).toContain('/zipper tmux|fish|bash|claude to play a cassette')
  await band.unmount()
})

// The text the mounted zipper shows, read from its Raster's cells.
const shown = async (band: { find: (q: { key: string }) => Promise<{ props: Record<string, unknown> } | undefined> }) => {
  const cells = cellsOf(String((await band.find({ key: 'zipper' }))?.props.cells))
  return String.fromCodePoint(...cells.filter((_, i) => i % 3 === 0))
}

test('/zipper update claude rebuilds that cassette from the built-in commands, made plain; the others have no live source', async ($, on) => {
  mock.store(on)
  on('command.list', async () => ({
    value: [
      { name: 'clear', description: 'Start fresh … it’s “new”\n中', source: 'builtin' as const },
      { name: 'zipper', description: 'A plugin command', source: 'plugin' as const },
    ],
  }))
  const band = await $.ui.mount({ plugin: 'tmux-zipper', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  expect((await $.command.run(typed('update claude'))).text).toBe('Updated the claude cassette to 1 commands; playing it.')
  await band.redraw()
  expect(await shown(band)).toContain(`/clear  Start fresh ... it's "new" ?`)
  expect((await $.command.run(typed('update fish'))).text).toBe('The fish cassette has no live source; it updates with the plugin.')
  for (const bad of ['update', 'update jazz']) expect((await $.command.run(typed(bad))).text).toContain('/zipper update claude to refresh')
  await band.unmount()
})

test('a claude cassette updated in an earlier session is the one /zipper claude plays', async ($, on) => {
  mock.store(on, { claude: [['/old', 'Kept from before']] })
  const band = await $.ui.mount({ plugin: 'tmux-zipper', surface: 'terminal', component: 'AbovePrompt', props: BAND_PROPS })
  await $.command.run(typed('claude'))
  await band.redraw()
  expect(await shown(band)).toContain('/old  Kept from before')
  await band.unmount()
})
