import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { buildTape, frame, ROWS } from './zipper'

const KEY = 'zipper'
const isOn = atom({ plugin: 'tmux-zipper', key: 'isOn' } as const, true)
const STEP_MS = 50 // half a bulb per step: 10 bulb columns a second, in steps half a cell wide

export const register: Register = on => {
  const tape = buildTape()
  let half = 0 // how far into the tape, in half-bulbs
  // The band the zipper is mounted in, or null while it is dark (a turn running, a survey, too little room).
  let site: { requestId: string; columns: number } | null = null
  let refused = 0 // blits refused in a row: the band was collapsed or let go without a redraw

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'zipper',
      description: 'Turn the tmux zipper above the prompt on or off',
      argumentHint: '[on|off]',
    })
    $.clock.every(STEP_MS, () => {
      if (!site) return
      half = (half + 1) % (2 * tape.masks.length)
      $.ui
        .blit({ requestId: site.requestId, key: KEY, cells: frame(tape, half, site.columns) })
        .then(result => {
          refused = 'deny' in result ? refused + 1 : 0
          if (refused >= 20) site = null // a second of refusals; the next draw sets it again
        })
        .catch(() => {})
    })

    return next(e)
  })

  on('command.run', { command: 'zipper' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: 'Use /zipper to switch it, or /zipper on or /zipper off.' }
    const now = await update($, isOn, was => (arg === '' ? !was : arg === 'on'))

    return { text: now ? 'Zipper on.' : 'Zipper off.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e) // a desktop client's band leaves the terminal's zipper alone
    const { isWorking, hasSurvey, maxRows, bodyColumns } = e.props
    if (!(await read($, isOn)) || isWorking || hasSurvey || maxRows < ROWS || bodyColumns < 20) {
      site = null
      return next(e)
    }
    const { Raster } = $.ui.resolve(e)
    const columns = Math.min(512, bodyColumns)
    site = { requestId: e.requestId, columns }
    refused = 0

    return <Raster key={KEY} columns={columns} rows={ROWS} cells={frame(tape, half, columns)} />
  })
}
