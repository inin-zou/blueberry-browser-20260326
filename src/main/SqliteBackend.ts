import initSqlJs, { type Database } from 'sql.js'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import type {
  StorageBackend,
  WorkflowRecord,
  UrlCompletion,
  ProfileEntry,
  SavedScript,
} from './StorageBackend'

export class SqliteBackend implements StorageBackend {
  private db: Database | null = null
  private dbPath: string
  private ready: Promise<void>

  constructor(dbPath: string) {
    this.dbPath = dbPath
    this.ready = this.init()
  }

  private async init(): Promise<void> {
    const SQL = await initSqlJs()
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath)
      this.db = new SQL.Database(buffer)
    } else {
      this.db = new SQL.Database()
    }
    this.createTables()
  }

  private ensureDb(): Database {
    if (!this.db) throw new Error('Database not initialized')
    return this.db
  }

  private save(): void {
    if (!this.db) return
    const data = this.db.export()
    writeFileSync(this.dbPath, Buffer.from(data))
  }

  private createTables(): void {
    const db = this.ensureDb()
    db.run(`
      CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT,
        created_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        actions_json TEXT NOT NULL,
        rrweb_events_blob BLOB,
        summary TEXT,
        tags TEXT,
        synced_at INTEGER
      )
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS url_completions (
        url TEXT PRIMARY KEY,
        title TEXT,
        visit_count INTEGER DEFAULT 1,
        last_visited INTEGER,
        domain TEXT,
        topic_cluster TEXT
      )
    `)
    db.run(`CREATE INDEX IF NOT EXISTS idx_url_domain ON url_completions(domain)`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_url_last_visited ON url_completions(last_visited DESC)`)
    db.run(`
      CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value_json TEXT,
        updated_at INTEGER
      )
    `)
    db.run(`
      CREATE TABLE IF NOT EXISTS saved_scripts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prompt TEXT NOT NULL,
        script TEXT NOT NULL,
        source_url_pattern TEXT,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER,
        use_count INTEGER DEFAULT 0,
        synced_at INTEGER
      )
    `)
    this.save()
  }

  private queryAll(sql: string, params: any[] = []): any[] {
    const db = this.ensureDb()
    const stmt = db.prepare(sql)
    if (params.length) stmt.bind(params)
    const results: any[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject())
    }
    stmt.free()
    return results
  }

  private queryOne(sql: string, params: any[] = []): any | null {
    const results = this.queryAll(sql, params)
    return results.length > 0 ? results[0] : null
  }

  private runSql(sql: string, params: any[] = []): void {
    const db = this.ensureDb()
    db.run(sql, params)
  }

  async saveWorkflow(wf: WorkflowRecord): Promise<void> {
    await this.ready
    this.runSql(
      `INSERT OR REPLACE INTO workflows (id, name, created_at, duration_ms, actions_json, rrweb_events_blob, summary, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [wf.id, wf.name ?? null, wf.createdAt, wf.durationMs, wf.actionsJson, wf.rrwebEventsBlob ?? null, wf.summary ?? null, wf.tags ?? null]
    )
    this.save()
  }

  async getWorkflows(): Promise<WorkflowRecord[]> {
    await this.ready
    return this.queryAll('SELECT * FROM workflows ORDER BY created_at DESC').map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
      durationMs: r.duration_ms,
      actionsJson: r.actions_json,
      rrwebEventsBlob: r.rrweb_events_blob,
      summary: r.summary,
      tags: r.tags,
    }))
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.ready
    this.runSql('DELETE FROM workflows WHERE id = ?', [id])
    this.save()
  }

  async saveScript(s: SavedScript): Promise<void> {
    await this.ready
    this.runSql(
      `INSERT OR REPLACE INTO saved_scripts (id, name, prompt, script, source_url_pattern, created_at, last_used_at, use_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.name, s.prompt, s.script, s.sourceUrlPattern ?? null, s.createdAt, s.lastUsedAt ?? null, s.useCount]
    )
    this.save()
  }

  async getScriptsForUrl(url: string): Promise<SavedScript[]> {
    await this.ready
    return this.queryAll(
      `SELECT * FROM saved_scripts WHERE source_url_pattern IS NULL OR ? LIKE source_url_pattern ORDER BY use_count DESC`,
      [url]
    ).map((r) => ({
      id: r.id,
      name: r.name,
      prompt: r.prompt,
      script: r.script,
      sourceUrlPattern: r.source_url_pattern,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      useCount: r.use_count,
    }))
  }

  async deleteScript(id: string): Promise<void> {
    await this.ready
    this.runSql('DELETE FROM saved_scripts WHERE id = ?', [id])
    this.save()
  }

  async saveProfile(entry: ProfileEntry): Promise<void> {
    await this.ready
    this.runSql(
      `INSERT OR REPLACE INTO user_profile (key, value_json, updated_at) VALUES (?, ?, ?)`,
      [entry.key, JSON.stringify(entry.value), Date.now()]
    )
    this.save()
  }

  async getProfile(key: string): Promise<ProfileEntry | null> {
    await this.ready
    const row = this.queryOne('SELECT * FROM user_profile WHERE key = ?', [key])
    if (!row) return null
    return { key: row.key, value: JSON.parse(row.value_json) }
  }

  async saveUrls(entries: UrlCompletion[]): Promise<void> {
    await this.ready
    for (const e of entries) {
      this.runSql(
        `INSERT OR REPLACE INTO url_completions (url, title, visit_count, last_visited, domain, topic_cluster) VALUES (?, ?, ?, ?, ?, ?)`,
        [e.url, e.title ?? null, e.visitCount, e.lastVisited, e.domain, e.topicCluster ?? null]
      )
    }
    this.save()
  }

  async searchUrls(prefix: string, limit = 10): Promise<UrlCompletion[]> {
    await this.ready
    return this.queryAll(
      `SELECT * FROM url_completions WHERE url LIKE ? OR title LIKE ? ORDER BY visit_count DESC LIMIT ?`,
      [`%${prefix}%`, `%${prefix}%`, limit]
    ).map((r) => ({
      url: r.url,
      title: r.title,
      visitCount: r.visit_count,
      lastVisited: r.last_visited,
      domain: r.domain,
      topicCluster: r.topic_cluster,
    }))
  }

  close(): void {
    if (this.db) {
      this.save()
      this.db.close()
      this.db = null
    }
  }
}
