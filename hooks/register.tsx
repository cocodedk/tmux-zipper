import { atom, read, update } from 'claude-code'
import type { CoreEngineInterface, Register, Timer } from 'claude-code'

import {
  DEFAULT_SPEED,
  GIVE_UP_MS,
  KEY,
  MAX_COLUMNS,
  MAX_SPEED,
  MIN_COLUMNS,
  MIN_SPEED,
  ROWS,
  SPEED_KEY,
} from './constants'
import { buildTape, frame } from './zipper'

const isOn = atom({ plugin: 'tmux-zipper', key: 'isOn' } as const, true)
const USAGE = `Use /zipper to switch it, /zipper on or /zipper off, or /zipper speed ${MIN_SPEED}-${MAX_SPEED} (characters a second).`
const TAPE = buildTape()
const LENGTH = TAPE.codePoints.length

// The zipper's running state, made fresh by each register.
type Zipper = {
  step: number // how far into the tape, in characters
  // The band the zipper is mounted in, or null while it is dark (switched off, a survey, too little room).
  site: { requestId: string; columns: number } | null
  refused: number // blits refused in a row: the band was collapsed or let go without a redraw
  timer: Timer | null
}

const speedText = (speed: number) => `Zipper speed ${speed} characters a second.`

async function speedOf($: Pick<CoreEngineInterface, 'store'>): Promise<number> {
  const speed = await $.store.get(SPEED_KEY)
  return typeof speed === 'number' ? speed : DEFAULT_SPEED
}

// (Re)starts the tape at `speed` characters a second.
function run($: Pick<CoreEngineInterface, 'clock' | 'ui'>, z: Zipper, speed: number): void {
  const giveUpAfter = Math.max(1, Math.ceil((GIVE_UP_MS * speed) / 1000)) // GIVE_UP_MS in ticks at this speed
  z.timer?.cancel()
  z.timer = $.clock.every(1000 / speed, () => {
    z.step = (z.step + 1) % LENGTH // the tape runs while dark too, matching the clock a reload reads
    const site = z.site
    if (!site) return
    $.ui
      .blit({ requestId: site.requestId, key: KEY, cells: frame(TAPE, z.step, site.columns) })
      .then(result => {
        z.refused = 'deny' in result ? z.refused + 1 : 0
        if (z.refused >= giveUpAfter) z.site = null
      })
      .catch(() => {})
  })
}

export const register: Register = on => {
  const z: Zipper = { step: 0, site: null, refused: 0, timer: null }

  on('session.start', async ($, e, next) => {
    // Start where the tape would be had it run since the session began, so a reload picks up in place.
    const [speed, { startedAt }, now] = await Promise.all([
      speedOf($),
      $.session.usage(),
      $.clock.now(),
      $.command.register({
        name: 'zipper',
        description: 'Turn the tmux zipper above the prompt on or off, or set its speed',
        argumentHint: '[on|off|speed <n>]',
      }),
    ])
    z.step = Math.floor(((now - startedAt) * speed) / 1000) % LENGTH
    run($, z, speed)

    return next(e)
  })

  on('command.run', { command: 'zipper' }, async ($, e) => {
    const [arg = '', value] = e.args.trim().toLowerCase().split(/\s+/)
    if (arg === 'speed') {
      if (value === undefined) return { text: speedText(await speedOf($)) }
      const speed = Number(value)
      if (!(speed >= MIN_SPEED && speed <= MAX_SPEED)) return { text: USAGE }
      await $.store.set(SPEED_KEY, speed)
      run($, z, speed)
      return { text: speedText(speed) }
    }
    if (arg !== '' && arg !== 'on' && arg !== 'off') return { text: USAGE }
    const now = await update($, isOn, was => (arg === '' ? !was : arg === 'on'))

    return { text: now ? 'Zipper on.' : 'Zipper off.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal') return next(e) // a desktop client's band leaves the terminal's zipper alone
    const { hasSurvey, maxRows, bodyColumns } = e.props
    if (!(await read($, isOn)) || hasSurvey || maxRows < ROWS || bodyColumns < MIN_COLUMNS) {
      z.site = null
      return next(e)
    }
    const { Raster } = $.ui.resolve(e)
    const columns = Math.min(MAX_COLUMNS, bodyColumns)
    z.site = { requestId: e.requestId, columns }
    z.refused = 0

    return <Raster key={KEY} columns={columns} rows={ROWS} cells={frame(TAPE, z.step, columns)} />
  })
}
