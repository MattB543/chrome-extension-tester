/**
 * X Profile Notes - Test Reporter
 * Handles screenshots and markdown reporting for test runs
 */

import path from "path";
import fs from "fs";
import { TestContext } from "./setup";

export interface TestReporter {
  reportDir: string;
  markdownPath: string;
  stepCount: number;
  addStep: (name: string, description: string, ctx?: TestContext) => Promise<void>;
  addScreenshot: (name: string, ctx: TestContext, options?: ScreenshotOptions) => Promise<string>;
  addNote: (text: string) => void;
  addError: (error: string) => void;
  finalize: () => void;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  clip?: { x: number; y: number; width: number; height: number };
}

/**
 * Create a test reporter for a test suite
 */
export function createReporter(suiteName: string): TestReporter {
  // Create timestamped folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportDir = path.resolve(__dirname, "..", "test-reports", `${timestamp}_${suiteName}`);

  fs.mkdirSync(reportDir, { recursive: true });

  const markdownPath = path.join(reportDir, "report.md");
  let stepCount = 0;
  let markdownContent = `# Test Report: ${suiteName}\n\n`;
  markdownContent += `**Date:** ${new Date().toLocaleString()}\n\n`;
  markdownContent += `---\n\n`;

  const writeMarkdown = () => {
    fs.writeFileSync(markdownPath, markdownContent);
  };

  return {
    reportDir,
    markdownPath,
    stepCount,

    async addStep(name: string, description: string, ctx?: TestContext) {
      stepCount++;
      markdownContent += `## Step ${stepCount}: ${name}\n\n`;
      markdownContent += `${description}\n\n`;

      if (ctx) {
        const screenshotPath = await this.addScreenshot(`step-${stepCount}-${name.toLowerCase().replace(/\s+/g, "-")}`, ctx);
        markdownContent += `![${name}](${path.basename(screenshotPath)})\n\n`;
      }

      writeMarkdown();
    },

    async addScreenshot(name: string, ctx: TestContext, options?: ScreenshotOptions) {
      const page = ctx.stagehand.context.pages()[0];
      const filename = `${String(++stepCount).padStart(2, "0")}_${name}.png`;
      const screenshotPath = path.join(reportDir, filename);

      // Use reasonable fixed dimensions for readable screenshots
      const defaultClip = {
        x: 0,
        y: 0,
        width: 1200,
        height: 800,
      };

      // Take screenshot with reasonable size
      await page.screenshot({
        path: screenshotPath,
        fullPage: options?.fullPage ?? false,
        clip: options?.clip ?? defaultClip,
      });

      return screenshotPath;
    },

    addNote(text: string) {
      markdownContent += `> **Note:** ${text}\n\n`;
      writeMarkdown();
    },

    addError(error: string) {
      markdownContent += `> **ERROR:** ${error}\n\n`;
      writeMarkdown();
    },

    finalize() {
      markdownContent += `---\n\n`;
      markdownContent += `**Test completed at:** ${new Date().toLocaleString()}\n`;
      writeMarkdown();
      console.log("\x1b[32m%s\x1b[0m", `[REPORTER] Report saved to: ${reportDir}`);
    },
  };
}
