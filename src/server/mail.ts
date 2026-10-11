import { getDb } from './db'

export interface Mail {
  to: string
  subject: string
  text: string
  html: string
  /** The link inside the mail, kept with the outbox copy so a test can follow it. */
  link?: string
  /** The one-time code inside the mail, kept with the outbox copy so a test can type it. */
  code?: string
  /** Images embedded in the mail, referenced from the HTML as `cid:<cid>`. */
  inline?: InlineImage[]
}

export interface InlineImage {
  cid: string
  filename: string
  contentType: string
  /** Base64. */
  content: string
}

/**
 * Sends through Resend when RESEND_API_KEY is set.
 * Without a provider (development, tests) the mail is printed to the server console and kept in
 * the `mail_outbox` collection, so the link can still be followed.
 */
export async function sendMail(mail: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (key) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? 'Plates <onboarding@resend.dev>',
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: mail.inline?.map((i) => ({
          filename: i.filename,
          content: i.content,
          content_type: i.contentType,
          content_id: i.cid,
        })),
      }),
    })
    if (!res.ok) {
      // Resend says why: an unverified sender domain, a free account sending to someone else, a bad key.
      const body = (await res.json().catch(() => null)) as { message?: string } | null
      const why = body?.message ? `: ${body.message}` : ''
      console.error(`[mail] Resend answered ${res.status}${why}`)
      throw new Error(`The mail provider answered ${res.status}${why}`)
    }
    return
  }
  console.info(`[mail] to ${mail.to}: ${mail.subject}\n${mail.text}`)
  const db = await getDb()
  // The outbox keeps the words, not the embedded images.
  const { inline: _inline, ...copy } = mail
  await db.collection('mail_outbox').insertOne({ ...copy, sentAt: new Date().toISOString() })
}
