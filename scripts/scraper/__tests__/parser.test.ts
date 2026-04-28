import { fetchPdf } from '../lib/fetcher'
import { parseProtocol } from '../lib/parser'

describe('parseProtocol', () => {
  it('extracts judge panels from a real protocol PDF', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    expect(buffer).not.toBeNull()

    const result = await parseProtocol(buffer!)

    console.log('\n--- PANELS ---')
    console.log(JSON.stringify(result.panels, null, 2))

    expect(result.panels.length).toBeGreaterThan(0)
    expect(result.panels[0].judges.length).toBeGreaterThan(0)
  }, 30000)

  it('extracts skater marks from a real protocol PDF', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    expect(buffer).not.toBeNull()

    const result = await parseProtocol(buffer!)

    console.log('\nTotal marks:', result.marks.length)
    console.log('\nFirst 5 marks:')
    console.log(JSON.stringify(result.marks.slice(0, 5), null, 2))

    // Check discipline distribution
    const byDiscipline: Record<string, number> = {}
    for (const mark of result.marks) {
      const key = `${mark.discipline} ${mark.segment}`
      byDiscipline[key] = (byDiscipline[key] || 0) + 1
    }
    console.log('\nMarks by discipline/segment:', byDiscipline)

    expect(result.marks.length).toBeGreaterThan(0)
    expect(result.marks[0].judgeDeviations.length).toBe(9)
  }, 30000)

  it('verifies deviation math against known element', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    const result = await parseProtocol(buffer!)

    // Find Riku Miura pairs SP
    const miura = result.marks.find(m => m.skaterName.includes('Miura') && m.segment === 'SP')
    expect(miura).toBeDefined()
    console.log('Miura SP deviations:', miura?.judgeDeviations)

    // Sum of all deviations should always be 0 (they're deviations from the mean)
    const sum = miura!.judgeDeviations.reduce((s, j) => s + j.deviation, 0)
    console.log('Sum of deviations (should be ~0):', sum)
    expect(Math.abs(sum)).toBeLessThan(0.01)
  }, 30000)
})
