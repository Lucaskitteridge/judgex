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
  it('inserts multiple seasons into the database', async () => {
    const competitions = [
      { season: '2324', code: 'gpusa2023', name: '2023 Skate America', tier: 'grand_prix', date: '2023-10-20', location: 'Allen, TX' },
      { season: '2223', code: 'gpusa2022', name: '2022 Skate America', tier: 'grand_prix', date: '2022-10-21', location: 'Norwood, MA' },
      { season: '2122', code: 'gpusa2021', name: '2021 Skate America', tier: 'grand_prix', date: '2021-10-22', location: 'Las Vegas, NV' },
      { season: '1920', code: 'gpusa2019', name: '2019 Skate America', tier: 'grand_prix', date: '2019-10-18', location: 'Las Vegas, NV' },
    ]

    for (const comp of competitions) {
      const buffer = await fetchPdf(comp.season, comp.code)
      if (!buffer) {
        console.log(`${comp.season}: fetch failed`)
        continue
      }

      const protocol = await parseProtocol(buffer, comp.season)
      await insertProtocol(protocol, comp.code, comp.name, comp.season, comp.tier, comp.date, comp.location)

      const { data: competition } = await supabaseAdmin.from('competitions').select('id').eq('event_code', comp.code).single()

      const { count } = await supabaseAdmin.from('marks').select('*', { count: 'exact', head: true }).eq('competition_id', competition!.id)

      console.log(`${comp.season}: marks=${count}`)
    }
  }, 300000)
})
