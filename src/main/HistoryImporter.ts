import initSqlJs from 'sql.js'
import { existsSync, copyFileSync, mkdtempSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir, homedir } from 'os'

export interface RawHistoryEntry {
  url: string
  title: string
  visitCount: number
  lastVisited: number   // Unix timestamp ms
}

interface BrowserConfig {
  name: string
  historyPath: string
  query: string
  timestampConverter: (raw: number) => number
}

// Chrome epoch: microseconds since 1601-01-01
// Unix epoch offset: 11644473600 seconds
const CHROME_EPOCH_OFFSET = 11644473600n
const chromeToUnix = (chromeTime: number): number => {
  const unixMicro = BigInt(chromeTime) - CHROME_EPOCH_OFFSET * 1000000n
  return Number(unixMicro / 1000n) // convert to ms
}

const BROWSER_CONFIGS: Record<string, BrowserConfig> = {
  chrome: {
    name: 'Google Chrome',
    historyPath: join(homedir(), 'Library/Application Support/Google/Chrome/Default/History'),
    query: 'SELECT url, title, visit_count, last_visit_time FROM urls ORDER BY visit_count DESC LIMIT 5000',
    timestampConverter: chromeToUnix,
  },
  safari: {
    name: 'Safari',
    historyPath: join(homedir(), 'Library/Safari/History.db'),
    query: 'SELECT url, title, visit_count, last_visit_time FROM history_items LEFT JOIN history_visits ON history_items.id = history_visits.history_item ORDER BY visit_count DESC LIMIT 5000',
    timestampConverter: (t: number) => t * 1000, // Safari uses seconds
  },
  firefox: {
    name: 'Firefox',
    historyPath: join(homedir(), 'Library/Application Support/Firefox/Profiles'),
    query: 'SELECT url, title, visit_count, last_visit_date FROM moz_places ORDER BY visit_count DESC LIMIT 5000',
    timestampConverter: (t: number) => Math.floor(t / 1000), // Firefox uses microseconds
  },
}

export class HistoryImporter {
  // Check which browsers are available
  getAvailableBrowsers(): { id: string; name: string; available: boolean }[] {
    return Object.entries(BROWSER_CONFIGS).map(([id, config]) => ({
      id,
      name: config.name,
      available: existsSync(config.historyPath),
    }))
  }

  // Import history from a specific browser
  async importBrowser(browserId: string): Promise<RawHistoryEntry[]> {
    const config = BROWSER_CONFIGS[browserId]
    if (!config) throw new Error(`Unknown browser: ${browserId}`)
    if (!existsSync(config.historyPath)) return []

    // Copy DB to temp dir (browser may have it locked)
    const tempDir = mkdtempSync(join(tmpdir(), 'blueberry-history-'))
    const tempDb = join(tempDir, 'History-copy')

    try {
      copyFileSync(config.historyPath, tempDb)
      const SQL = await initSqlJs()
      const buffer = readFileSync(tempDb)
      const db = new SQL.Database(buffer)

      let rows: any[] = []
      try {
        const stmt = db.prepare(config.query)
        while (stmt.step()) {
          rows.push(stmt.getAsObject())
        }
        stmt.free()
      } catch {
        // Safari/Firefox may have different schemas
        rows = []
      } finally {
        db.close()
      }

      return rows.map((row: any) => ({
        url: row.url || '',
        title: row.title || '',
        visitCount: row.visit_count || 1,
        lastVisited: config.timestampConverter(row.last_visit_time || row.last_visit_date || 0),
      })).filter((e: any) => e.url.startsWith('http'))
    } catch (err) {
      console.error(`Failed to import ${config.name} history:`, err)
      return []
    }
  }
}
