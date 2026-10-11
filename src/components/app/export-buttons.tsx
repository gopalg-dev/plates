import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '#/components/ui/button'
import { bodyweightsToRows, exportFileName, measurementsToRows, setHeaders, setsToRows } from '#/lib/logic/export'
import { getExportFn } from '#/server/fns'
import { errorMessage } from '#/lib/format'

/** Builds the workbook in the browser and hands it to the browser's download. Nothing is stored. */
async function downloadLogs(kind: 'xlsx' | 'csv') {
  const [XLSX, data] = await Promise.all([import('xlsx'), getExportFn()])
  const units = data.settings.units
  const lengthUnit = units === 'kg' ? 'cm' : 'in'
  const wb = XLSX.utils.book_new()

  const sets = XLSX.utils.json_to_sheet(setsToRows(data.workouts))
  XLSX.utils.sheet_add_aoa(sets, [setHeaders(units)], { origin: 'A1' })
  sets['!cols'] = [11, 6, 10, 6, 28, 11, 4, 11, 5, 8, 8, 40].map((wch) => ({ wch }))
  XLSX.utils.book_append_sheet(wb, sets, 'Sets')

  if (kind === 'xlsx') {
    const bw = XLSX.utils.json_to_sheet(bodyweightsToRows(data.bodyweights))
    XLSX.utils.sheet_add_aoa(bw, [['Date', `Weight (${units})`]], { origin: 'A1' })
    bw['!cols'] = [{ wch: 11 }, { wch: 11 }]
    XLSX.utils.book_append_sheet(wb, bw, 'Bodyweight')

    const tape = XLSX.utils.json_to_sheet(measurementsToRows(data.measurements))
    XLSX.utils.sheet_add_aoa(
      tape,
      [['Date', `Arm (${lengthUnit})`, `Chest (${lengthUnit})`, `Waist (${lengthUnit})`]],
      { origin: 'A1' },
    )
    tape['!cols'] = [11, 9, 10, 10].map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(wb, tape, 'Measurements')
  }

  XLSX.writeFile(wb, exportFileName(kind), { bookType: kind })
}

/** "Download Excel" and "Download CSV". */
export function ExportButtons() {
  const [exporting, setExporting] = useState(false)

  async function exportLogs(kind: 'xlsx' | 'csv') {
    setExporting(true)
    try {
      await downloadLogs(kind)
    } catch (err) {
      toast.error(errorMessage(err, 'Could not build the file.'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => exportLogs('xlsx')} disabled={exporting}>
        Download Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => exportLogs('csv')} disabled={exporting}>
        Download CSV
      </Button>
    </div>
  )
}
