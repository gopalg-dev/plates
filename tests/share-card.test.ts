import { describe, expect, it } from 'vitest'
import { daysOf, finishedPeriod, type Report } from '#/lib/logic/report'
import { highlights, shareCardContent, shareCardFileName } from '#/lib/logic/share-card'

// Tuesday 13 October 2026.
const now = new Date(2026, 9, 13, 18)
const week = finishedPeriod('week', new Date(2026, 9, 7), now)
const month = finishedPeriod('month', new Date(2026, 8, 15), now)

function best(name: string, weight: number, reps: number, score = weight * reps): Report['bests'][number] {
  return {
    exerciseId: name.toLowerCase().replace(/ /g, '-'),
    name,
    loadType: 'weight',
    date: '2026-10-07T18:00:00Z',
    weight,
    reps,
    seconds: 0,
    score,
  }
}

const report: Report = {
  enough: true,
  sessions: { done: 5, prev: 6, planned: 6 },
  sets: { now: 110, prev: 102 },
  bests: [best('Rope Pushdown', 35, 10), best('Hack Squat', 90, 12), best('Face Pull', 45, 13)],
  prevBestCount: 4,
  streak: 3,
  movers: [],
  bodyweight: { from: 72.4, to: 72.6 },
  attention: { stuck: [], slipping: [], under: [], tooMuch: 0, deload: false },
  muscles: [],
  effort: { counts: [0, 3, 2, 0], prevCounts: [1, 3, 2, 0] },
}

describe('share card', () => {
  it('says whose period it is, and the sessions with their change', () => {
    const card = shareCardContent(report, week, daysOf(week, []), 'kg', 'Sam')
    expect(card.who).toBe("Sam's week")
    expect(card.title).toBe('Oct 5 – 11')
    expect(card.sessions).toEqual({
      value: '5',
      label: 'of 6 sessions',
      change: '▼ 1 vs the week before',
      tone: 'down',
    })
    expect(card.days).toHaveLength(7)
    const sept = shareCardContent(report, month, daysOf(month, []), 'kg', 'Sam')
    expect(sept.who).toBe("Sam's month")
    expect(sept.title).toBe('September 2026')
  })

  it('leaves the change out when the period before had no sessions', () => {
    const first = shareCardContent({ ...report, sessions: { done: 5, prev: 0, planned: 6 } }, week, [], 'kg', 'Sam')
    expect(first.sessions).toEqual({ value: '5', label: 'of 6 sessions', tone: 'same' })
  })

  it('offers the highlights best first: the count, each best heaviest first, the streak, nothing', () => {
    expect(highlights(report, week, 'kg').map((h) => [h.id, h.label])).toEqual([
      ['bests', '3 new bests'],
      ['best:hack-squat', 'Hack Squat 90 kg × 12'],
      ['best:face-pull', 'Face Pull 45 kg × 13'],
      ['best:rope-pushdown', 'Rope Pushdown 35 kg × 10'],
      ['streak', '3 weeks in a row'],
      ['none', 'Nothing'],
    ])
    expect(highlights(report, week, 'kg')[0].win).toEqual({
      caption: 'New bests',
      big: '3',
      small: 'new bests this week',
    })
    expect(highlights(report, week, 'kg')[1].win).toEqual({
      caption: 'New best',
      big: 'Hack Squat',
      small: '90 kg × 12',
    })
  })

  it('offers every session done when the plan was met, and no count for a single best', () => {
    const met = { ...report, bests: [best('Bench', 60, 8)], streak: 1, sessions: { done: 6, prev: 6, planned: 6 } }
    expect(highlights(met, month, 'kg').map((h) => h.label)).toEqual([
      'Bench 60 kg × 8',
      'All sessions done',
      'Nothing',
    ])
    expect(highlights(met, month, 'kg')[1].win).toEqual({ caption: 'Sessions', big: 'All done', small: '6 of 6' })
    expect(highlights({ ...met, bests: [], sessions: { done: 4, prev: 0, planned: 6 } }, week, 'kg')).toEqual([
      { id: 'none', label: 'Nothing', win: null },
    ])
  })

  it('draws the picked highlight, the first one until picked or when the pick is unknown', () => {
    expect(shareCardContent(report, week, [], 'kg', 'Sam').win?.big).toBe('3')
    expect(shareCardContent(report, week, [], 'kg', 'Sam', { highlight: 'streak' }).win).toEqual({
      caption: 'Streak',
      big: '3',
      small: 'weeks in a row',
    })
    expect(shareCardContent(report, week, [], 'kg', 'Sam', { highlight: 'none' }).win).toBeNull()
    expect(shareCardContent(report, week, [], 'kg', 'Sam', { highlight: 'best:gone' }).win?.big).toBe('3')
  })

  it('adds bodyweight only when asked for, with its change only after an earlier weigh-in', () => {
    expect(shareCardContent(report, week, [], 'kg', 'Sam').bodyweight).toBeUndefined()
    expect(shareCardContent(report, week, [], 'kg', 'Sam', { bodyweight: true }).bodyweight).toEqual({
      value: '72.6 kg',
      label: 'bodyweight',
      change: '▲ 0.2 kg vs the week before',
      tone: 'up',
    })
    const firstWeighIn = shareCardContent({ ...report, bodyweight: { to: 72.6 } }, week, [], 'kg', 'Sam', {
      bodyweight: true,
    })
    expect(firstWeighIn.bodyweight).toEqual({ value: '72.6 kg', label: 'bodyweight', tone: 'same' })
    // Asked for but never weighed in: nothing to show.
    expect(
      shareCardContent({ ...report, bodyweight: null }, week, [], 'kg', 'Sam', { bodyweight: true }).bodyweight,
    ).toBeUndefined()
  })

  it('names the file by the period', () => {
    expect(shareCardFileName(week)).toBe('plates-week-2026-10-05.png')
    expect(shareCardFileName(month)).toBe('plates-month-2026-09.png')
  })
})
