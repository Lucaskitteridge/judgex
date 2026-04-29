import { fetchPdf } from '../lib/fetcher'
import { parseProtocol } from '../lib/parser'
import { insertProtocol } from '../lib/db'
import { supabaseAdmin } from '../../../lib/supabase'

describe('insertProtocol', () => {
  beforeAll(async () => {
    await supabaseAdmin.from('marks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('judge_aggregates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('skater_season_aggregates').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('judges').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('skaters').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabaseAdmin.from('competitions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  }, 30000)
  it('inserts a full competition into the database', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    expect(buffer).not.toBeNull()

    const protocol = await parseProtocol(buffer!)
    await insertProtocol(protocol, 'gpusa2024', '2024 Skate America', '2425', 'grand_prix', '2024-10-18', 'Allen, TX')

    const { data: competition } = await supabaseAdmin.from('competitions').select('*').eq('event_code', 'gpusa2024').single()

    expect(competition).not.toBeNull()
    expect(competition.name).toBe('2024 Skate America')
    expect(competition.season).toBe('2425')

    const { data: judges } = await supabaseAdmin.from('judges').select('*').eq('nationality', 'USA')

    expect(judges).not.toBeNull()
    expect(judges!.length).toBeGreaterThan(0)

    const { data: skaters } = await supabaseAdmin.from('skaters').select('*').eq('nationality', 'JPN')

    expect(skaters).not.toBeNull()
    expect(skaters!.length).toBeGreaterThan(0)

    const { data: marks } = await supabaseAdmin.from('marks').select('*').eq('competition_id', competition.id)

    expect(marks).not.toBeNull()
    expect(marks!.length).toBe(738)
    expect(marks![0].element_deviation).not.toBeNull()
    expect(marks![0].pcs_deviation).not.toBeNull()

    const { data: aggregates } = await supabaseAdmin.from('judge_aggregates').select('*').limit(5)

    expect(aggregates).not.toBeNull()
    expect(aggregates!.length).toBeGreaterThan(0)
    expect(aggregates![0].avg_element_deviation).not.toBeNull()
    expect(aggregates![0].avg_pcs_deviation).not.toBeNull()

    const { data: seasonAggs } = await supabaseAdmin.from('skater_season_aggregates').select('*').limit(5)

    expect(seasonAggs).not.toBeNull()
    expect(seasonAggs!.length).toBeGreaterThan(0)
    expect(seasonAggs![0].avg_element_deviation_received).not.toBeNull()
    expect(seasonAggs![0].avg_pcs_deviation_received).not.toBeNull()
  }, 120000)
})
