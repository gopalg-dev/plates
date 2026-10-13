import { useState } from 'react'
import type { LoggedSet, WorkoutEntry } from '#/lib/types'
import { completeSet } from './exercise-row'

/** Where a change to an exercise's sets goes: saved at once (a tick) or soon after (a number being stepped). */
export type SaveSets = (exerciseId: string, sets: LoggedSet[], immediate: boolean) => void

/**
 * A session's sets as the lifter works through them: the numbers, the ticks, a set added or dropped, and which
 * exercise is open. Today saves every change through `save`; the demo on How it works keeps them on the page.
 */
export function useSessionSets(initial: WorkoutEntry[], save?: SaveSets) {
  const [entries, setEntries] = useState<WorkoutEntry[]>(initial)
  const [openId, setOpenId] = useState<string | null>(
    () => initial.find((e) => e.sets.some((s) => !s.done))?.exerciseId ?? null,
  )

  function updateSets(exerciseId: string, mutate: (sets: LoggedSet[]) => LoggedSet[], immediate = false) {
    const next = entries.map((e) => (e.exerciseId === exerciseId ? { ...e, sets: mutate(e.sets) } : e))
    setEntries(next)
    const entry = next.find((e) => e.exerciseId === exerciseId)
    if (entry) save?.(exerciseId, entry.sets, immediate)
  }

  /** Opens the next exercise with something left to do, once this one is finished with. */
  function advanceFrom(exerciseId: string) {
    const following = entries.find((e) => e.exerciseId !== exerciseId && e.sets.some((s) => !s.done))
    setOpenId(following?.exerciseId ?? null)
  }

  function changeSet(exerciseId: string, index: number, patch: Partial<LoggedSet>) {
    updateSets(exerciseId, (sets) => sets.map((s, i) => (i === index ? { ...s, ...patch } : s)))
    // The reps-left answer on the last set is the last thing to do on a weight exercise.
    const entry = entries.find((e) => e.exerciseId === exerciseId)
    if (patch.left !== undefined && entry?.sets.every((s) => s.done)) advanceFrom(exerciseId)
  }

  function toggleDone(exerciseId: string, index: number) {
    const entry = entries.find((e) => e.exerciseId === exerciseId)
    if (!entry) return
    const nowDone = !entry.sets[index].done
    updateSets(exerciseId, (sets) => completeSet(entry, sets, index), true)
    if (!nowDone) return
    const allDone = entry.sets.every((s, i) => i === index || s.done)
    // A weight exercise stays open after its last set so the reps-left question can be answered.
    if (allDone && entry.loadType !== 'weight') advanceFrom(exerciseId)
  }

  function addSet(exerciseId: string) {
    updateSets(exerciseId, (sets) => {
      const last = sets[sets.length - 1]
      return [...sets, { ...last, done: false }]
    })
  }

  function removeSet(exerciseId: string) {
    updateSets(exerciseId, (sets) => (sets.length > 1 && !sets[sets.length - 1].done ? sets.slice(0, -1) : sets), true)
  }

  const totalSets = entries.reduce((n, e) => n + e.sets.length, 0)
  const doneSets = entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0)

  return { entries, setEntries, openId, setOpenId, changeSet, toggleDone, addSet, removeSet, doneSets, totalSets }
}

export type SessionSets = ReturnType<typeof useSessionSets>
