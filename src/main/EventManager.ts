import { ipcMain, WebContents } from "electron";
import type { Window } from "./Window";
import { CompletionEngine } from "./CompletionEngine";
import { AnnotationManager } from "./AnnotationManager";
import { AttentionEngine } from "./AttentionEngine";
import { HistoryImporter } from "./HistoryImporter";
import { ProfileBuilder } from "./ProfileBuilder";
import { TabSynthesizer } from "./TabSynthesizer";
import { PageRewriter } from "./PageRewriter";
import { SandboxManager } from "./SandboxManager";
import { WorkflowRecorder } from "./WorkflowRecorder";
import type { RawHistoryEntry } from "./HistoryImporter";

export class EventManager {
  private mainWindow: Window;
  private completionEngine: CompletionEngine;
  private annotationManager: AnnotationManager;
  private attentionEngine: AttentionEngine;
  private historyImporter: HistoryImporter;
  private profileBuilder: ProfileBuilder;
  private tabSynthesizer: TabSynthesizer;
  private pageRewriter: PageRewriter;
  private sandboxManager: SandboxManager;
  private workflowRecorder: WorkflowRecorder;

  constructor(mainWindow: Window) {
    this.mainWindow = mainWindow;
    this.completionEngine = new CompletionEngine(this.mainWindow.aiEventLog);
    this.annotationManager = new AnnotationManager(
      this.mainWindow.eventBus,
      this.mainWindow.aiEventLog,
      () => this.mainWindow.activeTab
    );
    this.historyImporter = new HistoryImporter();
    this.profileBuilder = new ProfileBuilder();
    this.annotationManager.start();
    this.attentionEngine = new AttentionEngine(this.mainWindow.eventBus);
    this.attentionEngine.start();
    this.tabSynthesizer = new TabSynthesizer(
      this.mainWindow.eventBus,
      this.mainWindow.aiEventLog,
      () => this.mainWindow.allTabs,
    );
    this.tabSynthesizer.start();
    this.pageRewriter = new PageRewriter(this.mainWindow.aiEventLog);
    this.sandboxManager = new SandboxManager(this.mainWindow.aiEventLog);
    this.workflowRecorder = new WorkflowRecorder(
      this.mainWindow.eventBus,
      this.mainWindow.ringBuffer,
    );
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Tab management events
    this.handleTabEvents();

    // Sidebar events
    this.handleSidebarEvents();

    // Page content events
    this.handlePageContentEvents();

    // Dark mode events
    this.handleDarkModeEvents();

    // Debug events
    this.handleDebugEvents();

    // rrweb events from tab preload bridge
    this.handleRrwebEvents();

    // Ghost text completion events
    this.handleCompletionEvents();

    // Selection pill events
    this.handleSelectionEvents();

    // Annotation signal events (dismiss forwarding)
    this.handleAnnotationSignalEvents();

    // Browser history import events
    this.handleHistoryEvents();

    // Cross-tab synthesis events
    this.handleSynthesisEvents();

    // Page rewrite events
    this.handlePageRewriteEvents();

    // Sandbox execution events
    this.handleSandboxEvents();

    // Workflow recording events
    this.handleWorkflowEvents();
  }

  private handleRrwebEvents(): void {
    ipcMain.on('rrweb:event', (_event, data) => {
      this.mainWindow.eventBus.emit('rrweb:event', data);
      this.mainWindow.ringBuffer.push(data);
    });
  }

  private handleCompletionEvents(): void {
    ipcMain.on('completion:request', async (_event, data) => {
      // Ignore internal acceptance signals sent by the ghost-text script
      if (data && data._accepted) return;

      const tab = (data && data.tabId ? this.mainWindow.getTab(data.tabId) : null)
        ?? this.mainWindow.activeTab;

      const result = await this.completionEngine.complete(data, tab);
      if (result && tab) {
        tab.webContents.send('completion:response', result);
      }
    });
  }

