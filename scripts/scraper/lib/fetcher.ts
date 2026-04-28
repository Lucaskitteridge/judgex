import axios from 'axios'
import {
  FETCH_HEADERS,
  FETCH_TIMEOUT_MS,
  DEFAULT_DELAY_MS,
  ISU_MODERN_DOMAIN,
  ISU_LEGACY_DOMAIN,
  MODERN_CUTOFF_YEAR,
} from './constants'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const buildPdfUrl = (season: string, eventCode: string): string => {
  const startYear = parseInt(season.slice(0, 2))
  const fullYear = startYear >= 50 ? 1900 + startYear : 2000 + startYear
  const domain = fullYear < MODERN_CUTOFF_YEAR ? ISU_LEGACY_DOMAIN : ISU_MODERN_DOMAIN
  return `https://${domain}/results/season${season}/${eventCode}/${eventCode}_protocol.pdf`
}

export const fetchPdf = async (season: string, eventCode: string): Promise<Buffer | null> => {
  const url = buildPdfUrl(season, eventCode)
  console.log(`Fetching: ${url}`)

  try {
    const response = await axios.get(url, {
      headers: FETCH_HEADERS,
      responseType: 'arraybuffer',
      timeout: FETCH_TIMEOUT_MS,
    })
    console.log(`Successfully fetched ${eventCode} (${response.data.byteLength} bytes)`)
    return Buffer.from(response.data)
  } catch (error: any) {
    const status = error.response?.status
    if (status === 404) console.log(`Not found (404): ${eventCode}`)
    else if (status === 403) console.log(`Blocked (403): ${eventCode}`)
    else console.error(`Error fetching ${eventCode}: ${error.message}`)
    return null
  }
}

export const fetchMultiplePdfs = async (
  events: { season: string; eventCode: string }[],
  delayMs: number = DEFAULT_DELAY_MS
): Promise<{ eventCode: string; buffer: Buffer }[]> => {
  const results: { eventCode: string; buffer: Buffer }[] = []

  for (let i = 0; i < events.length; i++) {
    const buffer = await fetchPdf(events[i].season, events[i].eventCode)
    if (buffer) results.push({ eventCode: events[i].eventCode, buffer })
    if (i < events.length - 1) {
      console.log(`Waiting ${delayMs}ms...`)
      await delay(delayMs)
    }
  }

  return results
}
