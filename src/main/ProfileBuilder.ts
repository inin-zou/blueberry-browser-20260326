import type { RawHistoryEntry } from './HistoryImporter'
import type { UrlCompletion } from './StorageBackend'

export interface UserProfile {
  importedAt: number
  browsers: string[]
  topDomains: { domain: string; visitCount: number }[]
  topicClusters: { topic: string; domains: string[]; visitCount: number }[]
  frequentUrls: { url: string; title: string; frequency: number }[]
  inferredInterests: string[]
}

export class ProfileBuilder {
  build(entries: RawHistoryEntry[], browsers: string[]): UserProfile {
    const domainMap = new Map<string, number>()
    const urlMap = new Map<string, { title: string; count: number }>()

    for (const entry of entries) {
      try {
        const domain = new URL(entry.url).hostname.replace('www.', '')
        domainMap.set(domain, (domainMap.get(domain) || 0) + entry.visitCount)
      } catch { continue }

      const existing = urlMap.get(entry.url)
      if (!existing || entry.visitCount > existing.count) {
        urlMap.set(entry.url, { title: entry.title, count: entry.visitCount })
      }
    }

    const topDomains = [...domainMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([domain, visitCount]) => ({ domain, visitCount }))

    const frequentUrls = [...urlMap.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 100)
      .map(([url, data]) => ({ url, title: data.title, frequency: data.count }))

    const topicClusters = this.clusterByTopic(topDomains)
    const inferredInterests = topicClusters.slice(0, 10).map((c) => c.topic)

    return {
      importedAt: Date.now(),
      browsers,
      topDomains,
      topicClusters,
      frequentUrls,
      inferredInterests,
    }
  }

  toUrlCompletions(entries: RawHistoryEntry[]): UrlCompletion[] {
    return entries.map((e) => {
      let domain = ''
      try { domain = new URL(e.url).hostname.replace('www.', '') } catch {}
      return {
        url: e.url,
        title: e.title,
        visitCount: e.visitCount,
        lastVisited: e.lastVisited,
        domain,
      }
    })
  }

  private clusterByTopic(domains: { domain: string; visitCount: number }[]): UserProfile['topicClusters'] {
    // Simple keyword-based clustering
    const TOPIC_KEYWORDS: Record<string, string[]> = {
      'Development': ['github.com', 'stackoverflow.com', 'npmjs.com', 'gitlab.com', 'dev.to', 'medium.com'],
      'AI/ML': ['openai.com', 'anthropic.com', 'huggingface.co', 'arxiv.org', 'kaggle.com'],
      'Cloud': ['aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com', 'vercel.com', 'netlify.com'],
      'Shopping': ['amazon.com', 'ebay.com', 'etsy.com', 'shopify.com'],
      'Social': ['twitter.com', 'x.com', 'reddit.com', 'linkedin.com', 'facebook.com'],
      'News': ['news.ycombinator.com', 'techcrunch.com', 'theverge.com', 'arstechnica.com'],
      'Productivity': ['notion.so', 'docs.google.com', 'sheets.google.com', 'figma.com', 'slack.com'],
      'Entertainment': ['youtube.com', 'netflix.com', 'twitch.tv', 'spotify.com'],
    }

    const clusters: UserProfile['topicClusters'] = []
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
      const matchingDomains = domains.filter((d) => keywords.some((k) => d.domain.includes(k)))
      if (matchingDomains.length > 0) {
        clusters.push({
          topic,
          domains: matchingDomains.map((d) => d.domain),
          visitCount: matchingDomains.reduce((sum, d) => sum + d.visitCount, 0),
        })
      }
    }
    return clusters.sort((a, b) => b.visitCount - a.visitCount)
  }
}
