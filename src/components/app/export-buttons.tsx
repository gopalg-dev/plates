import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '#/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { planSourceInfo, type SplitTemplate } from '#/lib/content'
import { saveBlob } from '#/lib/download'
import { errorMessage } from '#/lib/format'
import {
  bodyweightsToRows,
  dataReadme,
  type ExportLayout,
  exportFileName,
  measurementsToRows,
  setHeaders,
  setsToRows,
  trackerSheets,
} from '#/lib/logic/export'
import { GUIDE_LINES } from '#/lib/logic/plan-sheet'
import { dayKey } from '#/lib/logic/stats'
import { planWorkbook } from '#/lib/plan-workbook'
import { slug } from '#/lib/seed-plan'
import type { Units, Workout } from '#/lib/types'
import { useContent } from '#/lib/use-content'
import { getExportFn } from '#/server/fns'

/*
 * The exports, built in the browser from the account's own data and handed to the browser's download. Nothing is
 * stored on the way. The sheets are made once and written out as Excel, CSV or the zip of everything.
 */

type Sheets = typeof import('xlsx')
type ExportData = Awaited<ReturnType<typeof getExportFn>>

/** The logs as sheets: every set, every weigh-in, every tape day, with headers in the account's units. */
function logSheets(XLSX: Sheets, data: ExportData) {
  const units = data.settings.units
  const lengthUnit = units === 'kg' ? 'cm' : 'in'

  const sets = XLSX.utils.json_to_sheet(setsToRows(data.workouts))
  XLSX.utils.sheet_add_aoa(sets, [setHeaders(units)], { origin: 'A1' })
  sets['!cols'] = [11, 6, 10, 6, 28, 11, 4, 11, 5, 8, 8, 40].map((wch) => ({ wch }))

  const bodyweight = XLSX.utils.json_to_sheet(bodyweightsToRows(data.bodyweights))
  XLSX.utils.sheet_add_aoa(bodyweight, [['Date', `Weight (${units})`]], { origin: 'A1' })
  bodyweight['!cols'] = [{ wch: 11 }, { wch: 11 }]

  const tape = XLSX.utils.json_to_sheet(measurementsToRows(data.measurements))
  XLSX.utils.sheet_add_aoa(tape, [['Date', `Arm (${lengthUnit})`, `Chest (${lengthUnit})`, `Waist (${lengthUnit})`]], {
    origin: 'A1',
  })
  tape['!cols'] = [11, 9, 10, 10].map((wch) => ({ wch }))
  return { sets, bodyweight, tape }
}

/**
 * The logs as one file. The log layout: the sets alone as CSV, or every log as an Excel workbook with a sheet
 * each. The tracker layout: Excel only, a sheet per plan day, then the weigh-ins and the tape.
 */
async function downloadLogs(kind: 'xlsx' | 'csv', layout: ExportLayout) {
  const [XLSX, data] = await Promise.all([import('xlsx'), getExportFn()])
  const sheets = logSheets(XLSX, data)
  const wb = XLSX.utils.book_new()
  if (layout === 'tracker') {
    for (const day of trackerSheets(data.workouts, data.settings.units)) {
      const ws = XLSX.utils.aoa_to_sheet([day.headers, ...day.rows])
      ws['!cols'] = day.headers.map((h) => ({ wch: h === 'Exercise' ? 28 : h === 'Note' ? 40 : 11 }))
      XLSX.utils.book_append_sheet(wb, ws, day.name)
    }
  } else {
    XLSX.utils.book_append_sheet(wb, sheets.sets, 'Sets')
  }
  if (kind === 'xlsx') {
    XLSX.utils.book_append_sheet(wb, sheets.bodyweight, 'Bodyweight')
    XLSX.utils.book_append_sheet(wb, sheets.tape, 'Measurements')
  }
  XLSX.writeFile(wb, exportFileName(kind, new Date(), layout), { bookType: kind })
}

/**
 * Everything the account holds as one zip: a README.md saying what each file and column is, the logs as CSV, the
 * plan as the Excel file Plates imports (a CSV would let Excel turn "6-10" into a date), Settings and feedback as
 * JSON, and one JSON with all of it. `splits` names the plan's template, so a re-import knows its split.
 */
