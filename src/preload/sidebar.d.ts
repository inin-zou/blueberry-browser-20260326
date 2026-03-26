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

  // Cross-tab synthesis
  requestSynthesis: (tabIds?: string[]) => Promise<import('../main/TabSynthesizer').SynthesisResult | null>;
  onSynthesisOffer: (callback: (data: { tabCount: number; timestamp: number }) => void) => void;
  removeSynthesisOfferListener: () => void;

  // Sandbox execution
  executeSandbox: (script: string) => Promise<SandboxResult>;
  applySandbox: (script: string) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    sidebarAPI: SidebarAPI;
  }
}

