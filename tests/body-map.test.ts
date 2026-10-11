import { describe, expect, it } from 'vitest'
import { regionPaint } from '#/components/app/body-map'

describe('body map colours', () => {
  it('greys a muscle the plan does not ask for, reds one it asks for with nothing logged, greens the rest', () => {
    expect(regionPaint(0, 0).state).toBe('off')
    expect(regionPaint(0, 9).state).toBe('due')
    expect(regionPaint(3, 9).state).toBe('on')
    expect(regionPaint(2, 0).state).toBe('on')
  })

  it('deepens the green towards the plan and stops there', () => {
    const quarter = regionPaint(3, 12).opacity
    const full = regionPaint(12, 12).opacity
    const over = regionPaint(20, 12).opacity
    expect(quarter).toBeLessThan(full)
    expect(full).toBe(1)
    expect(over).toBe(1)
    expect(regionPaint(1, 0).opacity).toBe(1)
  })
})
