import type { WorkBook } from 'xlsx'
import type { SplitInfo } from './content'
import { GUIDE_LINES, planToRows, TEMPLATE_HEADERS, templateMarker, templateTitle } from './logic/plan-sheet'
import type { PlanDay } from './types'

/**
 * A plan as the Excel file Plates reads back on Bring your own plan: the Plan sheet, the Guide sheet that says how
 * to fill it, and, for a plan from a split template, the Template sheet that names it. The Download template button
 * and the zip of all of a user's data both write it. Excel needs it as a workbook rather than CSV: "6-10" in Reps
 * stays a range only in a cell marked as text, and a CSV cannot mark one.
 */
export function planWorkbook(
  XLSX: typeof import('xlsx'),
  days: PlanDay[],
  marker: Pick<SplitInfo, 'id' | 'name' | 'days'> | null,
): WorkBook {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(planToRows({ days }), { header: [...TEMPLATE_HEADERS] })
  // Keep the Reps column as text, so Excel leaves "6-10" alone instead of making it a date. Rows past the plan
  // get the same, for the exercises someone adds.
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
  return wb
}
