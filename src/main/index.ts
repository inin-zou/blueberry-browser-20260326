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
import { LocalModelManager } from "./LocalModelManager";
import { SqliteBackend } from "./SqliteBackend";
import { join } from "path";
import { app as electronApp2 } from "electron";

let mainWindow: Window | null = null;
let eventManager: EventManager | null = null;
let menu: AppMenu | null = null;
let eventBus: EventBus | null = null;
let ringBuffer: RrwebRingBuffer | null = null;
let aiEventLog: AIEventLog | null = null;
let injectionRegistry: InjectionRegistry | null = null;
let modelRouter: ModelRouter | null = null;
let localModel: LocalModelManager | null = null;
let storage: SqliteBackend | null = null;

const createWindow = (): Window => {
  eventBus = new EventBus();
  ringBuffer = new RrwebRingBuffer();
  aiEventLog = new AIEventLog();
  injectionRegistry = new InjectionRegistry();
  modelRouter = new ModelRouter({
    localInfer: null,
    cloudInfer: async (_req) => ({ result: "", confidence: 0.9 }),
  });
  // Initialize SQLite storage
  const dbPath = join(electronApp2.getPath('userData'), 'blueberry.db');
  storage = new SqliteBackend(dbPath);

  const window = new Window({ eventBus, ringBuffer, aiEventLog, injectionRegistry, storage });
  menu = new AppMenu(window);
  eventManager = new EventManager(window);

  // Initialise local model in the background — non-blocking
  localModel = new LocalModelManager();
  localModel.initialize().catch((err) => {
    console.error("Local model init failed (non-fatal):", err);
  });

  // Wire local model into ModelRouter once the model is ready
  const checkReady = setInterval(() => {
    if (localModel?.isReady && modelRouter) {
      modelRouter.setLocalInfer(async (req) => {
        const result = await localModel!.infer(req.input.text || "", 80);
        return { result, confidence: 0.7 };
      });
      console.log("[LocalModel] Wired into ModelRouter");
      clearInterval(checkReady);
    }
  }, 2000);

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
  if (localModel) { localModel.destroy(); localModel = null; }
  if (storage) { storage.close(); storage = null; }

  if (process.platform !== "darwin") {
    app.quit();
  }
});
