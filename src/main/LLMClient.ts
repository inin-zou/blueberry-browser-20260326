import { WebContents } from "electron";
import { streamText, stepCountIs, type LanguageModel, type CoreMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({ compatibility: 'strict' });
import { anthropic } from "@ai-sdk/anthropic";
import * as dotenv from "dotenv";
import { join } from "path";
import type { Window } from "./Window";
import { createBrowserTools } from "./BrowserTools";
import type { SandboxManager } from "./SandboxManager";

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, "../../.env") });

interface ChatRequest {
  message: string;
  messageId: string;
}

interface StreamChunk {
  content: string;
  isComplete: boolean;
}

type LLMProvider = "openai" | "anthropic";

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-6",
};

const MAX_CONTEXT_LENGTH = 4000;
const DEFAULT_TEMPERATURE = 0.7;

export class LLMClient {
  private readonly webContents: WebContents;
  private window: Window | null = null;
  private sandboxManager: SandboxManager | null = null;
  private readonly provider: LLMProvider;
  private readonly modelName: string;
  private readonly model: LanguageModel | null;
  private messages: CoreMessage[] = [];
  private userInterests: string[] = [];

  constructor(webContents: WebContents) {
    this.webContents = webContents;
    this.provider = this.getProvider();
    this.modelName = this.getModelName();
    this.model = this.initializeModel();

    this.logInitializationStatus();
  }

  // Set the window reference after construction to avoid circular dependencies
  setWindow(window: Window): void {
    this.window = window;
  }

  // Set the shared SandboxManager instance to avoid per-call instantiation
  setSandboxManager(manager: SandboxManager): void {
    this.sandboxManager = manager;
  }

  // Set inferred user interests from imported browser history
  setUserProfile(interests: string[]): void {
    this.userInterests = interests;
  }

  private getProvider(): LLMProvider {
    const provider = process.env.LLM_PROVIDER?.toLowerCase();
    if (provider === "anthropic") return "anthropic";
    return "openai"; // Default to OpenAI
  }

  private getModelName(): string {
    return process.env.LLM_MODEL || DEFAULT_MODELS[this.provider];
  }

  private initializeModel(): LanguageModel | null {
    const apiKey = this.getApiKey();
    if (!apiKey) return null;

    switch (this.provider) {
      case "anthropic":
        return anthropic(this.modelName);
      case "openai":
        return openai.chat(this.modelName);
      default:
        return null;
    }
  }

  private getApiKey(): string | undefined {
    switch (this.provider) {
      case "anthropic":
        return process.env.ANTHROPIC_API_KEY;
      case "openai":
        return process.env.OPENAI_API_KEY;
      default:
        return undefined;
    }
  }

  private logInitializationStatus(): void {
    if (this.model) {
      console.log(
        `✅ LLM Client initialized with ${this.provider} provider using model: ${this.modelName}`
      );
    } else {
      const keyName =
        this.provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
      console.error(
        `❌ LLM Client initialization failed: ${keyName} not found in environment variables.\n` +
          `Please add your API key to the .env file in the project root.`
      );
    }
  }

  async sendChatMessage(request: ChatRequest): Promise<void> {
    console.log(`[Chat] sendChatMessage called: "${request.message?.substring(0, 50)}"`);
    try {
      // Get screenshot from active tab if available
      let screenshot: string | null = null;
      if (this.window) {
        const activeTab = this.window.activeTab;
        if (activeTab) {
          try {
            const image = await activeTab.screenshot();
            screenshot = image.toDataURL();
          } catch (error) {
            console.error("Failed to capture screenshot:", error);
          }
        }
      }

      // Build user message content with screenshot first, then text
      const userContent: any[] = [];
      
      // Add screenshot as the first part if available
      if (screenshot) {
        userContent.push({
          type: "image",
          image: screenshot,
        });
      }
      
      // Add text content
      userContent.push({
        type: "text",
        text: request.message,
      });

      // Create user message in CoreMessage format
      const userMessage: CoreMessage = {
        role: "user",
        content: userContent.length === 1 ? request.message : userContent,
      };
      
      this.messages.push(userMessage);

      // Send updated messages to renderer
      this.sendMessagesToRenderer();

      if (!this.model) {
        this.sendErrorMessage(
          request.messageId,
          "LLM service is not configured. Please add your API key to the .env file."
        );
        return;
      }

      const messages = await this.prepareMessagesWithContext(request);
      console.log(`[Chat] Sending ${messages.length} messages to ${this.provider}/${this.modelName}, tools: ${this.window ? 'yes' : 'no'}`);
      await this.streamResponse(messages, request.messageId);
      console.log(`[Chat] Stream complete`);
    } catch (error) {
      console.error("[Chat] Error in LLM request:", error);
      this.handleStreamError(error, request.messageId);
    }
  }

  clearMessages(): void {
    this.messages = [];
    this.sendMessagesToRenderer();
  }

  getMessages(): CoreMessage[] {
    return this.messages;
  }

  private sendMessagesToRenderer(): void {
    this.webContents.send("chat-messages-updated", this.messages);
  }

