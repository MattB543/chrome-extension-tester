/**
 * X Profile Notes - Test Setup Module
 * Provides test infrastructure with console capture
 */

import { Stagehand } from "@browserbasehq/stagehand";
import path from "path";
import fs from "fs";
import { z } from "zod";
import "dotenv/config";

// Declare chrome as global for page.evaluate contexts
declare const chrome: any;

// ============================================================
// Types
// ============================================================

export interface ConsoleEntry {
  type: string;
  source: "page" | "service-worker" | "runtime" | "network";
  text: string;
  timestamp: number;
  url?: string;
}

export interface TestContext {
  stagehand: Stagehand;
  extensionId: string;
  extensionUrl: (page: string) => string;
  consoleLogs: ConsoleEntry[];
  errors: string[];
  getRecentLogs: (count?: number) => ConsoleEntry[];
  getLogsBySource: (source: ConsoleEntry["source"]) => ConsoleEntry[];
  getErrorLogs: () => ConsoleEntry[];
  clearLogs: () => void;
  dumpLogs: () => void;
}

// ============================================================
// Chrome Path Detection
// ============================================================

function findChromeForTesting(): string {
  // Check environment variable first
  if (process.env.CHROME_FOR_TESTING_PATH) {
    const envPath = path.resolve(process.env.CHROME_FOR_TESTING_PATH);
    if (fs.existsSync(envPath)) {
      return envPath;
    }
  }

  // Check local project directory (where npm run install-chrome puts it)
  const projectRoot = path.resolve(__dirname, "..");
  const localChromeDir = path.join(projectRoot, "chrome");

  if (fs.existsSync(localChromeDir)) {
    const versions = fs.readdirSync(localChromeDir);
    for (const version of versions) {
      // Windows
      const winPath = path.join(localChromeDir, version, "chrome-win64", "chrome.exe");
      if (fs.existsSync(winPath)) return winPath;

      // Linux
      const linuxPath = path.join(localChromeDir, version, "chrome-linux64", "chrome");
      if (fs.existsSync(linuxPath)) return linuxPath;

      // macOS
      const macPath = path.join(
        localChromeDir,
        version,
        "chrome-mac-x64",
        "Google Chrome for Testing.app",
        "Contents",
        "MacOS",
        "Google Chrome for Testing"
      );
      if (fs.existsSync(macPath)) return macPath;
    }
  }

  // Check user home directory
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const puppeteerCache = path.join(home, ".cache", "puppeteer", "chrome");

  if (fs.existsSync(puppeteerCache)) {
    const versions = fs.readdirSync(puppeteerCache);
    for (const version of versions) {
      const winPath = path.join(puppeteerCache, version, "chrome-win64", "chrome.exe");
      if (fs.existsSync(winPath)) return winPath;

      const linuxPath = path.join(puppeteerCache, version, "chrome-linux64", "chrome");
      if (fs.existsSync(linuxPath)) return linuxPath;
    }
  }

  throw new Error(
    "Chrome for Testing not found. Run: npm run install-chrome\n" +
      "Then set CHROME_FOR_TESTING_PATH in your .env file"
  );
}

// ============================================================
// Console Capture Setup
// ============================================================

async function setupPageConsoleCapture(
  stagehand: Stagehand,
  consoleLogs: ConsoleEntry[],
  errors: string[]
): Promise<void> {
  const page = stagehand.context.pages()[0];

  // Capture console messages using Playwright's underlying page
  page.on("console", (msg: any) => {
    const entry: ConsoleEntry = {
      type: msg.type ? msg.type() : "log",
      source: "page",
      text: msg.text ? msg.text() : String(msg),
      timestamp: Date.now(),
    };
    consoleLogs.push(entry);

    // Print to terminal in real-time with color coding
    const msgType = entry.type.toUpperCase().padEnd(5);
    const prefix = `[PAGE:${msgType}]`;
    if (entry.type === "error") {
      console.error("\x1b[31m%s\x1b[0m", prefix, entry.text);
    } else if (entry.type === "warning") {
      console.warn("\x1b[33m%s\x1b[0m", prefix, entry.text);
    } else {
      console.log("\x1b[36m%s\x1b[0m", prefix, entry.text);
    }
  });

  console.log("\x1b[32m%s\x1b[0m", "[SETUP]", "Page console capture enabled");
}

// ============================================================
// Extension ID Detection
// ============================================================

