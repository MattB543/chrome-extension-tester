/**
 * X Profile Notes - Feed Tests
 * Tests for the content script on the logged-in X.com feed
 */

import { setupTest, teardown, clearStorage, assert, TestContext } from "./setup";
import { createReporter } from "./reporter";

// Human-like delay helper
const humanDelay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

export async function runFeedTests(): Promise<void> {
  console.log("\n\x1b[36m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
  console.log("\x1b[36m%s\x1b[0m", "║           FEED TESTS (Logged In)                      ║");
  console.log("\x1b[36m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

  // Check for credentials
  const username = process.env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD;

  if (!username || !password) {
    console.error("\x1b[31m%s\x1b[0m", "ERROR: TWITTER_USERNAME and TWITTER_PASSWORD must be set in .env");
    throw new Error("Missing Twitter credentials in .env");
  }

  let ctx: TestContext;
  const reporter = createReporter("feed-tests");

  try {
    ctx = await setupTest();
    const page = ctx.stagehand.context.pages()[0];

    reporter.addNote(`Extension ID: ${ctx.extensionId}`);
    reporter.addNote(`Testing with user: ${username}`);

    // ─────────────────────────────────────────────────────────────
    // Step 1: Navigate to X.com main page
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 1: Navigate to X.com");
    ctx.clearLogs();

    await page.goto("https://x.com");
    await humanDelay(3000, 5000);

    await reporter.addStep("X.com Home", "Navigated to X.com main page", ctx);

    // ─────────────────────────────────────────────────────────────
    // Step 2: Click Sign In
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 2: Click Sign In");

    // Click the Sign in link/button
    await page.evaluate(() => {
      const signInLink = Array.from(document.querySelectorAll('a')).find(
        a => a.textContent?.toLowerCase().includes('sign in') ||
             a.href?.includes('/login')
      );
      if (signInLink) signInLink.click();
    });
    await humanDelay(3000, 5000);

    await reporter.addStep("Sign In Clicked", "Clicked Sign In button", ctx);

    // ─────────────────────────────────────────────────────────────
    // Step 3: Enter username
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 3: Enter Username");

    // Wait for and fill username input with human-like typing
    await page.evaluate(async (user: string) => {
      const input = document.querySelector('input[autocomplete="username"]') as HTMLInputElement;
      if (input) {
        input.focus();
        // Type character by character
        for (const char of user) {
          input.value += char;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
        }
      }
    }, username);
    await humanDelay(500, 1000);

    await reporter.addStep("Username Entered", `Entered username: ${username}`, ctx);

    // Click Next button
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(
        el => el.textContent?.toLowerCase().includes('next')
      ) as HTMLElement;
      if (nextBtn) nextBtn.click();
    });
    await humanDelay(2000, 4000);

    await reporter.addStep("After Next", "Clicked Next button", ctx);

    // ─────────────────────────────────────────────────────────────
    // Step 4: Enter password
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 4: Enter Password");

    // Fill password input with human-like typing
    await page.evaluate(async (pw: string) => {
      const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement;
      if (pwInput) {
        pwInput.focus();
        // Type character by character
        for (const char of pw) {
          pwInput.value += char;
          pwInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 30 + Math.random() * 80));
        }
      }
    }, password);
    await humanDelay(500, 1000);

    await reporter.addStep("Password Entered", "Entered password", ctx);

    // Click Log in button
    await page.evaluate(() => {
      const loginBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(
        el => el.textContent?.toLowerCase().includes('log in')
      ) as HTMLElement;
      if (loginBtn) loginBtn.click();
    });
    await humanDelay(5000, 8000);

    await reporter.addStep("After Login Click", "Clicked Log in button", ctx);

    // ─────────────────────────────────────────────────────────────
    // Step 5: Navigate to Home Feed
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 5: Navigate to Home Feed");

    await page.goto("https://x.com/home");
    await humanDelay(5000, 8000);

    await reporter.addStep("Home Feed Initial", "Navigated to home feed", ctx);

    // ─────────────────────────────────────────────────────────────
    // Step 6: Check for Note Buttons on Feed
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 6: Check Note Buttons on Feed");

    const buttonCheck = await page.evaluate(() => {
      const buttons = document.querySelectorAll(".xpn-note-btn");
      return {
        found: buttons.length > 0,
        count: buttons.length,
      };
    });

    console.log("  Note buttons found:", buttonCheck.count);
    reporter.addNote(`Note buttons on feed: ${buttonCheck.count}`);

    await reporter.addStep("Note Buttons Check", `Found ${buttonCheck.count} note buttons on feed`, ctx);

    // ─────────────────────────────────────────────────────────────
    // Step 7: Scroll and capture more of the feed
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 7: Scroll Feed");

    await page.evaluate(() => window.scrollBy(0, 300));
    await humanDelay(2000, 3000);

    await reporter.addStep("Feed Scrolled 1", "Scrolled down to see more tweets", ctx);

    await page.evaluate(() => window.scrollBy(0, 300));
    await humanDelay(2000, 3000);

    await reporter.addStep("Feed Scrolled 2", "Scrolled more", ctx);

    // ─────────────────────────────────────────────────────────────
    // Step 8: Click a note button and open modal
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 8: Open Note Modal");

    const clicked = await page.evaluate(() => {
      const btn = document.querySelector(".xpn-note-btn") as HTMLButtonElement;
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      await humanDelay(500, 1000);
      await reporter.addStep("Modal Opened", "Clicked note button to open modal", ctx);

      // Close modal
      await page.evaluate(() => {
        const cancelBtn = document.querySelector('.xpn-modal-cancel') as HTMLButtonElement;
        const closeBtn = document.querySelector('.xpn-modal-close') as HTMLButtonElement;
        if (cancelBtn) cancelBtn.click();
        else if (closeBtn) closeBtn.click();
      });
      await humanDelay(500, 1000);
    } else {
      reporter.addNote("No note buttons found to click");
    }

    await reporter.addStep("Final Feed State", "Final state of the feed with extension", ctx);

    // ─────────────────────────────────────────────────────────────
    // Step 9: Visual inspection - get button styles
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 9: Visual Inspection");

    const buttonStyles = await page.evaluate(() => {
      const btn = document.querySelector(".xpn-note-btn") as HTMLElement;
      if (!btn) return null;

      const styles = window.getComputedStyle(btn);
      const rect = btn.getBoundingClientRect();
      return {
        display: styles.display,
        position: styles.position,
        width: styles.width,
        height: styles.height,
        marginLeft: styles.marginLeft,
        verticalAlign: styles.verticalAlign,
        color: styles.color,
        boundingBox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }
      };
    });

    if (buttonStyles) {
      console.log("  Button computed styles:");
      Object.entries(buttonStyles).forEach(([k, v]) => {
        if (typeof v === 'object') {
          console.log(`    ${k}:`, JSON.stringify(v));
        } else {
          console.log(`    ${k}: ${v}`);
        }
      });
      reporter.addNote(`Button styles: ${JSON.stringify(buttonStyles)}`);
    }

    // ─────────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[32m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
    console.log("\x1b[32m%s\x1b[0m", "║  🎉 FEED TESTS COMPLETED!                             ║");
    console.log("\x1b[32m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

    reporter.addNote("Feed tests completed - review screenshots for visual bugs");

  } catch (error) {
    console.error("\n\x1b[31m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
    console.error("\x1b[31m%s\x1b[0m", "║  ❌ FEED TEST FAILED                                  ║");
    console.error("\x1b[31m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝");
    console.error("\x1b[31m%s\x1b[0m", "\nError:", error);

    reporter.addError(String(error));

    if (ctx!) {
      ctx.dumpLogs();
      try {
        await reporter.addStep("Error State", "Screenshot at point of failure", ctx);
      } catch {}
    }

    throw error;
  } finally {
    reporter.finalize();
    if (ctx!) await teardown(ctx);
  }
}

// Allow running directly
if (require.main === module) {
  runFeedTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
