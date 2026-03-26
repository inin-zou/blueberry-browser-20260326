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
] as const

type SendChannel = (typeof SEND_CHANNELS)[number]
type ReceiveChannel = (typeof RECEIVE_CHANNELS)[number]

contextBridge.exposeInMainWorld('blueberry', {
  send(channel: SendChannel, data: unknown): void {
    if ((SEND_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },

  on(channel: ReceiveChannel, callback: (...args: unknown[]) => void): void {
    if ((RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  },

  removeListener(channel: ReceiveChannel, callback: (...args: unknown[]) => void): void {
    if ((RECEIVE_CHANNELS as readonly string[]).includes(channel)) {
      ipcRenderer.removeListener(channel, callback)
    }
  },
})
