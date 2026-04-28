import type { JudgeDeviation, SkaterSeasonAggregate, JudgeAggregate } from './types'

// Calculates each judge's deviation from the panel average across all elements
export const calculateJudgeDeviations = (perJudgeScores: number[][]): JudgeDeviation[] => {
  const judgeAverages = perJudgeScores.map(scores => scores.reduce((sum, s) => sum + s, 0) / scores.length)
  const panelAverage = judgeAverages.reduce((sum, a) => sum + a, 0) / judgeAverages.length

  return judgeAverages.map((avg, i) => ({
    position: i + 1,
    deviation: parseFloat((avg - panelAverage).toFixed(3)),
  }))
}

// Calculates avg deviation and avg absolute deviation for a judge vs a nationality
export const calculateJudgeAggregate = (deviations: number[]): JudgeAggregate => {
  const avgDeviation = parseFloat((deviations.reduce((sum, d) => sum + d, 0) / deviations.length).toFixed(3))
  const avgAbsoluteDeviation = parseFloat((deviations.reduce((sum, d) => sum + Math.abs(d), 0) / deviations.length).toFixed(3))
  return { avgDeviation, avgAbsoluteDeviation, totalMarks: deviations.length }
}

// Calculates avg deviation received by a skater in a given season
export const calculateSkaterSeasonAggregate = (deviations: number[]): SkaterSeasonAggregate => {
  const avgDeviationReceived = parseFloat((deviations.reduce((sum, d) => sum + d, 0) / deviations.length).toFixed(3))
  return { avgDeviationReceived, totalMarks: deviations.length }
}
