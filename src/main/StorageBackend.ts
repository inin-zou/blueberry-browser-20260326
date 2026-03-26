export interface WorkflowRecord {
  id: string
  name?: string
  createdAt: number
  durationMs: number
  actionsJson: string
  rrwebEventsBlob?: Buffer
  summary?: string
  tags?: string
}

export interface UrlCompletion {
  url: string
  title?: string
  visitCount: number
  lastVisited: number
  domain: string
  topicCluster?: string
}

export interface ProfileEntry {
  key: string
  value: any
}

export interface SavedScript {
  id: string
  name: string
  prompt: string
  script: string
  sourceUrlPattern?: string
  createdAt: number
  lastUsedAt?: number
  useCount: number
}

export interface StorageBackend {
  saveWorkflow(workflow: WorkflowRecord): Promise<void>
  getWorkflows(): Promise<WorkflowRecord[]>
  deleteWorkflow(id: string): Promise<void>

  saveScript(script: SavedScript): Promise<void>
  getScriptsForUrl(url: string): Promise<SavedScript[]>
  deleteScript(id: string): Promise<void>

  saveProfile(entry: ProfileEntry): Promise<void>
  getProfile(key: string): Promise<ProfileEntry | null>

  saveUrls(entries: UrlCompletion[]): Promise<void>
  searchUrls(prefix: string, limit?: number): Promise<UrlCompletion[]>

  close(): void
}
