import pdfParse from 'pdf-parse'
import { fetchPdf } from '../lib/fetcher'
import { parseProtocol } from '../lib/parser'

describe('fetchPdf', () => {
  it('fetches a real ISU protocol PDF and returns a buffer', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    expect(buffer).not.toBeNull()
    expect(buffer!.byteLength).toBeGreaterThan(0)
  }, 30000)

  it('returns null for a non-existent event code', async () => {
    const buffer = await fetchPdf('2425', 'fakeevent9999')
    expect(buffer).toBeNull()
  }, 30000)

  it('parses fetched PDF and extracts text', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    expect(buffer).not.toBeNull()

    const pdf = await pdfParse(buffer!)
    expect(pdf.text).toBeTruthy()
    expect(pdf.text.length).toBeGreaterThan(100)
  }, 30000)
})

describe('parseProtocol', () => {
  it('extracts judge panels from a real protocol PDF', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    expect(buffer).not.toBeNull()

    const result = await parseProtocol(buffer!)

    expect(result.panels.length).toBe(8)
    expect(result.panels[0].judges.length).toBe(9)
    expect(result.panels[0].referee).toBeDefined()
  }, 30000)

  it('extracts skater marks from a real protocol PDF', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    expect(buffer).not.toBeNull()

    const result = await parseProtocol(buffer!)

    expect(result.marks.length).toBe(82)
    expect(result.marks[0].judgeDeviations.length).toBe(9)
    expect(result.marks[0].judgeDeviations[0].elementDeviation).toBeDefined()
    expect(result.marks[0].judgeDeviations[0].pcsDeviation).toBeDefined()

    const byDisciplineSegment: Record<string, number> = {}
    for (const mark of result.marks) {
      const key = `${mark.discipline} ${mark.segment}`
      byDisciplineSegment[key] = (byDisciplineSegment[key] || 0) + 1
    }

    expect(byDisciplineSegment['pairs SP']).toBe(8)
    expect(byDisciplineSegment['pairs FS']).toBe(8)
    expect(byDisciplineSegment['womens SP']).toBe(12)
    expect(byDisciplineSegment['womens FS']).toBe(12)
    expect(byDisciplineSegment['mens SP']).toBe(12)
    expect(byDisciplineSegment['mens FS']).toBe(12)
    expect(byDisciplineSegment['ice_dance SP']).toBe(9)
    expect(byDisciplineSegment['ice_dance FS']).toBe(9)
  }, 30000)

  it('verifies deviation math against known element', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    const result = await parseProtocol(buffer!)

    const miura = result.marks.find(m => m.skaterName.includes('Miura') && m.segment === 'SP')
    expect(miura).toBeDefined()

    // Tetsuo Abe is judge position 1 on pairs panel — expected deviation ~+0.27
    const abe = miura!.judgeDeviations.find(d => d.position === 1)
    expect(abe).toBeDefined()
    expect(Math.abs(abe!.elementDeviation - 0.27)).toBeLessThan(0.01)

    // Sum of all deviations should be ~0
    const elementSum = miura!.judgeDeviations.reduce((s, j) => s + j.elementDeviation, 0)
    expect(Math.abs(elementSum)).toBeLessThan(0.01)

    const pcsSum = miura!.judgeDeviations.reduce((s, j) => s + j.pcsDeviation, 0)
    expect(Math.abs(pcsSum)).toBeLessThan(0.01)
  }, 30000)
})