  private async prepareMessagesWithContext(_request: ChatRequest): Promise<CoreMessage[]> {
    // Get page context from active tab
    let pageUrl: string | null = null;
    let pageText: string | null = null;
    
    if (this.window) {
      const activeTab = this.window.activeTab;
      if (activeTab) {
        pageUrl = activeTab.url;
        try {
          pageText = await activeTab.getTabText();
        } catch (error) {
          console.error("Failed to get page text:", error);
        }
      }
    }

    // Build system message
    const systemMessage: CoreMessage = {
      role: "system",
      content: this.buildSystemPrompt(pageUrl, pageText),
    };

    // Include all messages in history (system + conversation)
    return [systemMessage, ...this.messages];
  }

  private buildSystemPrompt(url: string | null, pageText: string | null): string {
    const parts: string[] = [
      "You are Blueberry, a professional AI co-pilot embedded in a web browser.",
      "You analyze web pages and assist the user with research, comprehension, and decision-making.",
      "Be concise, precise, and professional. Avoid emojis and unnecessary filler.",
      "Use markdown formatting for structured responses. Prefer bullet points over paragraphs when listing information.",
      "The user's messages may include screenshots of the current page as the first image.",
      "",
      "You have browser action tools available:",
      "- click: Click elements by CSS selector",
      "- type_text: Type into input fields (supports placeholder text as fallback selector)",
      "- navigate: Go to a URL",
      "- scroll: Scroll up or down",
      "- find_and_fill_input: Find any visible input on the page (including Shadow DOM) and type into it — use when get_page_elements returns empty",
      "- read_page: Read the page text content",
      "- run_javascript: Execute custom JS on the page",
      "- run_in_sandbox: Run JS in an isolated sandbox to extract/analyze page data safely",
      "- get_page_elements: List buttons, links, and inputs on the page",
      "",
      "CRITICAL: You are an AUTONOMOUS browser agent.",
      "When a task requires multiple steps, call ALL tools in a SINGLE response — do NOT generate any text between tool calls.",
      "Only write a text response AFTER all tool calls are complete.",
      "",
      "Example for 'go to example.com and search for shoes':",
      "Call these tools in ONE response (no text between them):",
      "1. navigate(url: 'https://example.com')",
      "2. get_page_elements(element_type: 'inputs')",
      "3. type_text(selector: 'input[name=search]', text: 'shoes')",
      "4. read_page()",
      "Then write your summary text.",
      "",
      "Rules:",
      "- Call multiple tools in sequence within one response when possible",
      "- After navigate, call get_page_elements to understand the page",
      "- If get_page_elements returns empty inputs, use find_and_fill_input — it searches Shadow DOM, dynamic elements, and clicks search-like areas to reveal hidden inputs",
      "- If type_text still fails, try run_javascript to interact with the page directly",
      "- NEVER give up after one failed attempt. Always try alternative approaches.",
      "- For data extraction, use run_in_sandbox",
      "- Do NOT write text until the task is fully complete",
    ];

    if (url) {
      parts.push(`\nCurrent page URL: ${url}`);
    }

    if (pageText) {
      const truncatedText = this.truncateText(pageText, MAX_CONTEXT_LENGTH);
      parts.push(`\nPage content (text):\n${truncatedText}`);
    }

    if (this.userInterests.length > 0) {
      parts.push(`\nUser interests: ${this.userInterests.join(', ')}`);
      parts.push("Tailor your responses to the user's areas of interest when relevant.");
    }

    parts.push(
      "\nProvide accurate, contextual responses grounded in the current page content.",
      "When referencing specific content, cite the relevant section. Be direct and actionable."
    );

    return parts.join("\n");
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  }

