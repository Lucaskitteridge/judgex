import { fetchPdf } from '../lib/fetcher'
import { parseProtocol } from '../lib/parser'
import { insertProtocol } from '../lib/db'
import { supabaseAdmin } from '../../../lib/supabase'

describe('insertProtocol', () => {
  it('inserts a full competition into the database', async () => {
    const buffer = await fetchPdf('2425', 'gpusa2024')
    expect(buffer).not.toBeNull()

    const protocol = await parseProtocol(buffer!)

    await insertProtocol(protocol, 'gpusa2024', '2024 Skate America', '2425', 'grand_prix', '2024-10-18', 'Allen, TX')

    // Verify competition was inserted
    const { data: competition } = await supabaseAdmin.from('competitions').select('*').eq('event_code', 'gpusa2024').single()

    expect(competition).not.toBeNull()
    expect(competition.name).toBe('2024 Skate America')
    expect(competition.season).toBe('2425')

    // Verify judges were inserted
    const { data: judges } = await supabaseAdmin.from('judges').select('*').eq('nationality', 'USA')

    expect(judges).not.toBeNull()
    expect(judges!.length).toBeGreaterThan(0)
    console.log(
      'Sample US judges:',
      judges!.slice(0, 3).map(j => j.name)
    )

    // Verify skaters were inserted
    const { data: skaters } = await supabaseAdmin.from('skaters').select('*').eq('nationality', 'JPN')

    expect(skaters).not.toBeNull()
    expect(skaters!.length).toBeGreaterThan(0)
    console.log(
      'Sample JPN skaters:',
      skaters!.slice(0, 3).map(s => s.name)
    )

    // Verify marks were inserted
    const { data: marks } = await supabaseAdmin.from('marks').select('*').eq('competition_id', competition.id)

    expect(marks).not.toBeNull()
    expect(marks!.length).toBeGreaterThan(0)
    console.log('Total marks inserted:', marks!.length)

    // Verify judge aggregates were calculated
    const { data: aggregates } = await supabaseAdmin.from('judge_aggregates').select('*').limit(5)

    expect(aggregates).not.toBeNull()
    expect(aggregates!.length).toBeGreaterThan(0)
    console.log('Sample aggregates:', JSON.stringify(aggregates!.slice(0, 2), null, 2))

    // Verify skater season aggregates were calculated
    const { data: seasonAggs } = await supabaseAdmin.from('skater_season_aggregates').select('*').limit(5)

    expect(seasonAggs).not.toBeNull()
    expect(seasonAggs!.length).toBeGreaterThan(0)
    console.log('Sample season aggregates:', JSON.stringify(seasonAggs!.slice(0, 2), null, 2))
  }, 120000) // 2 minute timeout — lots of db operations
})
