import pdfParse from 'pdf-parse'
import { DISCIPLINE_MAP, SEGMENT_MAP } from './constants'
import { calculateJudgeDeviations } from './calculator'
import type { JudgePanel, SkaterMark, ParsedProtocol } from './types'
import { cleanName, toTitleCase } from './utils'

const LEGACY_COMPONENT_NAMES = ['Skating Skills', 'Transitions', 'Performance', 'Composition', 'Interpretation of the Music']
const MODERN_COMPONENT_NAMES = ['Composition', 'Presentation', 'Skating Skills']

const parseElementLine = (line: string, numJudges: number = 9): number[] | null => {
  const trimmed = line.trim()
  if (/^\d+\s+[A-ZÀ-Ö][a-zA-ZÀ-öø-ÿ]+\s/.test(trimmed)) return null
  if (/^(Composition|Presentation|Skating Skills|Transitions|Performance|Interpretation)/.test(trimmed)) return null

  const match = trimmed.match(new RegExp(`\\d+\\.\\d{2}(-?\\d\\.\\d{2})((?:-?\\d){${numJudges}})\\d+\\.\\d{2}$`))
  if (!match) return null

  const scoreMatches = match[2].match(/-?\d/g)
  if (!scoreMatches || scoreMatches.length !== numJudges) return null

  const scores = scoreMatches.map(Number)
  if (scores.some(s => s < -5 || s > 5)) return null

  return scores
}

const parsePcsLine = (line: string, componentNames: string[], numJudges: number): number[] | null => {
  const trimmed = line.trim()
  if (!componentNames.some(name => trimmed.startsWith(name))) return null

  const withoutName = trimmed.replace(new RegExp(`^(${componentNames.join('|')})`), '')
  const allDecimals = withoutName.match(/\d+\.\d{2}/g)
  if (!allDecimals || allDecimals.length < numJudges + 2) return null

  const judgeScores = allDecimals.slice(1, numJudges + 1).map(Number)
  if (judgeScores.length !== numJudges) return null
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

    const judgeNamesMatch = section.match(/Judge No\. \d+\s+([\s\S]+?)(?:Data\/Replay|Data Operator)/)
    if (discipline === 'ice_dance') {
      console.log('ice dance judgeNamesMatch:', judgeNamesMatch ? JSON.stringify(judgeNamesMatch[1].slice(0, 300)) : 'null')
    }
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

    if (names.length < 9 || nationalities.length < 9) continue

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

const parseMarks = (text: string, panels: JudgePanel[], season: string): SkaterMark[] => {
  const marks: SkaterMark[] = []
  const detailSections = text.split('JUDGES DETAILS PER SKATER')
  detailSections.shift()

  const isLegacy = season < '2223'
  const componentNames = isLegacy ? LEGACY_COMPONENT_NAMES : MODERN_COMPONENT_NAMES

  const processed = new Set<string>()

  for (const section of detailSections) {
    const headerMatch = section.match(/(PAIRS|MEN|WOMEN|ICE DANCE)\s+(SHORT PROGRAM|FREE SKATING|RHYTHM DANCE|FREE DANCE)/)
    if (!headerMatch) continue

    const discipline = DISCIPLINE_MAP[headerMatch[1]]
    const segment = SEGMENT_MAP[headerMatch[2]]
    const panel = panels.find(p => p.discipline === discipline && p.segment === segment)
    if (!panel) continue
    const skaterStartPositions: number[] = []
    const skaterStartRegex = /\n\d+\s*[A-ZÀ-Ö][a-zA-ZÀ-öø-ÿ]{2,}(?:\s+[a-zA-ZÀ-öø-ÿ]|\s*\/)/g

    let skaterMatch

    while ((skaterMatch = skaterStartRegex.exec(section)) !== null) {
      skaterStartPositions.push(skaterMatch.index)
    }

    if (discipline === 'ice_dance') {
      console.log('ice dance section found, skaterStartPositions:', skaterStartPositions.length)
      console.log('panel judges:', panel.judges.length)
    }

    for (let i = 0; i < skaterStartPositions.length; i++) {
      const skaterBlock = section.slice(skaterStartPositions[i], skaterStartPositions[i + 1] || section.length)

      const nameMatch = skaterBlock.match(
        /\d+\s*((?:[A-ZÀ-Ö][a-zA-ZÀ-öø-ÿ'-]*(?:\s+[a-zA-ZÀ-öø-ÿ][a-zA-ZÀ-öø-ÿ'-]*)*\s*(?:\/\s*)?)+?)([A-Z]{3})\d/
      )
      if (!nameMatch) continue

      const skaterName = toTitleCase(cleanName(nameMatch[1]))
      const skaterNationality = nameMatch[2]

      const key = `${skaterName}|${discipline}|${segment}`
      if (processed.has(key)) continue
      processed.add(key)

      const numJudges = panel.judges.length
      const perJudgeScores: number[][] = Array.from({ length: numJudges }, () => [])
      const perJudgePcsScores: number[][] = Array.from({ length: numJudges }, () => [])

      const pcsRejoinRegex = new RegExp(`(${componentNames.join('|')})\n(\\d)`, 'g')
      const processedBlock = skaterBlock.replace(pcsRejoinRegex, '$1$2')

      for (const line of processedBlock.split('\n')) {
        const elementScores = parseElementLine(line, numJudges)
        if (elementScores) {
          for (let j = 0; j < numJudges; j++) {
            perJudgeScores[j].push(elementScores[j])
          }
        }

        const pcsScores = parsePcsLine(line, componentNames, numJudges)
        if (pcsScores) {
          for (let j = 0; j < numJudges; j++) {
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

export const parseProtocol = async (buffer: Buffer, season: string): Promise<ParsedProtocol> => {
  const pdf = await pdfParse(buffer)
  const panels = parsePanels(pdf.text)
  const marks = parseMarks(pdf.text, panels, season)
  return { panels, marks }
}
