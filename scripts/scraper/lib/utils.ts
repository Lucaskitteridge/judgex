const TITLE_CASE_REGEX = /(?:^|\s|\/)\S/g

// Removes line breaks and extra whitespace from PDF text fragments
export const cleanName = (raw: string): string => raw.replace(/\n/g, '').replace(/\s+/g, ' ').trim()

// Converts "LORRIE PARKER" to "Lorrie Parker"
export const toTitleCase = (str: string): string =>
  str
    .toLowerCase()
    .replace(TITLE_CASE_REGEX, char => char.toUpperCase())
    .trim()
