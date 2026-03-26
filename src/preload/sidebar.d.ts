import { ElectronAPI } from "@electron-toolkit/preload";

interface ChatRequest {
  message: string;
  context: {
    url: string | null;
    content: string | null;
    text: string | null;
  };
  messageId: string;
}

interface ChatResponse {
  messageId: string;
  content: string;
  isComplete: boolean;
}

interface TabInfo {
  id: string;
  title: string;
  url: string;
  isActive: boolean;
}

interface SandboxResult {
  id: string;
  status: 'success' | 'error' | 'timeout';
  output: any;
  consoleOutput: string[];
  error?: string;
  executionTimeMs: number;
  script: string;
}

interface SidebarAPI {
  // Chat functionality
  sendChatMessage: (request: ChatRequest) => Promise<void>;
  onChatResponse: (callback: (data: ChatResponse) => void) => void;
  removeChatResponseListener: () => void;

  // Page content access
  getPageContent: () => Promise<string | null>;
  getPageText: () => Promise<string | null>;
  getCurrentUrl: () => Promise<string | null>;

  // Tab information
  getActiveTabInfo: () => Promise<TabInfo | null>;

  // Chat management
  clearChat: () => Promise<void>;
  getMessages: () => Promise<any[]>;
  onMessagesUpdated: (callback: (messages: any[]) => void) => void;
  removeMessagesUpdatedListener: () => void;

  // Selection pill context
  onSelectionContext: (callback: (data: { text: string; url: string; context: string; mode: string }) => void) => void;
  removeSelectionContextListener: () => void;

  // Cross-tab synthesis
  requestSynthesis: (tabIds?: string[]) => Promise<import('../main/TabSynthesizer').SynthesisResult | null>;
  onSynthesisOffer: (callback: (data: { tabCount: number; timestamp: number }) => void) => void;
  removeSynthesisOfferListener: () => void;

  // Sandbox execution
  executeSandbox: (script: string) => Promise<SandboxResult>;
  applySandbox: (script: string) => void;

  // Workflow recording
  startRecording: () => Promise<{ recording: boolean }>;
  stopRecording: () => Promise<{ recording: any; summaryPrompt: string } | null>;
  getRecordingStatus: () => Promise<{ isRecording: boolean; actionCount: number }>;
  saveWorkflow: (data: { recording: any; name: string; summary: string }) => Promise<{ saved: boolean; id: string }>;

  // History import
  getAvailableBrowsers: () => Promise<{ id: string; name: string; available: boolean }[]>;
  importHistory: (browserIds: string[]) => Promise<{ urlCount: number }>;

  // Page rewrite
  rewritePage: () => Promise<any>;
  restorePage: () => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    sidebarAPI: SidebarAPI;
  }
}

