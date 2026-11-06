import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { buildTape, frame, ROWS } from './zipper'

const KEY = 'zipper'
const isOn = atom({ plugin: 'tmux-zipper', key: 'isOn' } as const, true)
const STEP_MS = 110 // one character per step: about 9 a second, between a stutter (150) and a blur (80)

export const register: Register = on => {
  const tape = buildTape()
  const loop = tape.codePoints.length // the tape's length in characters
  let step = 0 // how far into the tape, in characters
  // The band the zipper is mounted in, or null while it is dark (switched off, a survey, too little room).
  let site: { requestId: string; columns: number } | null = null
  let refused = 0 // blits refused in a row: the band was collapsed or let go without a redraw

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'zipper',
      description: 'Turn the tmux zipper above the prompt on or off',
      argumentHint: '[on|off]',
    })
    // Start where the tape would be had it run since the session began, so a reload picks up in place.
    const { startedAt } = await $.session.usage()
    step = Math.floor(((await $.clock.now()) - startedAt) / STEP_MS) % loop
    $.clock.every(STEP_MS, () => {
      step = (step + 1) % loop // the tape runs while dark too, matching the clock a reload reads
      if (!site) return
      $.ui
        .blit({ requestId: site.requestId, key: KEY, cells: frame(tape, step, site.columns) })
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
    const { hasSurvey, maxRows, bodyColumns } = e.props
    if (!(await read($, isOn)) || hasSurvey || maxRows < ROWS || bodyColumns < 20) {
      site = null
      return next(e)
    }
    const { Raster } = $.ui.resolve(e)
    const columns = Math.min(512, bodyColumns)
    site = { requestId: e.requestId, columns }
    refused = 0

    return <Raster key={KEY} columns={columns} rows={ROWS} cells={frame(tape, step, columns)} />
  })
}
