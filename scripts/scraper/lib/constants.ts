import type { Discipline, Segment } from './types'

export const DISCIPLINE_MAP: Record<string, Discipline> = {
  PAIRS: 'pairs',
  MEN: 'mens',
  WOMEN: 'womens',
  'ICE DANCE': 'ice_dance',
}

export const SEGMENT_MAP: Record<string, Segment> = {
  'SHORT PROGRAM': 'SP',
  'RHYTHM DANCE': 'SP',
  'FREE SKATING': 'FS',
  'FREE DANCE': 'FS',
}

export const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/pdf,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive',
  Referer: 'https://results.isu.org/',
}

export const FETCH_TIMEOUT_MS = 30000
export const DEFAULT_DELAY_MS = 3000
export const ISU_MODERN_DOMAIN = 'results.isu.org'
export const ISU_LEGACY_DOMAIN = 'www.isuresults.com'
export const MODERN_CUTOFF_YEAR = 2018