  private handleTabEvents(): void {
    // Create new tab
    ipcMain.handle("create-tab", (_, url?: string) => {
      const newTab = this.mainWindow.createTab(url);
      return { id: newTab.id, title: newTab.title, url: newTab.url };
    });

    // Close tab
    ipcMain.handle("close-tab", (_, id: string) => {
      this.mainWindow.closeTab(id);
    });

    // Switch tab
    ipcMain.handle("switch-tab", (_, id: string) => {
      this.mainWindow.switchActiveTab(id);
    });

    // Get tabs
    ipcMain.handle("get-tabs", () => {
      const activeTabId = this.mainWindow.activeTab?.id;
      return this.mainWindow.allTabs.map((tab) => ({
        id: tab.id,
        title: tab.title,
        url: tab.url,
        isActive: activeTabId === tab.id,
      }));
    });

    // Navigation (for compatibility with existing code)
    ipcMain.handle("navigate-to", (_, url: string) => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.loadURL(url);
      }
    });

    ipcMain.handle("navigate-tab", async (_, tabId: string, url: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        await tab.loadURL(url);
        return true;
      }
      return false;
    });

    ipcMain.handle("go-back", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goBack();
      }
    });

    ipcMain.handle("go-forward", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.goForward();
      }
    });

    ipcMain.handle("reload", () => {
      if (this.mainWindow.activeTab) {
        this.mainWindow.activeTab.reload();
      }
    });

    // Tab-specific navigation handlers
    ipcMain.handle("tab-go-back", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goBack();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-go-forward", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.goForward();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-reload", (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        tab.reload();
        return true;
      }
      return false;
    });

    ipcMain.handle("tab-screenshot", async (_, tabId: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        const image = await tab.screenshot();
        return image.toDataURL();
      }
      return null;
    });

    ipcMain.handle("tab-run-js", async (_, tabId: string, code: string) => {
      const tab = this.mainWindow.getTab(tabId);
      if (tab) {
        return await tab.runJs(code);
      }
      return null;
    });

    // Tab info
    ipcMain.handle("get-active-tab-info", () => {
      const activeTab = this.mainWindow.activeTab;
      if (activeTab) {
        return {
          id: activeTab.id,
          url: activeTab.url,
          title: activeTab.title,
          canGoBack: activeTab.webContents.canGoBack(),
          canGoForward: activeTab.webContents.canGoForward(),
        };
      }
      return null;
    });
  }

  private handleSidebarEvents(): void {
    // Toggle sidebar
    ipcMain.handle("toggle-sidebar", () => {
      this.mainWindow.sidebar.toggle();
      this.mainWindow.updateAllBounds();
      return true;
    });

    // Chat message
    ipcMain.handle("sidebar-chat-message", async (_, request) => {
      // The LLMClient now handles getting the screenshot and context directly
      await this.mainWindow.sidebar.client.sendChatMessage(request);
    });

    // Clear chat
    ipcMain.handle("sidebar-clear-chat", () => {
      this.mainWindow.sidebar.client.clearMessages();
      return true;
    });

    // Get messages
    ipcMain.handle("sidebar-get-messages", () => {
      return this.mainWindow.sidebar.client.getMessages();
    });
  }

  private handlePageContentEvents(): void {
    // Get page content
    ipcMain.handle("get-page-content", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabHtml();
        } catch (error) {
          console.error("Error getting page content:", error);
          return null;
        }
      }
      return null;
    });

    // Get page text
    ipcMain.handle("get-page-text", async () => {
      if (this.mainWindow.activeTab) {
        try {
          return await this.mainWindow.activeTab.getTabText();
        } catch (error) {
          console.error("Error getting page text:", error);
          return null;
        }
      }
      return null;
    });

    // Get current URL
    ipcMain.handle("get-current-url", () => {
      if (this.mainWindow.activeTab) {
        return this.mainWindow.activeTab.url;
      }
      return null;
    });
  }

  private handleDarkModeEvents(): void {
    // Dark mode broadcasting
    ipcMain.on("dark-mode-changed", (event, isDarkMode) => {
      this.broadcastDarkMode(event.sender, isDarkMode);
    });
  }

  private handleDebugEvents(): void {
    // Ping test
    ipcMain.on("ping", () => console.log("pong"));
  }

  private broadcastDarkMode(sender: WebContents, isDarkMode: boolean): void {
    // Send to topbar
    if (this.mainWindow.topBar.view.webContents !== sender) {
      this.mainWindow.topBar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode
      );
    }

    // Send to sidebar
    if (this.mainWindow.sidebar.view.webContents !== sender) {
      this.mainWindow.sidebar.view.webContents.send(
        "dark-mode-updated",
        isDarkMode
      );
    }

    // Send to all tabs
    this.mainWindow.allTabs.forEach((tab) => {
      if (tab.webContents !== sender) {
        tab.webContents.send("dark-mode-updated", isDarkMode);
      }
    });
  }

  private handleAnnotationSignalEvents(): void {
    ipcMain.on('attention:signal', (_event, data) => {
      if (data && data.type === 'annotation:dismissed') {
        this.mainWindow.eventBus.emit('annotation:dismissed', { annotationId: data.annotationId });
      }
    });
  }

  private handleSelectionEvents(): void {
    ipcMain.on('selection:action', async (_event, data: { action: string; text: string; url: string; context: string }) => {
      if (data.action === 'ask') {
        const sidebar = this.mainWindow.sidebar;
        if (!sidebar.getIsVisible()) {
          sidebar.toggle();
          this.mainWindow.updateAllBounds();
        }
        sidebar.view.webContents.send('sidebar:open-with-context', {
          text: data.text,
          url: data.url,
          context: data.context,
          mode: 'ask',
        });
      } else if (data.action === 'explain') {
        // Inline explain — send brief explanation back to the tab (no sidebar)
        const tab = this.mainWindow.activeTab;
        if (!tab) return;

        try {
          const { streamText } = await import('ai');
          const { anthropic } = await import('@ai-sdk/anthropic');

          const result = await streamText({
            model: anthropic('claude-sonnet-4-6'),
            messages: [
              {
                role: 'system',
                content: 'You are a concise knowledge assistant. Explain the given text in 1-2 short sentences. No emojis. No markdown. Plain text only. Be direct and informative.',
              },
              {
                role: 'user',
                content: `Explain this briefly: "${data.text}"\n\nContext from the page: ${data.context.substring(0, 500)}`,
              },
            ],
            temperature: 0.3,
            maxTokens: 100,
          });

          let explanation = '';
          for await (const chunk of result.textStream) {
            explanation += chunk;
          }

          // Send response back to the tab for inline rendering
          tab.webContents.send('page:explain-response', {
            text: data.text,
            explanation: explanation.trim(),
          });

          // Log to AIEventLog
          this.mainWindow.aiEventLog.log({
            id: `explain-${Date.now()}`,
            timestamp: Date.now(),
            tabId: tab.id,
            type: 'selection-explain',
            trigger: { source: 'selection', userInput: data.text },
            output: { model: 'cloud', content: explanation.trim(), latencyMs: 0 },
            disposition: 'pending',
          });
        } catch (err) {
          console.error('Inline explain error:', err);
          // Fallback: open sidebar instead
          const sidebar = this.mainWindow.sidebar;
          if (!sidebar.getIsVisible()) {
            sidebar.toggle();
            this.mainWindow.updateAllBounds();
          }
          sidebar.view.webContents.send('sidebar:open-with-context', {
            text: data.text,
            url: data.url,
            context: data.context,
            mode: 'explain',
          });
        }
      }
    });
  }

  private handleHistoryEvents(): void {
    ipcMain.handle('history:available-browsers', () => {
      return this.historyImporter.getAvailableBrowsers();
    });

    ipcMain.handle('history:import', async (_event, browserIds: string[]) => {
      let allEntries: RawHistoryEntry[] = [];
      for (const id of browserIds) {
        const entries = await this.historyImporter.importBrowser(id);
        allEntries = allEntries.concat(entries);
      }

      const profile = this.profileBuilder.build(allEntries, browserIds);
      const urlCompletions = this.profileBuilder.toUrlCompletions(allEntries);

      // Feed interests into the sidebar LLM client for personalization
      this.mainWindow.sidebar.client.setUserProfile(profile.inferredInterests);

      return { profile, urlCount: urlCompletions.length };
    });
  }

  private handleSynthesisEvents(): void {
    // Handle synthesis request from sidebar
    ipcMain.handle('synthesis:run', async (_event, tabIds?: string[]) => {
      return await this.tabSynthesizer.synthesize(tabIds);
    });

    // Forward synthesis offer to sidebar
    this.mainWindow.eventBus.on('synthesis:offer', (data) => {
      this.mainWindow.sidebar.view.webContents.send('synthesis:offer', data);
    });
  }

  private handlePageRewriteEvents(): void {
    // Triggered by a button in the sidebar or topbar to analyze and rewrite the current page
    ipcMain.handle('page:rewrite', async () => {
      const tab = this.mainWindow.activeTab;
      if (!tab) return null;
      const result = await this.pageRewriter.rewrite(tab);
      if (result) {
        tab.webContents.send('page:rewrite', result);
      }
      return result;
    });

    // Restore the original page view (remove the AI overlay panel)
    ipcMain.on('page:restore', () => {
      const tab = this.mainWindow.activeTab;
      if (tab) {
        tab.webContents.send('page:restore', {});
      }
    });
  }

  private handleSandboxEvents(): void {
    // Execute a script in an isolated sandbox against the current page's DOM snapshot
    ipcMain.handle('sandbox:execute', async (_event, data: { script: string }) => {
      const tab = this.mainWindow.activeTab;
      if (!tab) {
        return {
          id: 'err',
          status: 'error',
          error: 'No active tab',
          output: null,
          consoleOutput: [],
          executionTimeMs: 0,
          script: data.script,
        };
      }

      let domSnapshot: string;
      try {
        domSnapshot = await tab.getDomSnapshot();
      } catch {
        return {
          id: 'err',
          status: 'error',
          error: 'Failed to capture DOM',
          output: null,
          consoleOutput: [],
          executionTimeMs: 0,
          script: data.script,
        };
      }

      return await this.sandboxManager.execute({
        id: `sandbox-${Date.now()}`,
        domSnapshot,
        script: data.script,
        sourceTabId: tab.id,
      });
    });

    // Apply sandbox script result to the live page
    ipcMain.on('sandbox:apply', (_event, data: { script: string }) => {
      const tab = this.mainWindow.activeTab;
      if (tab) {
        tab.runJs(data.script);
      }
    });
  }

  private handleWorkflowEvents(): void {
    ipcMain.handle('workflow:start-recording', () => {
      const tab = this.mainWindow.activeTab;
      if (tab) {
        this.workflowRecorder.startRecording(tab.id);
        return { recording: true };
      }
      return { recording: false };
    });

    ipcMain.handle('workflow:stop-recording', async () => {
      const recording = this.workflowRecorder.stopRecording();
      if (!recording) return null;

      const summaryPrompt = this.workflowRecorder.generateSummaryPrompt(recording);
      return { recording, summaryPrompt };
    });

    ipcMain.handle('workflow:get-status', () => {
      return {
        isRecording: this.workflowRecorder.isRecording,
        actionCount: this.workflowRecorder.actionCount,
      };
    });

    ipcMain.handle('workflow:save', async (_event, data: { recording: any; name: string; summary: string }) => {
      return { saved: true, id: data.recording.id };
    });
  }

  // Clean up event listeners
  public cleanup(): void {
    this.annotationManager.stop();
    this.attentionEngine.stop();
    this.tabSynthesizer.stop();
    ipcMain.removeAllListeners();
  }
}
