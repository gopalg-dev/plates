import { dayColourVar, SAME_KIND_WASH, SPLIT_WEDGE } from '#/components/app/day-mark'
import type { PeriodKind, Tone } from './logic/report'
import type { ShareCardContent } from './logic/share-card'
import { THEME_OPTIONS } from './theme'

/*
 * Draws the share card: a 1080 × 1350 PNG of a report's highlights in one of the app's looks, with the look's own
 * colours and type. Browser only: it reads the looks' tokens from the stylesheet and draws on a canvas.
 */

const CARD_WIDTH = 1080
const CARD_HEIGHT = 1350
const MARGIN = 72
const INNER = CARD_WIDTH - 2 * MARGIN

/** The tokens a card is drawn with, read from the stylesheet for each look. */
const TOKENS = [
  '--card',
  '--background',
  '--foreground',
  /** Not drawn on the card: the look's accent, for the swatch that picks it. */
  '--primary',
  '--muted',
  '--muted-foreground',
  '--border',
  '--success',
  '--day-push',
  '--day-pull',
  '--day-legs',
  '--day-push-ink',
  '--day-pull-ink',
  '--day-legs-ink',
  '--font-condensed',
  '--font-sans',
] as const
type Token = (typeof TOKENS)[number]

export interface CardTheme {
  id: string
  label: string
  tokens: Record<Token, string>
}

/**
 * Every look as a card theme: the slate default in light and dark, and the others. The looks are set on the
 * document, so each is applied for a moment and read back; it all happens before the browser paints again, so
 * nothing flickers.
 */
export function cardThemes(): CardTheme[] {
  const html = document.documentElement
  const saved = { theme: html.dataset.theme, dark: html.classList.contains('dark') }
  const looks = [
    { id: 'slate', label: 'Slate', theme: 'system', dark: false },
    { id: 'slate-dark', label: 'Slate dark', theme: 'system', dark: true },
    ...THEME_OPTIONS.filter((o) => o.value !== 'system').map((o) => ({
      id: o.value,
      label: o.label,
      theme: o.value,
      dark: o.dark,
    })),
  ]
  const out = looks.map((look) => {
    html.dataset.theme = look.theme
    html.classList.toggle('dark', look.dark)
    const style = getComputedStyle(html)
    const tokens = Object.fromEntries(TOKENS.map((t) => [t, style.getPropertyValue(t).trim()])) as Record<Token, string>
    return { id: look.id, label: look.label, tokens }
  })
  if (saved.theme === undefined) delete html.dataset.theme
  else html.dataset.theme = saved.theme
  html.classList.toggle('dark', saved.dark)
  return out
}

/** The card theme matching the look on screen now. */
export function currentCardTheme(): string {
  const html = document.documentElement
  const theme = html.dataset.theme ?? 'system'
  if (theme !== 'system') return theme
  return html.classList.contains('dark') ? 'slate-dark' : 'slate'
}

/** A `var(--x)` from day-mark resolved against a theme's tokens. */
function resolve(cssVar: string, tokens: CardTheme['tokens']): { fill: string; ink: string } {
  const name = cssVar.replace(/^var\((--[a-z-]+)\)$/, '$1') as Token
  if (name.startsWith('--day-')) return { fill: tokens[name], ink: tokens[`${name}-ink` as Token] }
  return { fill: tokens['--muted-foreground'], ink: tokens['--background'] }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  roundRectPath(ctx, x, y, w, h, r)
  ctx.fill()
}

