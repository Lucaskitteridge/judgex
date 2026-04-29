import { supabaseAdmin } from '../../../lib/supabase'
import { calculateJudgeAggregate, calculateSkaterSeasonAggregate } from './calculator'
import type { ParsedProtocol } from './types'

const insertCompetition = async (
  name: string,
  season: string,
  eventCode: string,
  tier: string,
  date: string,
  location: string
): Promise<string | null> => {
  const { data, error } = await supabaseAdmin
    .from('competitions')
    .upsert({ name, season, event_code: eventCode, tier, date, location }, { onConflict: 'event_code' })
    .select('id')
    .single()

  if (error) {
    console.error(`Error inserting competition ${eventCode}:`, error.message)
    return null
  }
  return data.id
}

const upsertJudgesBatch = async (judges: { name: string; nationality: string }[]): Promise<Map<string, string>> => {
  const unique = [...new Map(judges.map(j => [`${j.name}|${j.nationality}`, j])).values()]

  const { data, error } = await supabaseAdmin
    .from('judges')
    .upsert(unique, { onConflict: 'name,nationality' })
    .select('id, name, nationality')

  if (error) {
    console.error('Error batch upserting judges:', error.message)
    return new Map()
  }

  return new Map(data.map(j => [`${j.name}|${j.nationality}`, j.id]))
}

const upsertSkatersBatch = async (skaters: { name: string; nationality: string; discipline: string }[]): Promise<Map<string, string>> => {
  const unique = [...new Map(skaters.map(s => [`${s.name}|${s.nationality}|${s.discipline}`, s])).values()]

  const { data, error } = await supabaseAdmin
    .from('skaters')
    .upsert(unique, { onConflict: 'name,nationality,discipline' })
    .select('id, name, nationality, discipline')

  if (error) {
    console.error('Error batch upserting skaters:', error.message)
    return new Map()
  }

  return new Map(data.map(s => [`${s.name}|${s.nationality}|${s.discipline}`, s.id]))
}

const insertMarksBatch = async (
  marks: {
    competition_id: string
    judge_id: string
    skater_id: string
    segment: string
    element_deviation: number
    element_raw_score: number
    pcs_deviation: number
    pcs_raw_score: number
  }[]
): Promise<void> => {
  const { error } = await supabaseAdmin.from('marks').insert(marks)
  if (error) console.error('Error batch inserting marks:', error.message)
}

const updateSeenCompetitionsBatch = async (table: 'judges' | 'skaters', ids: string[], competitionId: string) => {
  await supabaseAdmin.from(table).update({ last_seen_competition_id: competitionId }).in('id', ids)

  await supabaseAdmin.from(table).update({ first_seen_competition_id: competitionId }).in('id', ids).is('first_seen_competition_id', null)
}

const recalculateJudgeAggregates = async (judgeId: string) => {
  const { data: marks } = await supabaseAdmin
    .from('marks')
    .select('element_deviation, pcs_deviation, skater_id, skaters(nationality)')
    .eq('judge_id', judgeId)

  if (!marks || marks.length === 0) return

  const byNationality: Record<string, { elementDevs: number[]; pcsDevs: number[] }> = {}

  for (const mark of marks) {
    const nat = (mark.skaters as any)?.nationality
    if (!nat) continue
    if (!byNationality[nat]) byNationality[nat] = { elementDevs: [], pcsDevs: [] }
    byNationality[nat].elementDevs.push(Number(mark.element_deviation))
    byNationality[nat].pcsDevs.push(Number(mark.pcs_deviation))
  }

  for (const [nationality, { elementDevs, pcsDevs }] of Object.entries(byNationality)) {
    const aggregate = calculateJudgeAggregate(elementDevs, pcsDevs)
    await supabaseAdmin.from('judge_aggregates').upsert(
      {
        judge_id: judgeId,
        vs_nationality: nationality,
        avg_element_deviation: aggregate.avgElementDeviation,
        avg_element_absolute_deviation: aggregate.avgElementAbsoluteDeviation,
        avg_pcs_deviation: aggregate.avgPcsDeviation,
        avg_pcs_absolute_deviation: aggregate.avgPcsAbsoluteDeviation,
        total_marks: aggregate.totalMarks,
        skater_count: new Set(marks.filter(m => (m.skaters as any)?.nationality === nationality).map(m => m.skater_id)).size,
      },
      { onConflict: 'judge_id,vs_nationality' }
    )
  }
}

