import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { planSourceInfo, type SplitTemplate } from '#/lib/content'
import { errorMessage } from '#/lib/format'
import {
  bodyweightsToRows,
  dataReadme,
  exportFileName,
  measurementsToRows,
  setHeaders,
  setsToRows,
} from '#/lib/logic/export'
import { GUIDE_LINES } from '#/lib/logic/plan-sheet'
import { dayKey } from '#/lib/logic/stats'
import { planWorkbook } from '#/lib/plan-workbook'
import { slug } from '#/lib/seed-plan'
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

/** The sets alone as CSV, or every log as an Excel workbook with a sheet each. */
async function downloadLogs(kind: 'xlsx' | 'csv') {
  const [XLSX, data] = await Promise.all([import('xlsx'), getExportFn()])
  const sheets = logSheets(XLSX, data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheets.sets, 'Sets')
  if (kind === 'xlsx') {
    XLSX.utils.book_append_sheet(wb, sheets.bodyweight, 'Bodyweight')
    XLSX.utils.book_append_sheet(wb, sheets.tape, 'Measurements')
  }
  XLSX.writeFile(wb, exportFileName(kind), { bookType: kind })
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
  const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }))
  const link = document.createElement('a')
  link.href = url
  // Named for the account, so a download among others says whose it is: plates-data-alex-2026-10-13.zip.
  link.download = `plates-data-${slug(data.account.username ?? data.account.email) || 'account'}-${today}.zip`
  link.click()
  URL.revokeObjectURL(url)
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

/** "Download Excel" and "Download CSV": the logs. */
export function ExportButtons() {
  const { exporting, run } = useExport()
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => run(() => downloadLogs('xlsx'))} disabled={exporting}>
        Download Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => run(() => downloadLogs('csv'))} disabled={exporting}>
        Download CSV
      </Button>
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
