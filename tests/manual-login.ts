/**
 * Manual Login Helper
 *
 * Opens a browser window where you can log in to X.com manually.
 * The session is saved to .test-profile/ and persists for future tests.
 *
 * Usage: npm run login
 */

import { Stagehand } from "@browserbasehq/stagehand";
import path from "path";
import fs from "fs";
import "dotenv/config";

function findChromeForTesting(): string {
  if (process.env.CHROME_FOR_TESTING_PATH) {
    const envPath = path.resolve(process.env.CHROME_FOR_TESTING_PATH);
    if (fs.existsSync(envPath)) return envPath;
  }

  const projectRoot = path.resolve(__dirname, "..");
  const localChromeDir = path.join(projectRoot, "chrome");

  if (fs.existsSync(localChromeDir)) {
    const versions = fs.readdirSync(localChromeDir);
    for (const version of versions) {
      const winPath = path.join(localChromeDir, version, "chrome-win64", "chrome.exe");
      if (fs.existsSync(winPath)) return winPath;
    }
  }

  throw new Error("Chrome for Testing not found. Run: npm run install-chrome");
}

async function main() {
  console.log("\n\x1b[36m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
  console.log("\x1b[36m%s\x1b[0m", "║           MANUAL LOGIN HELPER                         ║");
  console.log("\x1b[36m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

  console.log("\x1b[33m%s\x1b[0m", "Instructions:");
  console.log("  1. A browser window will open");
  console.log("  2. Log in to X.com manually");
  console.log("  3. Once logged in, close the browser window");
  console.log("  4. Your session will be saved for future tests\n");

  const chromePath = findChromeForTesting();
  const extensionPath = path.resolve(__dirname, "..");

  console.log("\x1b[32m%s\x1b[0m", "[INFO] Chrome path:", chromePath);
  console.log("\x1b[32m%s\x1b[0m", "[INFO] Profile saved to: .test-profile/\n");

  const stagehand = new Stagehand({
    env: "LOCAL",
    localBrowserLaunchOptions: {
      headless: false,
      executablePath: chromePath,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-popup-blocking",
        "--start-maximized",
        "--new-window",
      ],
      userDataDir: path.resolve(__dirname, "../.test-profile"),
    },
    model: "openai/gpt-4o" as any,
    verbose: 1, // Increase verbosity to see what's happening
  });

  await stagehand.init();

  const page = stagehand.context.pages()[0];
  await page.goto("https://x.com/login");

  console.log("\x1b[36m%s\x1b[0m", "Browser opened! Please log in to X.com...");
  console.log("\x1b[36m%s\x1b[0m", "Close the browser window when done.\n");

  // Wait for browser to close
  await new Promise<void>((resolve) => {
    const checkClosed = setInterval(async () => {
      try {
        const pages = stagehand.context.pages();
        if (pages.length === 0) {
          clearInterval(checkClosed);
          resolve();
        }
      } catch {
        clearInterval(checkClosed);
        resolve();
      }
    }, 1000);
  });

  console.log("\x1b[32m%s\x1b[0m", "\n✅ Session saved! You can now run: npm run test:feed-logged-in\n");

  try {
    await stagehand.close();
  } catch {}
}

main().catch(console.error);
