import type { JudgeDeviation, SkaterSeasonAggregate, JudgeAggregate } from './types'

export const calculateJudgeDeviations = (perJudgeElementScores: number[][], perJudgePcsScores: number[][]): JudgeDeviation[] => {
  const numElements = perJudgeElementScores[0].length
  const numJudges = perJudgeElementScores.length
  const numComponents = perJudgePcsScores[0].length

  // Calculate per-element deviations
  const perJudgeElementDeviations: number[][] = Array.from({ length: numJudges }, () => [])

  for (let elemIdx = 0; elemIdx < numElements; elemIdx++) {
    const elementScores = perJudgeElementScores.map(s => s[elemIdx])
    const elementPanelAvg = elementScores.reduce((sum, s) => sum + s, 0) / numJudges

    for (let judgeIdx = 0; judgeIdx < numJudges; judgeIdx++) {
      perJudgeElementDeviations[judgeIdx].push(perJudgeElementScores[judgeIdx][elemIdx] - elementPanelAvg)
    }
  }

  // Calculate per-component deviations
  const perJudgePcsDeviations: number[][] = Array.from({ length: numJudges }, () => [])

  for (let compIdx = 0; compIdx < numComponents; compIdx++) {
    const componentScores = perJudgePcsScores.map(s => s[compIdx])
    const componentPanelAvg = componentScores.reduce((sum, s) => sum + s, 0) / numJudges

    for (let judgeIdx = 0; judgeIdx < numJudges; judgeIdx++) {
      perJudgePcsDeviations[judgeIdx].push(perJudgePcsScores[judgeIdx][compIdx] - componentPanelAvg)
    }
  }

  return Array.from({ length: numJudges }, (_, i) => ({
    position: i + 1,
    elementDeviation: parseFloat((perJudgeElementDeviations[i].reduce((sum, d) => sum + d, 0) / numElements).toFixed(3)),
    elementRawScore: parseFloat((perJudgeElementScores[i].reduce((sum, s) => sum + s, 0) / numElements).toFixed(3)),
    pcsDeviation: parseFloat((perJudgePcsDeviations[i].reduce((sum, d) => sum + d, 0) / numComponents).toFixed(3)),
    pcsRawScore: parseFloat((perJudgePcsScores[i].reduce((sum, s) => sum + s, 0) / numComponents).toFixed(3)),
  }))
}

// Calculates avg deviation and avg absolute deviation for a judge vs a nationality
export const calculateJudgeAggregate = (elementDeviations: number[], pcsDeviations: number[]): JudgeAggregate => ({
  avgElementDeviation: parseFloat((elementDeviations.reduce((sum, d) => sum + d, 0) / elementDeviations.length).toFixed(3)),
  avgElementAbsoluteDeviation: parseFloat(
    (elementDeviations.reduce((sum, d) => sum + Math.abs(d), 0) / elementDeviations.length).toFixed(3)
  ),
  avgPcsDeviation: parseFloat((pcsDeviations.reduce((sum, d) => sum + d, 0) / pcsDeviations.length).toFixed(3)),
  avgPcsAbsoluteDeviation: parseFloat((pcsDeviations.reduce((sum, d) => sum + Math.abs(d), 0) / pcsDeviations.length).toFixed(3)),
  totalMarks: elementDeviations.length,
})

export const calculateSkaterSeasonAggregate = (elementDeviations: number[], pcsDeviations: number[]): SkaterSeasonAggregate => ({
  avgElementDeviationReceived: parseFloat((elementDeviations.reduce((sum, d) => sum + d, 0) / elementDeviations.length).toFixed(3)),
  avgPcsDeviationReceived: parseFloat((pcsDeviations.reduce((sum, d) => sum + d, 0) / pcsDeviations.length).toFixed(3)),
  totalMarks: elementDeviations.length,
})
