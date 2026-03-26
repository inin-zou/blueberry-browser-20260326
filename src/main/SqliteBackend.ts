import Database from 'better-sqlite3'
import type {
  StorageBackend,
  WorkflowRecord,
  UrlCompletion,
  ProfileEntry,
  SavedScript,
} from './StorageBackend'

export class SqliteBackend implements StorageBackend {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma('journal_mode = WAL')
    this.createTables()
  }

  private createTables(): void {
    this.db.exec(`
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
      );

      CREATE TABLE IF NOT EXISTS url_completions (
        url TEXT PRIMARY KEY,
        title TEXT,
        visit_count INTEGER DEFAULT 1,
        last_visited INTEGER,
        domain TEXT,
        topic_cluster TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_url_domain ON url_completions(domain);
      CREATE INDEX IF NOT EXISTS idx_url_last_visited ON url_completions(last_visited DESC);

      CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value_json TEXT,
        updated_at INTEGER
      );

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
      );
    `)
  }

  async saveWorkflow(wf: WorkflowRecord): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO workflows (id, name, created_at, duration_ms, actions_json, rrweb_events_blob, summary, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        wf.id,
        wf.name ?? null,
        wf.createdAt,
        wf.durationMs,
        wf.actionsJson,
        wf.rrwebEventsBlob ?? null,
        wf.summary ?? null,
        wf.tags ?? null
      )
  }

  async getWorkflows(): Promise<WorkflowRecord[]> {
    const rows = this.db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all() as any[]
    return rows.map((r) => ({
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
    this.db.prepare('DELETE FROM workflows WHERE id = ?').run(id)
  }

  async saveScript(s: SavedScript): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO saved_scripts (id, name, prompt, script, source_url_pattern, created_at, last_used_at, use_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        s.id,
        s.name,
        s.prompt,
        s.script,
        s.sourceUrlPattern ?? null,
        s.createdAt,
        s.lastUsedAt ?? null,
        s.useCount
      )
  }

  async getScriptsForUrl(url: string): Promise<SavedScript[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM saved_scripts WHERE source_url_pattern IS NULL OR ? LIKE source_url_pattern ORDER BY use_count DESC`
      )
      .all(url) as any[]
    return rows.map((r) => ({
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
    this.db.prepare('DELETE FROM saved_scripts WHERE id = ?').run(id)
  }

  async saveProfile(entry: ProfileEntry): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO user_profile (key, value_json, updated_at) VALUES (?, ?, ?)`
      )
      .run(entry.key, JSON.stringify(entry.value), Date.now())
  }

  async getProfile(key: string): Promise<ProfileEntry | null> {
    const row = this.db.prepare('SELECT * FROM user_profile WHERE key = ?').get(key) as any
    if (!row) return null
    return { key: row.key, value: JSON.parse(row.value_json) }
  }

  async saveUrls(entries: UrlCompletion[]): Promise<void> {
    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO url_completions (url, title, visit_count, last_visited, domain, topic_cluster)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    const tx = this.db.transaction((entries: UrlCompletion[]) => {
      for (const e of entries) {
        insert.run(e.url, e.title ?? null, e.visitCount, e.lastVisited, e.domain, e.topicCluster ?? null)
      }
    })
    tx(entries)
  }

  async searchUrls(prefix: string, limit = 10): Promise<UrlCompletion[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM url_completions WHERE url LIKE ? OR title LIKE ? ORDER BY visit_count DESC LIMIT ?`
      )
      .all(`%${prefix}%`, `%${prefix}%`, limit) as any[]
    return rows.map((r) => ({
      url: r.url,
      title: r.title,
      visitCount: r.visit_count,
      lastVisited: r.last_visited,
      domain: r.domain,
      topicCluster: r.topic_cluster,
    }))
  }

  close(): void {
    this.db.close()
  }
}
