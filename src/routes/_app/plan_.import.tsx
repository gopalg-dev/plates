import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { BookOpen, ChevronLeft, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { DayIcon } from '#/components/app/day-mark'
import { LibraryPicker } from '#/components/app/library-list'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import {
  GUIDE_LINES,
  TEMPLATE_HEADERS,
  parseRows,
  planToRows,
  splitFromMarker,
  templateMarker,
  templateTitle,
  type ParsedPlan,
  type SheetRow,
} from '#/lib/logic/plan-sheet'
import { buildSplitFrom, planSourceInfo, splitInfoOf, splitInfos } from '#/lib/content'
import { useContent } from '#/lib/use-content'
import { MUSCLES, MUSCLE_LABEL } from '#/lib/logic/stats'
import {
  DAY_TYPES,
  MAX_EXERCISES_PER_DAY,
  type DayType,
  type Exercise,
  type LoadType,
  type Muscle,
  type PlanDay,
  type SplitId,
} from '#/lib/types'
import { getPlanFn, replacePlanFn } from '#/server/fns'
import { DAY_LABEL } from '#/components/app/day-mark'
import { pageTitle } from '#/lib/page-title'
import { errorMessage } from '#/lib/format'

export const Route = createFileRoute('/_app/plan_/import')({
  head: () => ({ meta: [{ title: pageTitle('Bring your own plan') }] }),
  loader: () => getPlanFn(),
  component: ImportPage,
})

const LOAD_LABEL: Record<LoadType, string> = { weight: 'Weighted', bodyweight: 'Bodyweight', time: 'Timed hold' }

function ImportPage() {
  const { plan, settings } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const [parsed, setParsed] = useState<ParsedPlan | null>(null)
  const [fileName, setFileName] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  /** Which template to download: the plan as it is, or one of the split templates. */
  const { splits } = useContent()
  const [template, setTemplate] = useState<'current' | SplitId>('current')
  const currentSource = planSourceInfo(splits, settings.split, plan.days.length)

  async function downloadTemplate() {
    setBusy(true)
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const chosen = template === 'current' ? null : splitInfoOf(splits, template)
      const days = chosen ? buildSplitFrom(splits, chosen.id) : plan.days
      // The current plan carries its own template's marker, unless it is custom.
      const marker = chosen ?? (currentSource.custom ? null : currentSource)
      const ws = XLSX.utils.json_to_sheet(planToRows({ days }), { header: [...TEMPLATE_HEADERS] })
      // Keep the Reps column as text, so Excel leaves "6-10" alone instead of making it a date.
      const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
      const repsCol = TEMPLATE_HEADERS.indexOf('Reps')
      const lastRow = range.e.r + 40
      for (let r = 1; r <= lastRow; r++) {
        const addr = XLSX.utils.encode_cell({ r, c: repsCol })
        const cell = ws[addr] ?? { t: 's', v: '' }
        cell.t = 's'
        cell.z = '@'
        ws[addr] = cell
      }
      ws['!ref'] = XLSX.utils.encode_range({ s: range.s, e: { r: lastRow, c: range.e.c } })
      ws['!cols'] = [10, 7, 30, 6, 9, 11, 11, 40, 40].map((wch) => ({ wch }))
      XLSX.utils.book_append_sheet(wb, ws, 'Plan')
      const guide = XLSX.utils.aoa_to_sheet(marker ? [[templateTitle(marker)], ...GUIDE_LINES] : GUIDE_LINES)
      guide['!cols'] = [{ wch: 100 }]
      XLSX.utils.book_append_sheet(wb, guide, 'Guide')
      if (marker) {
        const tag = XLSX.utils.aoa_to_sheet(templateMarker(marker))
        tag['!cols'] = [{ wch: 8 }, { wch: 30 }]
        XLSX.utils.book_append_sheet(wb, tag, 'Template')
      }
      XLSX.writeFile(wb, marker ? `plates-template-${marker.id}.xlsx` : 'plates-template.xlsx')
    } catch (err) {
      toast.error(errorMessage(err, 'Could not build the template.'))
    } finally {
      setBusy(false)
    }
  }

  async function readFile(file: File) {
    setBusy(true)
    setFileName(file.name)
    try {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      // raw keeps "6-10" in a CSV as text. Real date cells in .xlsx still arrive as dates and get recovered.
      const wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: true })
      const sheet = wb.Sheets.Plan ?? wb.Sheets[wb.SheetNames[0]]
      if (!sheet) throw new Error('The file has no sheets.')
      const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, { defval: '', raw: true })
      // The marker names the template the file was downloaded as. A file without one is a custom plan.
      const cells = ['Template', 'Guide'].flatMap((name) => {
        const s = wb.Sheets[name]
        return s ? XLSX.utils.sheet_to_json<unknown[]>(s, { header: 1, defval: '' }) : []
      })
      setParsed({
        ...parseRows(rows),
        split: splitFromMarker(
          cells,
          splits.map((s) => s.id),
        ),
      })
    } catch (err) {
      toast.error(errorMessage(err, 'Could not read that file. Use .xlsx or .csv.'))
      setParsed(null)
    } finally {
      setBusy(false)
    }
  }

  function updateDay(i: number, patch: Partial<PlanDay>) {
    if (!parsed) return
    setParsed({ ...parsed, days: parsed.days.map((d, di) => (di === i ? { ...d, ...patch } : d)) })
  }

  function removeDay(i: number) {
    if (!parsed) return
    setParsed({ ...parsed, days: parsed.days.filter((_, di) => di !== i) })
  }

  function updateExercise(di: number, ei: number, patch: Partial<Exercise>) {
    if (!parsed) return
    setParsed({
      ...parsed,
      days: parsed.days.map((d, i) =>
        i === di ? { ...d, exercises: d.exercises.map((e, j) => (j === ei ? { ...e, ...patch } : e)) } : d,
      ),
    })
  }

  function removeExercise(di: number, ei: number) {
    if (!parsed) return
    setParsed({
      ...parsed,
      days: parsed.days.map((d, i) => (i === di ? { ...d, exercises: d.exercises.filter((_, j) => j !== ei) } : d)),
    })
  }

  function problems(): string | null {
    if (!parsed || parsed.days.length === 0) return 'Nothing to use yet.'
    for (const d of parsed.days) {
      if (!d.name.trim()) return 'Every day needs a name.'
      if (d.exercises.length === 0) return `${d.name} has no exercises. Remove the day or add rows in the sheet.`
      if (d.exercises.length > MAX_EXERCISES_PER_DAY) {
        return `${d.name} has ${d.exercises.length} exercises. A day holds up to ${MAX_EXERCISES_PER_DAY}, so remove some.`
      }
      for (const e of d.exercises) {
        if (!e.name.trim()) return `An exercise in ${d.name} has no name.`
        if (e.sets < 1) return `${e.name} needs at least 1 set.`
        if (e.repMin < 1 || e.repMax < e.repMin) return `${e.name} has a bad rep range.`
      }
    }
    return null
  }

  async function usePlan() {
    if (!parsed) return
    setBusy(true)
    try {
      await replacePlanFn({ data: { days: parsed.days, split: parsed.split } })
      toast.success('Plan replaced')
      setConfirmOpen(false)
      await router.invalidate()
      await navigate({ to: '/plan' })
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save the plan.'))
      setBusy(false)
    }
  }

  const problem = parsed ? problems() : null
  const exerciseCount = parsed?.days.reduce((n, d) => n + d.exercises.length, 0) ?? 0

  return (
    <div>
      <Link to="/plan" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden />
        Plan
      </Link>
      <h1 className="mt-3 font-condensed text-4xl font-semibold leading-none">Bring your own plan</h1>
      <p className="mt-2 text-muted-foreground">
        Download the template, fill it in Excel or Google Sheets, then upload it. The file is read on your device and
        nothing is saved until you confirm.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Select value={template} onValueChange={(v) => setTemplate(v as 'current' | SplitId)}>
          <SelectTrigger aria-label="Template" className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">
              {currentSource.custom ? 'Current plan' : `Current plan, ${currentSource.name}`}
            </SelectItem>
            {splitInfos(splits).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}, {s.days} {s.days === 1 ? 'day' : 'days'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={downloadTemplate} disabled={busy}>
          Download template
        </Button>
        <Button asChild disabled={busy}>
          <label htmlFor="plan-file" className="cursor-pointer">
            Upload a file
          </label>
        </Button>
        <input
          id="plan-file"
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void readFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {parsed && (
        <section className="mt-8" aria-labelledby="preview-h">
          <h2 id="preview-h" className="font-condensed text-2xl font-semibold leading-none">
            Preview
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {fileName}: {parsed.days.length} {parsed.days.length === 1 ? 'day' : 'days'}, {exerciseCount} exercises.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {parsed.split ? `Template: ${splitInfoOf(splits, parsed.split).name}.` : 'Custom plan.'}
          </p>

          {parsed.warnings.length > 0 && (
            <div className="mt-4 rounded-lg border px-3 py-2 text-sm">
              <p className="font-medium">Check these rows</p>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {parsed.warnings.map((w, i) => (
                  <li key={i}>
                    {w.row > 0 ? `Row ${w.row}: ` : ''}
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ol className="mt-4 flex flex-col gap-6">
            {parsed.days.map((day, di) => (
              <li key={day.id}>
                <div className="flex items-center gap-2">
                  <DayIcon type={day.type} className="size-8 rounded-md" />
                  <Input
                    aria-label={`Day ${di + 1} name`}
                    value={day.name}
                    onChange={(e) => updateDay(di, { name: e.target.value })}
                    className="h-9 max-w-48 font-condensed text-lg font-semibold"
                    maxLength={40}
                  />
                  <Select value={day.type} onValueChange={(v) => updateDay(di, { type: v as DayType })}>
                    <SelectTrigger aria-label={`Day ${di + 1} type`} className="h-9 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAY_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {DAY_LABEL[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="ml-auto text-muted-foreground"
                    aria-label={`Remove ${day.name}`}
                    onClick={() => removeDay(di)}
                  >
                    <X aria-hidden />
                  </Button>
                </div>

                <ol className="mt-2 divide-y border-y">
                  {day.exercises.map((ex, ei) => (
                    <li key={ex.id} className="py-2.5">
                      <div className="flex items-center gap-2">
                        <Input
                          aria-label={`${day.name} exercise ${ei + 1} name`}
                          value={ex.name}
                          onChange={(e) => updateExercise(di, ei, { name: e.target.value })}
                          className="h-9"
                          maxLength={80}
                        />
                        <LibraryPicker
                          onPick={(lib) =>
                            updateExercise(di, ei, { name: lib.name, muscle: lib.muscle, loadType: lib.loadType })
                          }
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0 text-muted-foreground"
                              aria-label={`Pick ${ex.name} from library`}
                            >
                              <BookOpen aria-hidden />
                            </Button>
                          }
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 text-muted-foreground"
                          aria-label={`Remove ${ex.name}`}
                          onClick={() => removeExercise(di, ei)}
                        >
                          <X aria-hidden />
                        </Button>
                      </div>
                      <div className="mt-2 grid grid-cols-6 gap-2 sm:grid-cols-[3.25rem_3.25rem_3.25rem_minmax(0,1fr)_minmax(0,1fr)]">
                        <Input
                          type="number"
                          inputMode="numeric"
                          aria-label={`${ex.name} sets`}
                          title="Sets"
                          min={1}
                          max={10}
                          value={ex.sets}
                          onChange={(e) => updateExercise(di, ei, { sets: Number(e.target.value) })}
                          className="col-span-2 h-9 px-2 text-center tabular-nums sm:col-span-1"
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          aria-label={`${ex.name} low`}
                          title={ex.loadType === 'time' ? 'Low, seconds' : 'Low, reps'}
                          min={1}
                          value={ex.repMin}
                          onChange={(e) => updateExercise(di, ei, { repMin: Number(e.target.value) })}
                          className="col-span-2 h-9 px-2 text-center tabular-nums sm:col-span-1"
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          aria-label={`${ex.name} high`}
                          title={ex.loadType === 'time' ? 'High, seconds' : 'High, reps'}
                          min={1}
                          value={ex.repMax}
                          onChange={(e) => updateExercise(di, ei, { repMax: Number(e.target.value) })}
                          className="col-span-2 h-9 px-2 text-center tabular-nums sm:col-span-1"
                        />
                        <Select
                          value={ex.loadType}
                          onValueChange={(v) => updateExercise(di, ei, { loadType: v as LoadType })}
                        >
                          <SelectTrigger
                            aria-label={`${ex.name} type`}
                            className="col-span-3 h-9 w-full px-2 text-sm sm:col-span-1"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(LOAD_LABEL) as LoadType[]).map((t) => (
                              <SelectItem key={t} value={t}>
                                {LOAD_LABEL[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={ex.muscle}
                          onValueChange={(v) => updateExercise(di, ei, { muscle: v as Muscle })}
                        >
                          <SelectTrigger
                            aria-label={`${ex.name} muscle`}
                            className="col-span-3 h-9 w-full px-2 text-sm sm:col-span-1"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MUSCLES.map((m) => (
                              <SelectItem key={m} value={m}>
                                {MUSCLE_LABEL[m]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">Columns: sets, low, high, type, muscle.</p>

          <div className="mt-6 flex items-center gap-3">
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <DialogTrigger asChild>
                <Button
                  disabled={busy || problem !== null}
                  onClick={(e) => {
                    if (problem) {
                      e.preventDefault()
                      toast.error(problem)
                    }
                  }}
                >
                  Use this plan
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Replace the plan?</DialogTitle>
                  <DialogDescription>
                    Your {plan.days.length} days become these {parsed.days.length}
                    {parsed.split ? ` on ${splitInfoOf(splits, parsed.split).name}` : ' as a custom plan'}. Logged
                    workouts stay, and the next session starts from day one of the new plan.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                    Keep the current plan
                  </Button>
                  <Button onClick={usePlan} disabled={busy}>
                    Replace
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {problem && <p className="text-sm text-muted-foreground">{problem}</p>}
          </div>
        </section>
      )}
    </div>
  )
}
