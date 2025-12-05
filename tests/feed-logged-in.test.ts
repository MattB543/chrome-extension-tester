/**
 * X Profile Notes - Feed Tests (Pre-logged in)
 *
 * PREREQUISITE: You must manually log in first!
 * Run: npm run login
 * This opens a browser where you log in manually, then close it.
 * The session is saved in .test-profile/ and persists for future tests.
 */

import { setupTest, teardown, assert, TestContext } from "./setup";
import { createReporter } from "./reporter";

// Human-like delay helper
const humanDelay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

export async function runFeedLoggedInTests(): Promise<void> {
  console.log("\n\x1b[36m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
  console.log("\x1b[36m%s\x1b[0m", "║           FEED TESTS (Pre-Logged In)                  ║");
  console.log("\x1b[36m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

  console.log("\x1b[33m%s\x1b[0m", "NOTE: This test assumes you're already logged in.");
  console.log("\x1b[33m%s\x1b[0m", "If not, run 'npm run login' first to log in manually.\n");

  let ctx: TestContext;
  const reporter = createReporter("feed-logged-in-tests");

  try {
    ctx = await setupTest();
    const page = ctx.stagehand.context.pages()[0];

    reporter.addNote(`Extension ID: ${ctx.extensionId}`);

    // ─────────────────────────────────────────────────────────────
    // Step 1: Navigate directly to Home Feed
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 1: Navigate to Home Feed");
    ctx.clearLogs();

    await page.goto("https://x.com/home");
    await humanDelay(5000, 8000);

    await reporter.addStep("Home Feed", "Navigated to home feed", ctx);

    // Check if we're actually logged in
    const isLoggedIn = await page.evaluate(() => {
      // Check for common logged-in indicators
      const hasComposeButton = !!document.querySelector('[data-testid="SideNav_NewTweet_Button"]');
      const hasHomeTimeline = !!document.querySelector('[data-testid="primaryColumn"]');
      const noLoginPrompt = !document.querySelector('a[href="/login"]');
      return hasComposeButton || (hasHomeTimeline && noLoginPrompt);
    });

    if (!isLoggedIn) {
      console.log("\x1b[31m%s\x1b[0m", "  ❌ Not logged in! Run 'npm run login' first.");
      reporter.addError("Not logged in - run 'npm run login' first");
      throw new Error("Not logged in. Run 'npm run login' to log in manually first.");
    }

    console.log("\x1b[32m%s\x1b[0m", "  ✅ Logged in successfully");
    reporter.addNote("Successfully logged in");

    // ─────────────────────────────────────────────────────────────
    // Step 2: Check for Note Buttons on Feed
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 2: Check Note Buttons on Feed");

    const buttonCheck = await page.evaluate(() => {
      const buttons = document.querySelectorAll(".xpn-note-btn");
      return {
        found: buttons.length > 0,
        count: buttons.length,
      };
    });

    console.log("  Note buttons found:", buttonCheck.count);
    reporter.addNote(`Note buttons on feed: ${buttonCheck.count}`);

    await reporter.addStep("Note Buttons Initial", `Found ${buttonCheck.count} note buttons`, ctx);

    // ─────────────────────────────────────────────────────────────
    // Step 3: Scroll and capture the feed layout
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 3: Scroll Feed");

    // Scroll in increments to capture different parts
    for (let i = 1; i <= 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 400));
      await humanDelay(2000, 3000);

      const currentButtons = await page.evaluate(() => {
        return document.querySelectorAll(".xpn-note-btn").length;
      });

      await reporter.addStep(`Feed Scroll ${i}`, `Scrolled - ${currentButtons} buttons visible`, ctx);
      console.log(`  Scroll ${i}: ${currentButtons} buttons visible`);
    }

    // ─────────────────────────────────────────────────────────────
    // Step 4: Examine button positioning
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 4: Examine Button Styles");

    const buttonInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll(".xpn-note-btn")).slice(0, 5);
      return buttons.map((btn, i) => {
        const el = btn as HTMLElement;
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        const parent = el.parentElement;
        const parentStyles = parent ? window.getComputedStyle(parent) : null;

        return {
          index: i,
          position: { x: Math.round(rect.x), y: Math.round(rect.y) },
          size: { w: Math.round(rect.width), h: Math.round(rect.height) },
          display: styles.display,
          verticalAlign: styles.verticalAlign,
          marginLeft: styles.marginLeft,
          parentDisplay: parentStyles?.display || "N/A",
          parentFlexDirection: parentStyles?.flexDirection || "N/A",
        };
      });
    });

    if (buttonInfo.length > 0) {
      console.log("  Button styles:");
      buttonInfo.forEach(info => {
        console.log(`    Button ${info.index}: pos(${info.position.x}, ${info.position.y}) size(${info.size.w}x${info.size.h})`);
        console.log(`      display: ${info.display}, verticalAlign: ${info.verticalAlign}, marginLeft: ${info.marginLeft}`);
        console.log(`      parent: display=${info.parentDisplay}, flex-direction=${info.parentFlexDirection}`);
      });
      reporter.addNote(`Button info: ${JSON.stringify(buttonInfo, null, 2)}`);
    }

    // ─────────────────────────────────────────────────────────────
    // Step 5: Click a note button to check modal
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 5: Test Note Modal");

    // Scroll back up
    await page.evaluate(() => window.scrollTo(0, 0));
    await humanDelay(1000, 2000);

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
      await reporter.addStep("Modal Open", "Clicked note button - modal should be open", ctx);

      // Close modal
      await page.evaluate(() => {
        const cancelBtn = document.querySelector('.xpn-modal-cancel') as HTMLButtonElement;
        const closeBtn = document.querySelector('.xpn-modal-close') as HTMLButtonElement;
        if (cancelBtn) cancelBtn.click();
        else if (closeBtn) closeBtn.click();
      });
      await humanDelay(500, 1000);
    }

    // ─────────────────────────────────────────────────────────────
    // Step 6: Final screenshot
    // ─────────────────────────────────────────────────────────────
    await reporter.addStep("Final State", "Final state of feed with extension", ctx);

    // ─────────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[32m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
    console.log("\x1b[32m%s\x1b[0m", "║  🎉 FEED TESTS COMPLETED!                             ║");
    console.log("\x1b[32m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

    console.log("\x1b[36m%s\x1b[0m", `Review screenshots in: ${reporter.reportDir}`);

    reporter.addNote("Feed tests completed - review screenshots for visual bugs");

  } catch (error) {
    console.error("\n\x1b[31m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
    console.error("\x1b[31m%s\x1b[0m", "║  ❌ FEED TEST FAILED                                  ║");
    console.error("\x1b[31m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝");
    console.error("\x1b[31m%s\x1b[0m", "\nError:", error);

    reporter.addError(String(error));

    if (ctx!) {
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
  runFeedLoggedInTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
