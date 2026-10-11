// Server-only: the emails the app sends, in the app's own look.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { InlineImage } from './mail'

/**
 * The mark, embedded in every mail: the favicon rendered to PNG (`public/icon-192.png`). Embedded
 * rather than linked, so it shows wherever the app runs, localhost included, and mail clients do
 * not take SVG. Read once.
 */
let mark: InlineImage | undefined
function appMark(): InlineImage {
  mark ??= {
    cid: 'app-mark',
    filename: 'plates.png',
    contentType: 'image/png',
    content: readFileSync(join(process.cwd(), 'public', 'icon-192.png')).toString('base64'),
  }
  return mark
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * The app's light look, as plain colours: email clients ignore stylesheets and web fonts, so the
 * tokens are written out and Barlow falls back to the system sans.
 */
const C = {
  page: '#f3f5f7',
  card: '#ffffff',
  ink: '#1e2a36',
  muted: '#5f6b76',
  border: '#d6dce2',
  pull: '#1f5fc2',
}
const FONT = "'Barlow', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const CONDENSED = "'Barlow Condensed', 'Arial Narrow', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

export interface AppMail {
  subject: string
  text: string
  html: string
  inline: InlineImage[]
}

/** The frame every mail shares: the mark and the name, a white card, a one-line footer. */
function frame(subject: string, preview: string, card: string, footer: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${C.page};">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;">
<tr><td style="padding:0 4px 20px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="width:28px;height:28px;"><img src="cid:app-mark" width="28" height="28" alt="" style="display:block;width:28px;height:28px;border-radius:6px;"></td>
    <td style="padding-left:10px;font-family:${CONDENSED};font-size:18px;font-weight:600;color:${C.ink};line-height:28px;">Plates</td>
  </tr></table>
</td></tr>
<tr><td style="background:${C.card};border:1px solid ${C.border};border-radius:12px;padding:28px 28px 24px;">
${card}
</td></tr>
<tr><td style="padding:16px 4px 0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};">${footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

const h1 = (text: string) =>
  `<h1 style="margin:0;font-family:${CONDENSED};font-size:34px;line-height:36px;font-weight:600;color:${C.ink};">${text}</h1>`
const line = (text: string) =>
  `<p style="margin:12px 0 0;font-family:${FONT};font-size:16px;line-height:24px;color:${C.muted};">${text}</p>`

/** The sign-in link: one line, one button, the link as text for clients that strip buttons. */
export function signInMail(url: string, minutes: number): AppMail {
  const safeUrl = escapeHtml(url)
  const subject = 'Your sign-in link for Plates'
  const text = `Sign in to Plates:\n${url}\n\nThe link works for ${minutes} minutes, on the device you open it on. If you did not ask for it, ignore this email.`
  const card = `${h1('Sign in')}
  ${line(`Open this on the device you want to use. The link works for ${minutes} minutes.`)}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;"><tr>
    <td style="border-radius:8px;background:${C.ink};">
      <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:#ffffff;text-decoration:none;border-radius:8px;">Sign in</a>
    </td>
  </tr></table>
  <p style="margin:24px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:${C.muted};word-break:break-all;">Or paste this into your browser:<br><a href="${safeUrl}" style="color:${C.pull};text-decoration:underline;">${safeUrl}</a></p>`
  const html = frame(
    subject,
    `Your sign-in link, good for ${minutes} minutes.`,
    card,
    'If you did not ask for this, ignore it. Nothing changes until the link is opened.',
  )
  return { subject, text, html, inline: [appMark()] }
}

/** The sign-up code: the six digits, big, and how long they last. */
export function codeMail(code: string, minutes: number): AppMail {
  const digits = escapeHtml(code)
  const subject = `${code} is your Plates code`
  const text = `Your Plates code is ${code}. It works for ${minutes} minutes. If you did not ask for it, ignore this email.`
  const card = `${h1('Your code')}
  ${line(`Type it on the sign-up screen. It works for ${minutes} minutes.`)}
  <p style="margin:20px 0 0;font-family:${CONDENSED};font-size:44px;line-height:48px;font-weight:600;letter-spacing:8px;color:${C.ink};">${digits}</p>`
  const html = frame(
    subject,
    `${code} is your code, good for ${minutes} minutes.`,
    card,
    'If you did not ask for this, ignore it. Nothing happens without the code.',
  )
  return { subject, text, html, inline: [appMark()] }
}