async function detectExtensionId(stagehand: Stagehand): Promise<string> {
  const page = stagehand.context.pages()[0];
  await page.goto("chrome://extensions");
  await new Promise((r) => setTimeout(r, 2000));

  // First, enable Developer Mode if not already enabled
  try {
    await stagehand.act("If there is a 'Developer mode' toggle that is OFF, click it to turn it ON");
    await new Promise((r) => setTimeout(r, 1000));
  } catch (error) {
    console.log("\x1b[33m%s\x1b[0m", "[SETUP]", "Developer mode toggle attempt:", error);
  }

  // Try to get ID by looking for our extension and reading its ID
  // Chrome extensions page uses shadow DOM, so we need to pierce through it
  try {
    const extensionId = await page.evaluate(() => {
      // Find all extension items
      const extensionManager = document.querySelector("extensions-manager");
      if (!extensionManager || !extensionManager.shadowRoot) return null;

      const itemList = extensionManager.shadowRoot.querySelector("extensions-item-list");
      if (!itemList || !itemList.shadowRoot) return null;

      const items = Array.from(itemList.shadowRoot.querySelectorAll("extensions-item"));

      for (const item of items) {
        if (!item.shadowRoot) continue;
        const nameEl = item.shadowRoot.querySelector("#name");
        if (nameEl && nameEl.textContent?.includes("X Profile Notes")) {
          // Found our extension, get the ID
          const idEl = item.shadowRoot.querySelector("#extension-id");
          if (idEl) {
            const idText = idEl.textContent || "";
            // ID format is "ID: abcdefghijklmnopqrstuvwxyzabcd"
            const match = idText.match(/[a-z]{32}/);
            if (match) return match[0];
          }
          // Try getting from the item's id attribute
          const itemId = item.getAttribute("id");
          if (itemId && itemId.length === 32) return itemId;
        }
      }
      return null;
    });

    if (extensionId && extensionId.length === 32) {
      console.log("\x1b[32m%s\x1b[0m", "[SETUP]", "Found extension ID via shadow DOM:", extensionId);
      return extensionId;
    }
  } catch (error) {
    console.warn("\x1b[33m%s\x1b[0m", "[SETUP]", "Shadow DOM extraction failed:", error);
  }

  // Try AI extraction as fallback
  try {
    const result = await stagehand.extract(
      "Look at this Chrome extensions page. Find the extension called 'X Profile Notes' and extract its ID. The ID is a 32-character lowercase string, usually shown after 'ID:' text.",
      z.object({
        extensionId: z.string().describe("32-character extension ID"),
      })
    );

    if (result.extensionId && result.extensionId.length === 32) {
      return result.extensionId;
    }
  } catch (error) {
    console.warn("\x1b[33m%s\x1b[0m", "[SETUP]", "AI extraction attempt:", error);
  }

  // Last fallback: Try to get any ID from the full DOM tree
  try {
    const allIds = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const ids: string[] = [];
      let node;
      while ((node = walker.nextNode())) {
        const matches = node.textContent?.match(/[a-z]{32}/g);
        if (matches) ids.push(...matches);
      }
      return [...new Set(ids)];
    });

    if (allIds && allIds.length > 0) {
      console.log("\x1b[33m%s\x1b[0m", "[SETUP]", "Found potential IDs in DOM:", allIds);
      return allIds[0];
    }
  } catch (error) {
    console.warn("\x1b[33m%s\x1b[0m", "[SETUP]", "DOM scan failed:", error);
  }

  throw new Error("Could not detect extension ID. Is the extension loaded?");
}

// ============================================================
// Main Setup Function
// ============================================================

export async function setupTest(): Promise<TestContext> {
  console.log("\n\x1b[36m%s\x1b[0m", "════════════════════════════════════════════════════════");
  console.log("\x1b[36m%s\x1b[0m", "  Setting up test environment...");
  console.log("\x1b[36m%s\x1b[0m", "════════════════════════════════════════════════════════\n");

  const extensionPath = path.resolve(__dirname, "..");
  const consoleLogs: ConsoleEntry[] = [];
  const errors: string[] = [];

  // Find Chrome for Testing
  const chromePath = findChromeForTesting();
  console.log("\x1b[32m%s\x1b[0m", "[SETUP]", "Chrome path:", chromePath);
  console.log("\x1b[32m%s\x1b[0m", "[SETUP]", "Extension path:", extensionPath);

  // Determine which model to use based on available API key
  let model = "anthropic/claude-sonnet-4-20250514";
  if (process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    model = "openai/gpt-4o";
    console.log("\x1b[32m%s\x1b[0m", "[SETUP]", "Using OpenAI model:", model);
  } else {
    console.log("\x1b[32m%s\x1b[0m", "[SETUP]", "Using Anthropic model:", model);
  }

  // Initialize Stagehand
  const stagehand = new Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: {
      headless: false, // Required for extensions
      executablePath: chromePath,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-popup-blocking",
        "--disable-dev-shm-usage",
        "--disable-features=IsolateOrigins,site-per-process",
        "--allow-running-insecure-content",
      ],
      userDataDir: path.resolve(__dirname, "../.test-profile"),
    },
    model: model as any,
    verbose: 1,
  });

  await stagehand.init();
  console.log("\x1b[32m%s\x1b[0m", "[SETUP]", "Stagehand initialized");

  // Setup page console capture
  await setupPageConsoleCapture(stagehand, consoleLogs, errors);

  // Detect extension ID
  const extensionId = await detectExtensionId(stagehand);
  console.log("\x1b[32m%s\x1b[0m", "[SETUP]", "Extension ID:", extensionId);

  console.log("\n\x1b[32m%s\x1b[0m", "[SETUP]", "Test environment ready!\n");

  return {
    stagehand,
    extensionId,
    extensionUrl: (page) => `chrome-extension://${extensionId}/${page}`,
    consoleLogs,
    errors,
    getRecentLogs: (count = 10) => consoleLogs.slice(-count),
    getLogsBySource: (source) => consoleLogs.filter((l) => l.source === source),
    getErrorLogs: () => consoleLogs.filter((l) => l.type === "error"),
    clearLogs: () => {
      consoleLogs.length = 0;
      errors.length = 0;
    },
    dumpLogs: () => {
      console.log("\n\x1b[36m%s\x1b[0m", "════════════════════════════════════════════════════════");
      console.log("\x1b[36m%s\x1b[0m", "  Console Log Dump");
      console.log("\x1b[36m%s\x1b[0m", "════════════════════════════════════════════════════════");
      if (consoleLogs.length === 0) {
        console.log("  (no logs captured)");
      } else {
        consoleLogs.forEach((log) => {
          const time = new Date(log.timestamp).toISOString().split("T")[1].slice(0, -1);
          console.log(`  [${time}] [${log.source}:${log.type}] ${log.text}`);
        });
      }
      console.log("\x1b[36m%s\x1b[0m", "════════════════════════════════════════════════════════\n");
    },
  };
}

