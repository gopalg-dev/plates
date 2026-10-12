import { Link, createFileRoute } from '@tanstack/react-router'
import { AuthFrame } from '#/components/app/auth-frame'
import { pageTitle } from '#/lib/page-title'

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [{ title: pageTitle('Privacy') }] }),
  component: PrivacyPage,
})

const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'What is stored',
    body:
      'Your email address, a username and display name if you set one, your settings, your plan, and what you log: ' +
      'sessions with their sets, weigh-ins and tape measurements, and any feedback you send. Passwords are stored as a hash that cannot be ' +
      'read back.',
  },
  {
    title: 'What it is used for',
    body:
      'Showing you your own plan, stats and targets, and signing you in. Mail goes out only when you send feedback and a ' +
      'copy is set up to be delivered. There is no advertising, no analytics tracking, and no profile of you beyond what you log.',
  },
  {
    title: 'Who can see it',
    body:
      'You. Your data is never sold, shared, or passed to another service, except Google when you sign in with it, the ' +
      'mail provider that delivers a copy of feedback you send, and the database host that stores it. Nobody else has ' +
      'an account that can read yours.',
  },
  {
    title: 'Taking it with you',
    body:
      'Stats has a Download Excel and a Download CSV button that give you every set, weigh-in and measurement, built ' +
      'in your browser from your own data.',
  },
  {
    title: 'Deleting it',
    body:
      'Settings has a Delete account button. It removes your account and every trace of your data from the database ' +
      'at once: account, sessions, settings, plans, logs, and any sign-in mail still waiting. There is no recovery. ' +
      'The only thing kept is one line in a deletion log: the date, a one-way hash of the email address, and how ' +
      'many sessions were removed. That line holds nothing that can be traced back to you.',
  },
]

function PrivacyPage() {
  return (
    <AuthFrame
      title="Privacy"
      intro="Your logbook is yours. Nothing is shared."
      footer={
        <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="flex flex-col gap-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="font-condensed text-2xl font-semibold leading-none">{s.title}</h2>
            <p className="mt-3 text-muted-foreground">{s.body}</p>
          </section>
        ))}
      </div>
    </AuthFrame>
  )
}
