export type Discipline = 'mens' | 'womens' | 'pairs' | 'ice_dance'
export type Segment = 'SP' | 'FS'

export interface JudgePanel {
  discipline: Discipline
  segment: Segment
  referee: { name: string; nationality: string }
  judges: {
    position: number
    name: string
    nationality: string
  }[]
}

export interface SkaterMark {
  skaterName: string
  skaterNationality: string
  discipline: Discipline
  segment: Segment
  judgeDeviations: JudgeDeviation[]
}

export interface ParsedProtocol {
  panels: JudgePanel[]
  marks: SkaterMark[]
}

export interface JudgeAggregate {
  avgElementDeviation: number
  avgElementAbsoluteDeviation: number
  avgPcsDeviation: number
  avgPcsAbsoluteDeviation: number
  totalMarks: number
}

export interface SkaterSeasonAggregate {
  avgElementDeviationReceived: number
  avgPcsDeviationReceived: number
  totalMarks: number
}

export interface JudgeDeviation {
  position: number
  elementDeviation: number
  elementRawScore: number
  pcsDeviation: number
  pcsRawScore: number
}
