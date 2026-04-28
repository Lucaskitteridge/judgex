import pdfParse from 'pdf-parse'
import { DISCIPLINE_MAP, SEGMENT_MAP } from './constants'
import { calculateJudgeDeviations } from './calculator'
import type { JudgePanel, SkaterMark, ParsedProtocol } from './types'

const TITLE_CASE_REGEX = /(?:^|\s|\/)\S/g

const cleanName = (raw: string): string => raw.replace(/\n/g, '').replace(/\s+/g, ' ').trim()

const toTitleCase = (str: string): string =>
  str
    .toLowerCase()
    .replace(TITLE_CASE_REGEX, char => char.toUpperCase())
    .trim()

// Extracts 9 judge GOE scores from a jammed element row by working
// backwards from the panel score at the end of the line
const parseElementLine = (line: string): number[] | null => {
  const trimmed = line.trim()
  if (!/^\d+\s+/.test(trimmed)) return null
  if (/^(Composition|Presentation|Skating Skills)/.test(trimmed)) return null

  const panelMatch = trimmed.match(/(\d{1,2}\.\d{2})$/)
  if (!panelMatch) return null

  const beforePanel = trimmed.slice(0, trimmed.length - panelMatch[0].length)

  // Walk backwards through the string collecting single digit judge scores
  // Stop when we hit a non-digit non-space character (GOE value boundary)
  const chars = beforePanel.split('')
  const scores: number[] = []
  let i = chars.length - 1

  while (i >= 0 && scores.length < 9) {
    if (chars[i] >= '0' && chars[i] <= '9') {
      if (i > 0 && chars[i - 1] === '-') {
        scores.unshift(-parseInt(chars[i]))
        i -= 2
      } else {
        scores.unshift(parseInt(chars[i]))
        i--
      }
    } else if (chars[i] === ' ') {
      i--
    } else {
      break
    }
  }

  if (scores.length !== 9) return null
  // GOE scores are capped at -5 to +5 by ISU rules
  if (scores.some(s => s < -5 || s > 5)) return null

  return scores
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

  for (const section of detailSections) {
    const headerMatch = section.match(/(PAIRS|MEN|WOMEN|ICE DANCE)\s+(SHORT PROGRAM|FREE SKATING|RHYTHM DANCE|FREE DANCE)/)
    if (!headerMatch) continue

    const discipline = DISCIPLINE_MAP[headerMatch[1]]
    const segment = SEGMENT_MAP[headerMatch[2]]
    const panel = panels.find(p => p.discipline === discipline && p.segment === segment)
    if (!panel) continue

    // Must use let — RegExp.exec with /g flag mutates regex state between calls
    let skaterMatch
    const skaterStartRegex = /\n\d+\s+[A-Z][a-z]+(?:\s+[A-Z]|\s*\/)/g
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
      const perJudgeScores: number[][] = Array.from({ length: 9 }, () => [])

      for (const line of skaterBlock.split('\n')) {
        const elementScores = parseElementLine(line)
        if (elementScores) {
          for (let j = 0; j < 9; j++) {
            perJudgeScores[j].push(elementScores[j])
          }
        }
      }

      if (perJudgeScores[0].length === 0) continue

      marks.push({
        skaterName,
        skaterNationality,
        discipline,
        segment,
        judgeDeviations: calculateJudgeDeviations(perJudgeScores),
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
