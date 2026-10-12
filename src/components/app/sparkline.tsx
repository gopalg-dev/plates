import type { CSSProperties } from 'react'
import { Line, LineChart } from 'recharts'
import { type ChartConfig, ChartContainer } from '#/components/ui/chart'
import { cn } from '#/lib/utils'

interface Props {
  values: number[]
  className?: string
  style?: CSSProperties
}

const config = { v: { label: 'Trend' } } satisfies ChartConfig

/** A tiny trend line on the chart component, no axes. Colour comes from `currentColor`. */
export function Sparkline({ values, className, style }: Props) {
  if (values.length < 2) return <span aria-hidden className={cn('inline-block h-7 w-24', className)} />
  const data = values.map((v, i) => ({ i, v }))
  const last = data.length - 1
  return (
    <ChartContainer
      aria-hidden
      config={config}
      className={cn('h-7 w-24 shrink-0 aspect-auto', className)}
      style={style}
    >
      <LineChart data={data} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
        <Line
          dataKey="v"
          type="monotone"
          stroke="currentColor"
          strokeWidth={1.5}
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; index?: number }) =>
            props.index === last ? (
              <circle key="last" cx={props.cx} cy={props.cy} r={2.25} fill="currentColor" />
            ) : (
              <g key={props.index} />
            )
          }
          activeDot={false}
        />
      </LineChart>
    </ChartContainer>
  )
}