/** A font size for `text` that fits `width`, down from `size` in steps, never below `min`. */
function fitting(ctx: CanvasRenderingContext2D, text: string, face: string, size: number, min: number, width: number) {
  let s = size
  for (; s > min; s -= 4) {
    ctx.font = `600 ${s}px ${face}`
    if (ctx.measureText(text).width <= width) break
  }
  ctx.font = `600 ${s}px ${face}`
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

async function loadMark(): Promise<HTMLImageElement> {
  const img = new Image()
  img.src = '/favicon.svg'
  await img.decode()
  return img
}

/**
 * Draws the card for one look and gives back the PNG. The who, the days and the sessions hang from the top; the
 * win and the bodyweight stand on the bottom margin; the room between them is what the content leaves.
 */
export async function drawShareCard(content: ShareCardContent, kind: PeriodKind, theme: CardTheme): Promise<Blob> {
  const t = theme.tokens
  const condensed = t['--font-condensed']
  const sans = t['--font-sans']
  const toneColour: Record<Tone, string> = {
    up: t['--success'],
    down: t['--muted-foreground'],
    same: t['--muted-foreground'],
  }
  const [mark] = await Promise.all([
    loadMark(),
    document.fonts.load(`600 96px ${condensed}`).catch(() => []),
    document.fonts.load(`400 40px ${sans}`).catch(() => []),
    document.fonts.load(`500 40px ${sans}`).catch(() => []),
  ])

  const canvas = document.createElement('canvas')
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No canvas')
  ctx.fillStyle = t['--card']
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)
  ctx.textBaseline = 'alphabetic'

  // The wordmark.
  ctx.drawImage(mark, MARGIN, MARGIN, 56, 56)
  ctx.fillStyle = t['--foreground']
  ctx.font = `500 40px ${condensed}`
  ctx.fillText('Plates', MARGIN + 72, MARGIN + 44)

  // Whose period, and which.
  let y = MARGIN + 56 + 104
  ctx.fillStyle = t['--foreground']
  fitting(ctx, content.who, condensed, 80, 48, INNER)
  ctx.fillText(content.who, MARGIN, y)
  y += 52
  ctx.fillStyle = t['--muted-foreground']
  ctx.font = `500 36px ${sans}`
  ctx.fillText(content.title, MARGIN, y)

  // The days, the full width: a strip of squares for a week, a grid of wider, shorter cells for a month.
  y += 76
  const week = kind === 'week'
  const gap = week ? 14 : 10
  const cell = Math.floor((INNER - 6 * gap) / 7)
  const tall = week ? cell : 76
  ctx.font = `500 26px ${sans}`
  ctx.fillStyle = t['--muted-foreground']
  ctx.textAlign = 'center'
  for (let i = 0; i < 7; i++) ctx.fillText(WEEKDAYS[i], MARGIN + i * (cell + gap) + cell / 2, y)
  y += 16
  const lead = week ? 0 : (content.days[0].date.getDay() + 6) % 7
  let row = 0
  content.days.forEach((d, i) => {
    const slot = i + lead
    const col = slot % 7
    row = Math.floor(slot / 7)
    const x = MARGIN + col * (cell + gap)
    const top = y + row * (tall + gap)
    const paint = d.dayType ? resolve(dayColourVar(d.dayType), t) : { fill: t['--muted'], ink: t['--muted-foreground'] }
    ctx.fillStyle = paint.fill
    roundRect(ctx, x, top, cell, tall, week ? 20 : 14)
    // A second session that day: its colour as a bottom-right wedge, the same cut as the calendars on screen; the
    // same kind twice, a light wash over the corner instead.
    if (d.dayTypes.length > 1) {
      const second = dayColourVar(d.dayTypes[1])
      ctx.save()
      roundRectPath(ctx, x, top, cell, tall, week ? 20 : 14)
      ctx.clip()
      ctx.fillStyle = second === dayColourVar(d.dayTypes[0]) ? SAME_KIND_WASH : resolve(second, t).fill
      ctx.beginPath()
      ctx.moveTo(x + cell, top + tall)
      ctx.lineTo(x + cell * (1 - 2 * SPLIT_WEDGE), top + tall)
      ctx.lineTo(x + cell, top + tall * (1 - 2 * SPLIT_WEDGE))
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = paint.ink
    ctx.font = `600 ${week ? 52 : 34}px ${condensed}`
    ctx.fillText(String(d.date.getDate()), x + cell / 2, top + tall / 2 + (week ? 18 : 12))
  })
  ctx.textAlign = 'left'
  y += (row + 1) * (tall + gap) + 96

  // The sessions, and how they moved when the period before had any.
  ctx.fillStyle = t['--foreground']
  ctx.font = `600 84px ${condensed}`
  ctx.fillText(content.sessions.value, MARGIN, y)
  const numberWidth = ctx.measureText(content.sessions.value).width
  ctx.font = `400 40px ${sans}`
  ctx.fillText(content.sessions.label, MARGIN + numberWidth + 20, y)
  if (content.sessions.change) {
    ctx.fillStyle = toneColour[content.sessions.tone]
    ctx.font = `400 30px ${sans}`
    ctx.fillText(content.sessions.change, MARGIN, y + 46)
  }

  // From the bottom up: the bodyweight line, then the win.
  let b = CARD_HEIGHT - MARGIN
  if (content.bodyweight) {
    ctx.font = `400 34px ${sans}`
    ctx.fillStyle = t['--foreground']
    ctx.fillText(content.bodyweight.value, MARGIN, b)
    const w = ctx.measureText(content.bodyweight.value).width
    ctx.fillStyle = t['--muted-foreground']
    ctx.fillText(` ${content.bodyweight.label}`, MARGIN + w, b)
    if (content.bodyweight.change) {
      const w2 = ctx.measureText(` ${content.bodyweight.label}`).width
      ctx.fillStyle = toneColour[content.bodyweight.tone]
      ctx.fillText(`  ${content.bodyweight.change}`, MARGIN + w + w2, b)
    }
    b -= 72
  }
  if (content.win) {
    ctx.fillStyle = t['--foreground']
    ctx.font = `400 44px ${sans}`
    ctx.fillText(content.win.small, MARGIN, b)
    b -= 64
    fitting(ctx, content.win.big, condensed, 108, 56, INNER)
    ctx.fillText(content.win.big, MARGIN, b)
    b -= 112
    ctx.fillStyle = t['--muted-foreground']
    ctx.font = `500 30px ${sans}`
    ctx.fillText(content.win.caption, MARGIN, b)
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No image'))), 'image/png')
  })
}
