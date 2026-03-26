import { app, BrowserWindow } from "electron";
import { electronApp } from "@electron-toolkit/utils";
import { Window } from "./Window";
import { AppMenu } from "./Menu";
import { EventManager } from "./EventManager";
import { EventBus } from "./EventBus";
import { RrwebRingBuffer } from "./RrwebRingBuffer";
import { AIEventLog } from "./AIEventLog";
import { InjectionRegistry } from "./InjectionRegistry";
import { ModelRouter } from "./ModelRouter";

let mainWindow: Window | null = null;
let eventManager: EventManager | null = null;
let menu: AppMenu | null = null;
let eventBus: EventBus | null = null;
let ringBuffer: RrwebRingBuffer | null = null;
let aiEventLog: AIEventLog | null = null;
let injectionRegistry: InjectionRegistry | null = null;
let modelRouter: ModelRouter | null = null;

const createWindow = (): Window => {
  eventBus = new EventBus();
  ringBuffer = new RrwebRingBuffer();
  aiEventLog = new AIEventLog();
  injectionRegistry = new InjectionRegistry();
  modelRouter = new ModelRouter({
    localInfer: null,
    cloudInfer: async (_req) => ({ result: "", confidence: 0.9 }),
  });
  const window = new Window({ eventBus, ringBuffer, aiEventLog, injectionRegistry });
  menu = new AppMenu(window);
  eventManager = new EventManager(window);
  return window;
};

app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.electron");

  mainWindow = createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (eventManager) {
    eventManager.cleanup();
    eventManager = null;
  }

  // Clean up references
  if (mainWindow) {
    mainWindow = null;
  }
  if (menu) {
    menu = null;
  }

  if (eventBus) { eventBus.cleanup(); eventBus = null; }
  if (ringBuffer) { ringBuffer = null; }
  if (aiEventLog) { aiEventLog = null; }
  if (injectionRegistry) { injectionRegistry = null; }
  if (modelRouter) { modelRouter = null; }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
