import { contextBridge } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

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

// Sidebar specific APIs
const sidebarAPI = {
  // Chat functionality
  sendChatMessage: (request: Partial<ChatRequest>) =>
    electronAPI.ipcRenderer.invoke("sidebar-chat-message", request),

  clearChat: () => electronAPI.ipcRenderer.invoke("sidebar-clear-chat"),

  getMessages: () => electronAPI.ipcRenderer.invoke("sidebar-get-messages"),

  onChatResponse: (callback: (data: ChatResponse) => void) => {
    electronAPI.ipcRenderer.on("chat-response", (_, data) => callback(data));
  },

  onMessagesUpdated: (callback: (messages: any[]) => void) => {
    electronAPI.ipcRenderer.on("chat-messages-updated", (_, messages) =>
      callback(messages)
    );
  },

  removeChatResponseListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-response");
  },

  removeMessagesUpdatedListener: () => {
    electronAPI.ipcRenderer.removeAllListeners("chat-messages-updated");
  },

  // Page content access
  getPageContent: () => electronAPI.ipcRenderer.invoke("get-page-content"),
  getPageText: () => electronAPI.ipcRenderer.invoke("get-page-text"),
  getCurrentUrl: () => electronAPI.ipcRenderer.invoke("get-current-url"),

  // Tab information
  getActiveTabInfo: () => electronAPI.ipcRenderer.invoke("get-active-tab-info"),

  // Cross-tab synthesis
  requestSynthesis: (tabIds?: string[]) =>
    electronAPI.ipcRenderer.invoke('synthesis:run', tabIds),

  onSynthesisOffer: (callback: (data: { tabCount: number; timestamp: number }) => void) => {
    electronAPI.ipcRenderer.on('synthesis:offer', (_event, data) => callback(data));
  },

  removeSynthesisOfferListener: () => {
    electronAPI.ipcRenderer.removeAllListeners('synthesis:offer');
  },

  // Sandbox execution
  executeSandbox: (script: string) =>
    electronAPI.ipcRenderer.invoke('sandbox:execute', { script }),

  applySandbox: (script: string) =>
    electronAPI.ipcRenderer.send('sandbox:apply', { script }),

  // Selection pill context (from text selection on page)
  onSelectionContext: (callback: (data: { text: string; url: string; context: string; mode: string }) => void) => {
    electronAPI.ipcRenderer.on('sidebar:open-with-context', (_event, data) => callback(data));
  },

  removeSelectionContextListener: () => {
    electronAPI.ipcRenderer.removeAllListeners('sidebar:open-with-context');
  },

  // Workflow recording
  startRecording: () => electronAPI.ipcRenderer.invoke('workflow:start-recording'),
  stopRecording: () => electronAPI.ipcRenderer.invoke('workflow:stop-recording'),
  getRecordingStatus: () => electronAPI.ipcRenderer.invoke('workflow:get-status'),
  saveWorkflow: (data: any) => electronAPI.ipcRenderer.invoke('workflow:save', data),

  // History import
  getAvailableBrowsers: () => electronAPI.ipcRenderer.invoke('history:available-browsers'),
  importHistory: (browserIds: string[]) => electronAPI.ipcRenderer.invoke('history:import', browserIds),

  // Page rewrite
  rewritePage: () => electronAPI.ipcRenderer.invoke('page:rewrite'),
  restorePage: () => electronAPI.ipcRenderer.send('page:restore'),
};

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("sidebarAPI", sidebarAPI);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.sidebarAPI = sidebarAPI;
}
