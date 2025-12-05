/**
 * Simple Manual Login Helper
 * Uses Playwright directly (no Stagehand) for more reliable browser launch
 */

import { chromium } from "rebrowser-playwright";
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

  throw new Error("Chrome for Testing not found");
}

async function main() {
  console.log("\n========================================");
  console.log("  SIMPLE LOGIN HELPER");
  console.log("========================================\n");

  console.log("Instructions:");
  console.log("  1. A browser window will open");
  console.log("  2. Log in to X.com manually");
  console.log("  3. Once logged in, press Enter in this terminal");
  console.log("  4. Your session will be saved\n");

  const chromePath = findChromeForTesting();
  const extensionPath = path.resolve(__dirname, "..");
  const profilePath = path.resolve(__dirname, "../.test-profile");

  console.log("Chrome:", chromePath);
  console.log("Extension:", extensionPath);
  console.log("Profile:", profilePath);
  console.log("\nLaunching browser...\n");

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    executablePath: chromePath,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--disable-blink-features=AutomationControlled",
      "--start-maximized",
    ],
    viewport: null, // Use full window size
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto("https://x.com/login");

  console.log("Browser opened! Log in to X.com...");
  console.log("Press ENTER here when done to save session.\n");

  // Wait for user to press enter
  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  console.log("\nSaving session and closing...");
  await context.close();

  console.log("\n✅ Done! Run: npm run test:feed-logged-in\n");
}

main().catch(console.error);
