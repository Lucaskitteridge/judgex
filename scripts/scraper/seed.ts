import { fetchPdf } from './lib/fetcher'
import { parseProtocol } from './lib/parser'
import { insertProtocol } from './lib/db'

const seed = async () => {
  console.log('Seeding database with gpusa2024...')

  const buffer = await fetchPdf('2425', 'gpusa2024')
  if (!buffer) {
    console.error('Failed to fetch PDF')
    process.exit(1)
  }

  const protocol = await parseProtocol(buffer, '2425')
  await insertProtocol(protocol, 'gpusa2024', '2024 Skate America', '2425', 'grand_prix', '2024-10-18', 'Allen, TX')

  console.log('Seed complete')
  process.exit(0)
}

seed()
