import pdfParse from 'pdf-parse'
import { DISCIPLINE_MAP, SEGMENT_MAP } from './constants'
import { calculateJudgeDeviations } from './calculator'
import type { JudgePanel, SkaterMark, ParsedProtocol } from './types'
import { cleanName, toTitleCase } from './utils'

const parseElementLine = (line: string): number[] | null => {
  const trimmed = line.trim()
  if (!/^\d+\s+/.test(trimmed)) return null
  if (/^(Composition|Presentation|Skating Skills)/.test(trimmed)) return null
  if (/^\d+\s+[A-Z][a-z]+\s/.test(trimmed)) return null

  // Match: baseValue(X.XX) + GOE(±X.XX, exactly 1 digit before decimal) + 9 judge scores + panelScore
  const match = trimmed.match(/\d+\.\d{2}(-?\d\.\d{2})((?:-?\d){9})\d+\.\d{2}$/)
  if (!match) return null

  const scoreMatches = match[2].match(/-?\d/g)
  if (!scoreMatches || scoreMatches.length !== 9) return null

  const scores = scoreMatches.map(Number)
  if (scores.some(s => s < -5 || s > 5)) return null

  return scores
}

// Extracts 9 judge PCS scores from a component row
const parsePcsLine = (line: string): number[] | null => {
  const trimmed = line.trim()
  if (!/^(Composition|Presentation|Skating Skills)/.test(trimmed)) return null

  const withoutName = trimmed.replace(/^(Composition|Presentation|Skating Skills)/, '')
  const allDecimals = withoutName.match(/\d+\.\d{2}/g)
  if (!allDecimals || allDecimals.length < 11) return null

  // Structure: factor(1), judge scores(9), panel average(1) = 11 numbers
  const judgeScores = allDecimals.slice(1, 10).map(Number)
  if (judgeScores.length !== 9) return null
  if (judgeScores.some(s => s < 0 || s > 10)) return null

  return judgeScores
}

const parsePanels = (text: string): JudgePanel[] => {
  const panels: JudgePanel[] = []
  const panelSections = text.split('PANEL OF JUDGES')
  panelSections.shift()

  for (const section of panelSections) {
    const disciplineMatch = section.match(/^\s*(PAIRS|MEN|WOMEN|ICE DANCE)/)
    if (!disciplineMatch) continue
    const discipline = DISCIPLINE_MAP[disciplineMatch[1]]

    const judgeNamesMatch = section.match(/Judge No\. 9\s+([\s\S]+?)(?:Data\/Replay|Data Operator)/)
    if (!judgeNamesMatch) continue

    const lines = judgeNamesMatch[1]
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    const names: string[] = []
    const nationalities: string[] = []

    for (const line of lines) {
      if (/^(Mr\.|Ms\.)/.test(line)) names.push(line)
      else if (/^[A-Z]{3}$/.test(line)) nationalities.push(line)
    }

    // Panel has 1 referee + 9 judges = 10 names and 10 nationalities
    if (names.length < 10 || nationalities.length < 10) continue

    const referee = {
      name: toTitleCase(cleanName(names[0])),
      nationality: nationalities[0],
    }

    const judges = names.slice(1).map((name, i) => ({
      position: i + 1,
      name: toTitleCase(cleanName(name)),
      nationality: nationalities[i + 1] || '',
    }))

    for (const segment of ['SP', 'FS'] as const) {
      panels.push({ discipline, segment, referee, judges })
    }
  }

  return panels
}

const parseMarks = (text: string, panels: JudgePanel[]): SkaterMark[] => {
  const marks: SkaterMark[] = []
  const detailSections = text.split('JUDGES DETAILS PER SKATER')
  detailSections.shift()

  const processed = new Set<string>()

  for (const section of detailSections) {
    const headerMatch = section.match(/(PAIRS|MEN|WOMEN|ICE DANCE)\s+(SHORT PROGRAM|FREE SKATING|RHYTHM DANCE|FREE DANCE)/)
    if (!headerMatch) continue

    const discipline = DISCIPLINE_MAP[headerMatch[1]]
    const segment = SEGMENT_MAP[headerMatch[2]]
    const panel = panels.find(p => p.discipline === discipline && p.segment === segment)
    if (!panel) continue

    let skaterMatch
    const skaterStartRegex = /\n\d+\s+[A-Z][a-z]{2,}(?:\s+[A-Z]|\s*\/)/g
    const skaterStartPositions: number[] = []

    while ((skaterMatch = skaterStartRegex.exec(section)) !== null) {
      skaterStartPositions.push(skaterMatch.index)
    }

    for (let i = 0; i < skaterStartPositions.length; i++) {
      const skaterBlock = section.slice(skaterStartPositions[i], skaterStartPositions[i + 1] || section.length)

      const nameMatch = skaterBlock.match(/\d+\s+((?:[A-Z][a-zA-Z'-]*(?:\s+[A-Z][a-zA-Z'-]*)*\s*(?:\/\s*)?)+?)([A-Z]{3})\d/)
      if (!nameMatch) continue

      const skaterName = toTitleCase(cleanName(nameMatch[1]))
      const skaterNationality = nameMatch[2]

      const key = `${skaterName}|${discipline}|${segment}`
      if (processed.has(key)) continue
      processed.add(key)

      const perJudgeScores: number[][] = Array.from({ length: 9 }, () => [])
      const perJudgePcsScores: number[][] = Array.from({ length: 9 }, () => [])

      // Rejoin PCS lines split across lines by the PDF extractor
      const processedBlock = skaterBlock.replace(/(Composition|Presentation|Skating Skills)\n(\d)/g, '$1$2')

      for (const line of processedBlock.split('\n')) {
        const elementScores = parseElementLine(line)

        if (elementScores) {
          for (let j = 0; j < 9; j++) {
            perJudgeScores[j].push(elementScores[j])
          }
        }

        const pcsScores = parsePcsLine(line)
        if (pcsScores) {
          for (let j = 0; j < 9; j++) {
            perJudgePcsScores[j].push(pcsScores[j])
          }
        }
      }

      if (perJudgeScores[0].length === 0) continue
      if (perJudgePcsScores[0].length === 0) continue

      marks.push({
        skaterName,
        skaterNationality,
        discipline,
        segment,
        judgeDeviations: calculateJudgeDeviations(perJudgeScores, perJudgePcsScores),
      })
    }
  }

  return marks
}

export const parseProtocol = async (buffer: Buffer): Promise<ParsedProtocol> => {
  const pdf = await pdfParse(buffer)
  const panels = parsePanels(pdf.text)
  const marks = parseMarks(pdf.text, panels)
  return { panels, marks }
}
