import { fetchPdf } from '../lib/fetcher'
import { parseProtocol } from '../lib/parser'

describe('parseProtocol', () => {
  it('extracts judge panels from a real protocol PDF', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    expect(buffer).not.toBeNull()

    const result = await parseProtocol(buffer!)

    expect(result.panels.length).toBeGreaterThan(0)
    expect(result.panels[0].judges.length).toBeGreaterThan(0)
  }, 30000)

  it('extracts skater marks from a real protocol PDF', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    expect(buffer).not.toBeNull()

    const result = await parseProtocol(buffer!)

    // Check discipline distribution
    const byDiscipline: Record<string, number> = {}
    for (const mark of result.marks) {
      const key = `${mark.discipline} ${mark.segment}`
      byDiscipline[key] = (byDiscipline[key] || 0) + 1
    }

    expect(result.marks.length).toBeGreaterThan(0)
    expect(result.marks[0].judgeDeviations.length).toBe(9)
  }, 30000)

  it('verifies deviation math against known element', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    const result = await parseProtocol(buffer!)

    const miura = result.marks.find(m => m.skaterName.includes('Miura') && m.segment === 'SP')
    expect(miura).toBeDefined()

    // Sum of element deviations should be ~0
    const elementSum = miura!.judgeDeviations.reduce((s, j) => s + j.elementDeviation, 0)
    expect(Math.abs(elementSum)).toBeLessThan(0.01)

    // Sum of PCS deviations should also be ~0
    const pcsSum = miura!.judgeDeviations.reduce((s, j) => s + j.pcsDeviation, 0)
    expect(Math.abs(pcsSum)).toBeLessThan(0.01)
  }, 30000)
})
