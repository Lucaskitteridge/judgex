import axios from 'axios'

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/pdf,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
  'Referer': 'https://results.isu.org/',
}

// Delay helper — waits between requests so we don't get blocked
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Builds the correct URL based on season year
// Pre-2018 seasons use isuresults.com, 2018 onwards use results.isu.org
function buildPdfUrl(season: string, eventCode: string): string {
  const startYear = parseInt(season.slice(0, 2))
  const fullYear = startYear >= 18 ? 2000 + startYear : 1900 + startYear

  if (fullYear < 2018) {
    return `https://www.isuresults.com/results/season${season}/${eventCode}/${eventCode}_protocol.pdf`
  }
  return `https://results.isu.org/results/season${season}/${eventCode}/${eventCode}_protocol.pdf`
}

// Fetches a single PDF and returns it as a Buffer
async function fetchPdf(season: string, eventCode: string): Promise<Buffer | null> {
  const url = buildPdfUrl(season, eventCode)
  console.log(`Fetching: ${url}`)

  try {
    const response = await axios.get(url, {
      headers: HEADERS,
      responseType: 'arraybuffer',
      timeout: 30000,
    })

    console.log(`Successfully fetched ${eventCode} (${response.data.byteLength} bytes)`)
    return Buffer.from(response.data)

  } catch (error: any) {
    if (error.response?.status === 404) {
      console.log(`Not found (404): ${eventCode} — skipping`)
      return null
    }
    if (error.response?.status === 403) {
      console.log(`Blocked (403): ${eventCode} — skipping`)
      return null
    }
    console.error(`Error fetching ${eventCode}: ${error.message}`)
    return null
  }
}

// Fetches multiple PDFs with a delay between each request
export async function fetchMultiplePdfs(
  events: { season: string; eventCode: string }[],
  delayMs: number = 3000
): Promise<{ eventCode: string; buffer: Buffer }[]> {
  const results: { eventCode: string; buffer: Buffer }[] = []

  for (const event of events) {
    const buffer = await fetchPdf(event.season, event.eventCode)

    if (buffer) {
      results.push({ eventCode: event.eventCode, buffer })
    }

    // Wait between requests to avoid triggering rate limiting
    if (events.indexOf(event) < events.length - 1) {
      console.log(`Waiting ${delayMs}ms before next request...`)
      await delay(delayMs)
    }
  }

  return results
}

export { fetchPdf }