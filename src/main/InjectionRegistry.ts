import type { Tab } from './Tab'

interface RegisteredScript {
  name: string
  code: string
  dependencies: string[]
}

export class InjectionRegistry {
  private scripts: Map<string, RegisteredScript> = new Map()

  register(name: string, code: string, options: { dependencies?: string[] } = {}): void {
    this.scripts.set(name, {
      name,
      code,
      dependencies: options.dependencies ?? [],
    })
  }

  unregister(name: string): void {
    this.scripts.delete(name)
  }

  async injectAll(tab: Tab): Promise<void> {
    const sorted = this.topologicalSort()
    for (const script of sorted) {
      try {
        await tab.runJs(script.code)
      } catch (err) {
        console.error(`Failed to inject ${script.name} into ${tab.id}:`, err)
      }
    }
  }

  private topologicalSort(): RegisteredScript[] {
    const visited = new Set<string>()
    const result: RegisteredScript[] = []

    const visit = (name: string) => {
      if (visited.has(name)) return
      visited.add(name)
      const script = this.scripts.get(name)
      if (!script) return
      for (const dep of script.dependencies) {
        visit(dep)
      }
      result.push(script)
    }

    for (const name of this.scripts.keys()) {
      visit(name)
    }
    return result
  }
}
