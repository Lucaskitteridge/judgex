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
  judgeDeviations: {
    position: number
    deviation: number
  }[]
}

export interface ParsedProtocol {
  panels: JudgePanel[]
  marks: SkaterMark[]
}