const recalculateSkaterSeasonAggregates = async (skaterId: string) => {
  const { data: marks } = await supabaseAdmin
    .from('marks')
    .select('element_deviation, pcs_deviation, competitions(season)')
    .eq('skater_id', skaterId)

  if (!marks || marks.length === 0) return

  const bySeason: Record<string, { elementDevs: number[]; pcsDevs: number[] }> = {}

  for (const mark of marks) {
    const season = (mark.competitions as any)?.season
    if (!season) continue
    if (!bySeason[season]) bySeason[season] = { elementDevs: [], pcsDevs: [] }
    bySeason[season].elementDevs.push(Number(mark.element_deviation))
    bySeason[season].pcsDevs.push(Number(mark.pcs_deviation))
  }

  for (const [season, { elementDevs, pcsDevs }] of Object.entries(bySeason)) {
    const aggregate = calculateSkaterSeasonAggregate(elementDevs, pcsDevs)
    await supabaseAdmin.from('skater_season_aggregates').upsert(
      {
        skater_id: skaterId,
        season,
        avg_element_deviation_received: aggregate.avgElementDeviationReceived,
        avg_pcs_deviation_received: aggregate.avgPcsDeviationReceived,
        total_marks: aggregate.totalMarks,
      },
      { onConflict: 'skater_id,season' }
    )
  }
}

export const insertProtocol = async (
  protocol: ParsedProtocol,
  eventCode: string,
  competitionName: string,
  season: string,
  tier: string,
  date: string,
  location: string
): Promise<void> => {
  const competitionId = await insertCompetition(competitionName, season, eventCode, tier, date, location)
  if (!competitionId) {
    console.error(`Failed to insert competition ${eventCode} — aborting`)
    return
  }
  console.log(`Inserted competition ${eventCode} (${competitionId})`)

  const allJudges: { name: string; nationality: string }[] = []
  const allSkaters: { name: string; nationality: string; discipline: string }[] = []

  for (const mark of protocol.marks) {
    allSkaters.push({
      name: mark.skaterName,
      nationality: mark.skaterNationality,
      discipline: mark.discipline,
    })

    const panel = protocol.panels.find(p => p.discipline === mark.discipline && p.segment === mark.segment)
    if (!panel) continue

    for (const judge of panel.judges) {
      allJudges.push({ name: judge.name, nationality: judge.nationality })
    }
  }

  const judgeIdMap = await upsertJudgesBatch(allJudges)
  const skaterIdMap = await upsertSkatersBatch(allSkaters)

  console.log(`Upserted ${judgeIdMap.size} judges and ${skaterIdMap.size} skaters`)

  await updateSeenCompetitionsBatch('judges', [...judgeIdMap.values()], competitionId)
  await updateSeenCompetitionsBatch('skaters', [...skaterIdMap.values()], competitionId)

  const markRows: {
    competition_id: string
    judge_id: string
    skater_id: string
    segment: string
    element_deviation: number
    element_raw_score: number
    pcs_deviation: number
    pcs_raw_score: number
  }[] = []

  for (const mark of protocol.marks) {
    const skaterId = skaterIdMap.get(`${mark.skaterName}|${mark.skaterNationality}|${mark.discipline}`)
    if (!skaterId) continue

    const panel = protocol.panels.find(p => p.discipline === mark.discipline && p.segment === mark.segment)
    if (!panel) continue

    for (const deviation of mark.judgeDeviations) {
      const judge = panel.judges.find(j => j.position === deviation.position)
      if (!judge) continue

      const judgeId = judgeIdMap.get(`${judge.name}|${judge.nationality}`)
      if (!judgeId) continue

      markRows.push({
        competition_id: competitionId,
        judge_id: judgeId,
        skater_id: skaterId,
        segment: mark.segment,
        element_deviation: deviation.elementDeviation,
        element_raw_score: deviation.elementRawScore,
        pcs_deviation: deviation.pcsDeviation,
        pcs_raw_score: deviation.pcsRawScore,
      })
    }
  }

  await insertMarksBatch(markRows)
  console.log(`Inserted ${markRows.length} marks`)

  const affectedJudgeIds = [...judgeIdMap.values()]
  const affectedSkaterIds = [...skaterIdMap.values()]

  console.log(`Recalculating aggregates for ${affectedJudgeIds.length} judges and ${affectedSkaterIds.length} skaters`)

  for (const judgeId of affectedJudgeIds) {
    await recalculateJudgeAggregates(judgeId)
  }
  for (const skaterId of affectedSkaterIds) {
    await recalculateSkaterSeasonAggregates(skaterId)
  }

  console.log(`Done processing ${eventCode}`)
}