  private async streamResponse(
    messages: CoreMessage[],
    messageId: string
  ): Promise<void> {
    if (!this.model) {
      throw new Error("Model not initialized");
    }

    try {
      // Browser action tools (using jsonSchema for OpenAI compatibility)
      const tools = this.window ? createBrowserTools(() => this.window, this.sandboxManager ?? undefined) : undefined;

      // Track tool actions to show in chat
      const toolActions: string[] = [];

      const result = await streamText({
        model: this.model,
        messages,
        ...(tools ? { tools, stopWhen: stepCountIs(10) } : {}),
        temperature: DEFAULT_TEMPERATURE,
        maxRetries: 3,
        abortSignal: undefined,
        onStepFinish: ({ toolCalls, toolResults }) => {
          try {
          if (toolCalls && toolCalls.length > 0) {
            for (const tc of toolCalls) {
              const args = (tc as any).input || (tc as any).args || {};
              const argsJson = JSON.stringify(args) || '{}';
              console.log(`[Browser Tool] ${tc.toolName}(${argsJson.substring(0, 300)})`);
              const argsStr = Object.entries(args)
                .map(([k, v]) => `${k}: ${typeof v === 'string' ? v.substring(0, 60) : v}`)
                .join(', ');
              toolActions.push(`**${tc.toolName}**(${argsStr})`);
            }
          }
          if (toolResults && toolResults.length > 0) {
            for (const tr of toolResults) {
              // inputSchema tools may use tr.output instead of tr.result
              const rawResult = (tr as any).result ?? (tr as any).output ?? null;
              const resultJson = JSON.stringify(rawResult) || 'null';
              console.log(`[Browser Tool Result] ${tr.toolName}: ${resultJson.substring(0, 500)} (keys: ${Object.keys(tr).join(',')})`);
              const res = rawResult;
              if (res?.success === false && res?.error) {
                toolActions.push(`Error: ${res.error}`);
              } else if (res?.success) {
                // Format result based on tool type
                if (res.clicked) {
                  toolActions.push(`Clicked: ${res.clicked}`);
                } else if (res.navigatedTo) {
                  toolActions.push(`Navigated to: ${res.navigatedTo}`);
                } else if (res.typed) {
                  toolActions.push(`Typed: "${res.typed}"`);
                } else if (res.scrolled) {
                  toolActions.push(`Scrolled ${res.scrolled} ${res.pixels}px`);
                } else if (res.output !== undefined) {
                  // Sandbox or run_javascript result — show the actual data
                  const outputStr = typeof res.output === 'string'
                    ? res.output
                    : JSON.stringify(res.output, null, 2);
                  const truncated = outputStr.length > 1500
                    ? outputStr.substring(0, 1500) + '\n... (truncated)'
                    : outputStr;
                  if (res.description) {
                    toolActions.push(`**${res.description}:**\n\`\`\`json\n${truncated}\n\`\`\``);
                  } else {
                    toolActions.push(`Result:\n\`\`\`json\n${truncated}\n\`\`\``);
                  }
                } else if (res.content) {
                  // read_page result
                  toolActions.push(`Page content (${res.title}):\n${res.content.substring(0, 500)}...`);
                } else if (res.elements) {
                  // get_page_elements result
                  const summary = res.elements.slice(0, 10).map((e: any) =>
                    `- [${e.type}] ${e.text || e.name || e.placeholder || ''} (${e.selector})`
                  ).join('\n');
                  toolActions.push(`Found ${res.count} elements:\n${summary}`);
                } else {
                  toolActions.push(`Done`);
                }
              }
            }
          }
          } catch (err: any) {
            console.error('[Browser Tool] onStepFinish error (non-fatal):', err.message);
          }
        },
      });

      await this.processStream(result.textStream, messageId, toolActions);
    } catch (error) {
      throw error;
    }
  }

  private async processStream(
    textStream: AsyncIterable<string>,
    messageId: string,
    toolActions?: string[]
  ): Promise<void> {
    let accumulatedText = "";

    // Create a placeholder assistant message
    const assistantMessage: CoreMessage = {
      role: "assistant",
      content: "",
    };
    
    // Keep track of the index for updates
    const messageIndex = this.messages.length;
    this.messages.push(assistantMessage);

    for await (const chunk of textStream) {
      accumulatedText += chunk;

      // Update assistant message content
      this.messages[messageIndex] = {
        role: "assistant",
        content: accumulatedText,
      };
      this.sendMessagesToRenderer();

      this.sendStreamChunk(messageId, {
        content: chunk,
        isComplete: false,
      });
    }

    // If AI used tools but produced no text, show tool actions as the response
    if (!accumulatedText.trim() && toolActions && toolActions.length > 0) {
      accumulatedText = toolActions.join('\n');
      this.sendStreamChunk(messageId, {
        content: accumulatedText,
        isComplete: false,
      });
    }

    // Final update with complete content
    this.messages[messageIndex] = {
      role: "assistant",
      content: accumulatedText,
    };
    this.sendMessagesToRenderer();

    // Send the final complete signal
    this.sendStreamChunk(messageId, {
      content: accumulatedText,
      isComplete: true,
    });
  }

  private handleStreamError(error: unknown, messageId: string): void {
    console.error("Error streaming from LLM:", error);

    const errorMessage = this.getErrorMessage(error);
    this.sendErrorMessage(messageId, errorMessage);
  }

  private getErrorMessage(error: unknown): string {
    if (!(error instanceof Error)) {
      return "An unexpected error occurred. Please try again.";
    }

    const message = error.message.toLowerCase();

    if (message.includes("401") || message.includes("unauthorized")) {
      return "Authentication error: Please check your API key in the .env file.";
    }

    if (message.includes("429") || message.includes("rate limit")) {
      return "Rate limit exceeded. Please try again in a few moments.";
    }

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("econnrefused")
    ) {
      return "Network error: Please check your internet connection.";
    }

    if (message.includes("timeout")) {
      return "Request timeout: The service took too long to respond. Please try again.";
    }

    return "Sorry, I encountered an error while processing your request. Please try again.";
  }

  private sendErrorMessage(messageId: string, errorMessage: string): void {
    this.sendStreamChunk(messageId, {
      content: errorMessage,
      isComplete: true,
    });
  }

  private sendStreamChunk(messageId: string, chunk: StreamChunk): void {
    this.webContents.send("chat-response", {
      messageId,
      content: chunk.content,
      isComplete: chunk.isComplete,
    });
  }
}