// ============================================================
// Teardown
// ============================================================

export async function teardown(ctx: TestContext): Promise<void> {
  console.log("\n\x1b[36m%s\x1b[0m", "════════════════════════════════════════════════════════");
  console.log("\x1b[36m%s\x1b[0m", "  Teardown Summary");
  console.log("\x1b[36m%s\x1b[0m", "════════════════════════════════════════════════════════");
  console.log("  Total console logs:", ctx.consoleLogs.length);
  console.log("  Errors captured:", ctx.errors.length);

  if (ctx.errors.length > 0) {
    console.log("\n\x1b[31m%s\x1b[0m", "  Errors:");
    ctx.errors.forEach((e) => console.error("\x1b[31m%s\x1b[0m", "    ", e));
  }

  console.log("\x1b[36m%s\x1b[0m", "════════════════════════════════════════════════════════\n");

  await ctx.stagehand.close();
}

// ============================================================
// Test Utilities
// ============================================================

export async function clearStorage(ctx: TestContext): Promise<void> {
  const page = ctx.stagehand.context.pages()[0];
  await page.goto(ctx.extensionUrl("popup/popup.html"));

  // Wait for chrome.storage to be available with polling
  try {
    // Poll until chrome.storage is available (max 5 seconds)
    for (let i = 0; i < 50; i++) {
      const isAvailable = await page.evaluate(() => {
        return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
      });
      if (isAvailable) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    await page.evaluate(() => {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    });
    console.log("\x1b[32m%s\x1b[0m", "[UTIL]", "Storage cleared");
  } catch (error) {
    console.warn("\x1b[33m%s\x1b[0m", "[UTIL]", "Storage clear warning:", error);
  }
}

export async function seedNotes(
  ctx: TestContext,
  notes: Record<string, { note: string }>
): Promise<void> {
  const page = ctx.stagehand.context.pages()[0];
  await page.goto(ctx.extensionUrl("popup/popup.html"));

  const formattedNotes: Record<string, any> = {};
  const now = Date.now();
  for (const [username, data] of Object.entries(notes)) {
    formattedNotes[username] = {
      note: data.note,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Wait for chrome.storage to be available with polling
  try {
    // Poll until chrome.storage is available (max 5 seconds)
    for (let i = 0; i < 50; i++) {
      const isAvailable = await page.evaluate(() => {
        return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
      });
      if (isAvailable) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    await page.evaluate((notesData: any) => {
      return new Promise<void>((resolve, reject) => {
        chrome.storage.local.set({ notes: notesData }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    }, formattedNotes);
    console.log("\x1b[32m%s\x1b[0m", "[UTIL]", `Seeded ${Object.keys(notes).length} notes`);
  } catch (error) {
    console.warn("\x1b[33m%s\x1b[0m", "[UTIL]", "Seed notes warning:", error);
  }
}

export async function takeScreenshot(ctx: TestContext, name: string): Promise<string> {
  const page = ctx.stagehand.context.pages()[0];
  const screenshotPath = path.resolve(__dirname, `../${name}-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log("\x1b[32m%s\x1b[0m", "[UTIL]", "Screenshot saved:", screenshotPath);
  return screenshotPath;
}

// ============================================================
// Assertion Helpers
// ============================================================

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

export function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}\n  Expected: ${expected}\n  Actual: ${actual}`);
  }
}