async function downloadAll(splits: SplitTemplate[]) {
  const [XLSX, { strToU8, zipSync }, data] = await Promise.all([import('xlsx'), import('fflate'), getExportFn()])
  const sheets = logSheets(XLSX, data)
  const csv = (sheet: import('xlsx').WorkSheet) => strToU8(XLSX.utils.sheet_to_csv(sheet))
  const json = (value: unknown) => strToU8(`${JSON.stringify(value, null, 2)}\n`)
  const source = planSourceInfo(splits, data.settings.split, data.plan.days.length)
  const plan = planWorkbook(XLSX, data.plan.days, source.custom ? null : source)
  const today = dayKey(new Date())
  const zip = zipSync({
    'README.md': strToU8(
      dataReadme({
        units: data.settings.units,
        today,
        sessions: data.workouts.filter((w) => w.status === 'done').length,
        sets: setsToRows(data.workouts).length,
        weighIns: data.bodyweights.length,
        tapeDays: data.measurements.length,
        feedback: data.feedback.length,
        // The template's own guide, without its title line.
        planGuide: GUIDE_LINES.slice(1).map((line) => line[0]),
      }),
    ),
    'sessions.csv': csv(sheets.sets),
    'weigh-ins.csv': csv(sheets.bodyweight),
    'tape.csv': csv(sheets.tape),
    'plan.xlsx': new Uint8Array(XLSX.write(plan, { type: 'array', bookType: 'xlsx' })),
    'settings.json': json(data.settings),
    'feedback.json': json(data.feedback),
    'everything.json': json({ exportedAt: new Date().toISOString(), ...data }),
  })
  // Named for the account, so a download among others says whose it is: plates-data-alex-2026-10-13.zip.
  saveBlob(
    new Blob([zip], { type: 'application/zip' }),
    `plates-data-${slug(data.account.username ?? data.account.email) || 'account'}-${today}.zip`,
  )
}

/** Runs one export, with the buttons held while the file is built. */
function useExport() {
  const [exporting, setExporting] = useState(false)
  async function run(build: () => Promise<void>) {
    setExporting(true)
    try {
      await build()
    } catch (err) {
      toast.error(errorMessage(err, 'Could not build the file.'))
    } finally {
      setExporting(false)
    }
  }
  return { exporting, run }
}

const LAYOUTS: { value: ExportLayout; label: string }[] = [
  { value: 'log', label: 'Log' },
  { value: 'tracker', label: 'Tracker' },
]

/** The first rows of the sheet the layout would write, from the logs on screen, so a pick is made on sight. */
function ExportPreview({ layout, workouts, units }: { layout: ExportLayout; workouts: Workout[]; units: Units }) {
  const { headers, rows } = useMemo(() => {
    if (layout === 'tracker') {
      const first = trackerSheets(workouts, units)[0]
      return first ? { headers: first.headers, rows: first.rows.slice(0, 3) } : { headers: [], rows: [] }
    }
    return {
      headers: setHeaders(units),
      rows: setsToRows(workouts)
        .slice(0, 3)
        .map((r) => Object.values(r)),
    }
  }, [layout, workouts, units])
  if (!headers.length) return null
  return (
    <div className="rounded-md border">
      <Table className="text-xs" aria-label={`${layout === 'tracker' ? 'Tracker' : 'Log'} sheet preview`}>
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h} className="h-8 text-xs">
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            // Rows have no identity of their own: the preview is a fixed sample, never reordered.
            // biome-ignore lint/suspicious/noArrayIndexKey: a static sample
            <TableRow key={i}>
              {row.map((cell, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a static sample
                <TableCell key={j} className="py-1.5">
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/** The logs export: the sheet layout to write, a preview of it, and "Download Excel" or "Download CSV". */
export function ExportButtons({ workouts, units }: { workouts: Workout[]; units: Units }) {
  const { exporting, run } = useExport()
  const [layout, setLayout] = useState<ExportLayout>('log')
  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={layout}
        onValueChange={(v) => v && setLayout(v as ExportLayout)}
        aria-label="Sheet layout"
      >
        {LAYOUTS.map((l) => (
          <ToggleGroupItem key={l.value} value={l.value} className="px-3">
            {l.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ExportPreview layout={layout} workouts={workouts} units={units} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => run(() => downloadLogs('xlsx', layout))}
          disabled={exporting}
        >
          Download Excel
        </Button>
        {/* A CSV holds one sheet: only the log layout fits in one. */}
        {layout === 'log' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => run(() => downloadLogs('csv', layout))}
            disabled={exporting}
          >
            Download CSV
          </Button>
        )}
      </div>
    </div>
  )
}

/** "Download all my data": the zip of everything, offered beside deleting the account. */
export function DownloadAllButton({ className }: { className?: string }) {
  const { exporting, run } = useExport()
  const { splits } = useContent()
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => run(() => downloadAll(splits))}
      disabled={exporting}
    >
      {exporting ? 'Building the zip…' : 'Download all my data (.zip)'}
    </Button>
  )
}
