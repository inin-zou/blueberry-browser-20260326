import { contextBridge, ipcRenderer } from 'electron'

const SEND_CHANNELS = [
  'rrweb:event',
  'attention:signal',
  'completion:request',
  'selection:action',
] as const

const RECEIVE_CHANNELS = [
  'completion:response',
  'attention:command',
  'page:rewrite',
  'page:restore',
  'page:explain-response',
] as const

type SendChannel = (typeof SEND_CHANNELS)[number]
type ReceiveChannel = (typeof RECEIVE_CHANNELS)[number]

// Track original → wrapped callback mappings for proper removal
const callbackMap = new Map<Function, Function>()

contextBridge.exposeInMainWorld('blueberry', {
  send(channel: SendChannel, data: unknown): void {
    if ((SEND_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },

  on(channel: ReceiveChannel, callback: (...args: unknown[]) => void): void {
    if ((RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
      const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args)
      callbackMap.set(callback, wrapped)
      ipcRenderer.on(channel, wrapped as any)
    }
  },

  removeListener(channel: ReceiveChannel, callback: (...args: unknown[]) => void): void {
    if ((RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
      const wrapped = callbackMap.get(callback)
      if (wrapped) {
        ipcRenderer.removeListener(channel, wrapped as any)
        callbackMap.delete(callback)
      }
    }
  },
})
