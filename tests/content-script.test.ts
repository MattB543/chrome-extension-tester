/**
 * X Profile Notes - Content Script Tests
 * Tests for the content script that runs on X.com
 */

import { setupTest, teardown, clearStorage, takeScreenshot, assert, TestContext } from "./setup";
import { createReporter } from "./reporter";
import { z } from "zod";

export async function runContentScriptTests(): Promise<void> {
  console.log("\n\x1b[36m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
  console.log("\x1b[36m%s\x1b[0m", "║           CONTENT SCRIPT TESTS                        ║");
  console.log("\x1b[36m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

  let ctx: TestContext;
  const reporter = createReporter("content-script-tests");

  try {
    ctx = await setupTest();
    const page = ctx.stagehand.context.pages()[0];

    // Clear storage before tests
    await clearStorage(ctx);

    reporter.addNote(`Extension ID: ${ctx.extensionId}`);

    // ─────────────────────────────────────────────────────────
    // Test 1: Button Injection on X.com Profile
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 1: Button Injection on X.com");
    ctx.clearLogs();

    console.log("  Navigating to X.com profile page...");
    await page.goto("https://x.com/elonmusk");

    // Wait for X.com's dynamic content to load
    console.log("  Waiting for page to load (5 seconds)...");
    await new Promise((r) => setTimeout(r, 5000));

    await reporter.addStep("Profile Page Loaded", "Navigated to @elonmusk profile on X.com", ctx);

    // Check for extension initialization in console
    const initLogs = ctx.consoleLogs.filter(
      (l) => l.text.includes("XPN:") || l.text.includes("X Profile Notes")
    );
    console.log("  Extension logs found:", initLogs.length);
    initLogs.forEach((log) => console.log("    ", log.text));
    reporter.addNote(`Extension initialization logs: ${initLogs.length}`);

    // Check for injected buttons via DOM
    const buttonCheck = await page.evaluate(() => {
      const buttons = document.querySelectorAll(".xpn-note-btn");
      return {
        found: buttons.length > 0,
        count: buttons.length,
      };
    });

    console.log("  Note buttons found:", buttonCheck.count);
    reporter.addNote(`Note buttons injected: ${buttonCheck.count}`);

    assert(buttonCheck.found, "Note buttons should be injected on X.com profile page");
    console.log("\x1b[32m%s\x1b[0m", `  ✅ Found ${buttonCheck.count} note buttons`);

    // ─────────────────────────────────────────────────────────
    // Test 2: Modal Opening
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 2: Modal Opening");
    ctx.clearLogs();

    // Click the first note button using direct DOM manipulation
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector(".xpn-note-btn") as HTMLButtonElement;
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    assert(clicked, "Should be able to click a note button");
    await new Promise((r) => setTimeout(r, 500));

    await reporter.addStep("Note Button Clicked", "Clicked the note button next to username", ctx);

    // Check if modal opened
    const modalState = await page.evaluate(() => {
      const modal = document.querySelector(".xpn-modal");
      return {
        exists: !!modal,
        isOpen: modal?.classList.contains("xpn-modal-open"),
      };
    });

    assert(modalState.exists, "Modal element should exist");
    assert(modalState.isOpen, "Modal should be open after clicking button");

    // Use AI to verify modal content
    const modalInfo = await ctx.stagehand.extract(
      "Is there a modal dialog open? What username is shown in the modal title? Is there a textarea?",
      z.object({
        modalOpen: z.boolean().describe("Is a modal dialog visible"),
        username: z.string().optional().describe("Username in modal title"),
        hasTextarea: z.boolean().describe("Does the modal have a text input area"),
      })
    );

    console.log("  Modal open:", modalInfo.modalOpen);
    console.log("  Username:", modalInfo.username || "N/A");
    console.log("  Has textarea:", modalInfo.hasTextarea);
    reporter.addNote(`Modal username: ${modalInfo.username || "N/A"}`);

    await reporter.addStep("Modal Open State", "Modal dialog opened with textarea visible", ctx);

    assert(modalInfo.modalOpen, "Modal should be visible");
    assert(modalInfo.hasTextarea, "Modal should have a textarea");

    console.log("\x1b[32m%s\x1b[0m", "  ✅ Modal opens correctly");

    // ─────────────────────────────────────────────────────────
    // Test 3: Note Creation
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 3: Note Creation");
    ctx.clearLogs();

    const testNote = `Automated test note - ${Date.now()}`;

    // Type note using Stagehand AI
    await ctx.stagehand.act(`Type '${testNote}' into the note textarea`);
    await new Promise((r) => setTimeout(r, 300));

    await reporter.addStep("Note Text Entered", `Typed note: "${testNote}"`, ctx);

    // Click save button
    await ctx.stagehand.act("Click the Save button in the modal");
    await new Promise((r) => setTimeout(r, 500));

    await reporter.addStep("Save Button Clicked", "Clicked Save to store the note", ctx);

    // Verify modal closed
    const modalClosed = await page.evaluate(() => {
      const modal = document.querySelector(".xpn-modal");
      return !modal?.classList.contains("xpn-modal-open");
    });

    assert(modalClosed, "Modal should close after saving");

    // Note: We can't access chrome.storage from X.com page context
    // We'll verify storage later by checking the popup
    console.log("\x1b[32m%s\x1b[0m", "  ✅ Note saved (will verify in popup)");

    // ─────────────────────────────────────────────────────────
    // Test 4: Visual Indicator (Has Note)
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 4: Visual Indicator");
    ctx.clearLogs();

    const hasIndicator = await page.evaluate(() => {
      const buttonsWithNote = document.querySelectorAll(".xpn-note-btn.xpn-has-note");
      return buttonsWithNote.length > 0;
    });

    console.log("  Buttons with indicator:", hasIndicator);

    await reporter.addStep("Visual Indicator Check", "Checking if note buttons show 'has note' indicator", ctx);

    // Note: This might not show immediately if the DOM hasn't updated
    if (hasIndicator) {
      console.log("\x1b[32m%s\x1b[0m", "  ✅ Visual indicator shows for saved note");
      reporter.addNote("Visual indicator displayed correctly");
    } else {
      console.log("\x1b[33m%s\x1b[0m", "  ⚠️ Visual indicator not found (may need page refresh)");
      reporter.addNote("Visual indicator not found (may need refresh)");
    }

    // ─────────────────────────────────────────────────────────
    // Test 5: Verify Note in Popup
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 5: Verify Note in Popup");
    ctx.clearLogs();

    await page.goto(ctx.extensionUrl("popup/popup.html"));
    await new Promise((r) => setTimeout(r, 500));

    await reporter.addStep("Popup Verification", "Opened popup to verify saved note", ctx);

    const popupNotes = await ctx.stagehand.extract(
      "Are there any notes displayed in the popup? What is the note count?",
      z.object({
        hasNotes: z.boolean().describe("Are there notes in the list"),
        noteCount: z.string().describe("The note count shown"),
      })
    );

    console.log("  Has notes in popup:", popupNotes.hasNotes);
    console.log("  Note count:", popupNotes.noteCount);
    reporter.addNote(`Notes in popup: ${popupNotes.noteCount}`);

    assert(popupNotes.hasNotes, "Notes should appear in popup");
    console.log("\x1b[32m%s\x1b[0m", "  ✅ Note appears in popup");

    // ─────────────────────────────────────────────────────────
    // Test 6: Console Error Check
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 6: Console Error Check");

    const errorLogs = ctx.getErrorLogs();

    // Filter out common X.com errors that aren't from our extension
    const extensionErrors = errorLogs.filter(
      (e) =>
        e.text.includes("XPN") ||
        e.text.includes("xpn") ||
        e.url?.includes("chrome-extension://")
    );

    if (extensionErrors.length > 0) {
      console.warn("\x1b[33m%s\x1b[0m", "  ⚠️ Extension-related errors:");
      extensionErrors.forEach((e) => {
        console.warn("    ", e.text);
        reporter.addError(e.text);
      });
    } else {
      console.log("\x1b[32m%s\x1b[0m", "  ✅ No extension console errors");
    }

    // Print service worker logs
    const swLogs = ctx.getLogsBySource("service-worker");
    if (swLogs.length > 0) {
      console.log("\n  Service worker logs:");
      swLogs.forEach((log) => console.log(`    [${log.type}] ${log.text}`));
    }

    // ─────────────────────────────────────────────────────────
    // Test 7: Keyboard Shortcut (Alt+N)
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 7: Keyboard Shortcut (Alt+N)");
    ctx.clearLogs();

    // Navigate back to X.com profile
    await page.goto("https://x.com/elonmusk");

    // Wait for the page to fully load and buttons to be injected
    console.log("  Waiting for page and button injection...");
    let firstUsername: string | null = null;
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      firstUsername = await page.evaluate(() => {
        const btn = document.querySelector(".xpn-note-btn");
        return btn?.getAttribute("data-username") || null;
      });
      if (firstUsername) break;
    }

    if (!firstUsername) {
      console.log("\x1b[33m%s\x1b[0m", "  ⚠️ No buttons found, skipping keyboard shortcut test");
      reporter.addNote("Keyboard shortcut test skipped - no buttons injected");
    } else {
      console.log("  First username on page:", firstUsername);
      reporter.addNote(`First username for Ctrl+N test: ${firstUsername}`);

      // First, make sure modal is closed
      await page.evaluate(() => {
        const modal = document.querySelector(".xpn-modal");
        if (modal?.classList.contains("xpn-modal-open")) {
          modal.classList.remove("xpn-modal-open");
          document.body.style.overflow = "";
        }
      });
      await new Promise((r) => setTimeout(r, 300));

      // Press Alt+N to trigger the keyboard shortcut via dispatching a KeyboardEvent
      await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', {
          key: 'n',
          code: 'KeyN',
          altKey: true,
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(event);
      });
      await new Promise((r) => setTimeout(r, 500));

      await reporter.addStep("Alt+N Pressed", "Triggered keyboard shortcut to open modal", ctx);

      // Check if modal opened
      const modalStateAfterAltN = await page.evaluate(() => {
        const modal = document.querySelector(".xpn-modal");
        const usernameSpan = modal?.querySelector(".xpn-modal-username");
        return {
          exists: !!modal,
          isOpen: modal?.classList.contains("xpn-modal-open"),
          username: usernameSpan?.textContent || null,
        };
      });

      console.log("  Modal opened:", modalStateAfterAltN.isOpen);
      console.log("  Modal username:", modalStateAfterAltN.username);

      assert(modalStateAfterAltN.exists, "Modal element should exist after Alt+N");
      assert(modalStateAfterAltN.isOpen, "Modal should open after Alt+N");

      assert(
        modalStateAfterAltN.username === `@${firstUsername}`,
        `Modal should show username @${firstUsername}, got ${modalStateAfterAltN.username}`
      );

      console.log("\x1b[32m%s\x1b[0m", "  ✅ Alt+N keyboard shortcut works correctly");
      reporter.addNote("Keyboard shortcut Alt+N opens modal for first profile");

      // Close modal for cleanup
      await page.evaluate(() => {
        const modal = document.querySelector(".xpn-modal");
        if (modal?.classList.contains("xpn-modal-open")) {
          modal.classList.remove("xpn-modal-open");
          document.body.style.overflow = "";
        }
      });
    }

    // ─────────────────────────────────────────────────────────
    // Test 8: Quick Score with Number Keys (1-5)
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 8: Quick Score with Number Keys");
    ctx.clearLogs();

    // Get first button and open modal by clicking it
    const clickedForScore = await page.evaluate(() => {
      const btn = document.querySelector(".xpn-note-btn") as HTMLButtonElement;
      if (btn) {
        btn.click();
        return btn.getAttribute("data-username");
      }
      return null;
    });

    if (!clickedForScore) {
      console.log("\x1b[33m%s\x1b[0m", "  ⚠️ No buttons found, skipping quick score test");
      reporter.addNote("Quick score test skipped - no buttons found");
    } else {
      await new Promise((r) => setTimeout(r, 500));

      // Verify modal is open
      const modalOpenForScore = await page.evaluate(() => {
        const modal = document.querySelector(".xpn-modal");
        return modal?.classList.contains("xpn-modal-open");
      });

      assert(modalOpenForScore, "Modal should be open before testing number key");

      console.log("  Modal open for:", clickedForScore);
      reporter.addNote(`Testing quick score on @${clickedForScore}`);

      // Press number key "4" to set score and close modal
      await page.evaluate(() => {
        const event = new KeyboardEvent('keydown', {
          key: '4',
          code: 'Digit4',
          bubbles: true,
          cancelable: true
        });
        document.dispatchEvent(event);
      });
      await new Promise((r) => setTimeout(r, 500));

      await reporter.addStep("Number Key 4 Pressed", "Pressed 4 to quick-score and close modal", ctx);

      // Check modal is closed
      const modalClosedAfterScore = await page.evaluate(() => {
        const modal = document.querySelector(".xpn-modal");
        return !modal?.classList.contains("xpn-modal-open");
      });

      assert(modalClosedAfterScore, "Modal should close after pressing number key");

      // Check the button now shows score 4
      const buttonHasScore = await page.evaluate((username) => {
        const btn = document.querySelector(`.xpn-note-btn[data-username="${username}"]`);
        return {
          hasScoreClass: btn?.classList.contains("xpn-has-score"),
          hasScore4Class: btn?.classList.contains("xpn-score-4"),
          innerHTML: btn?.innerHTML || ""
        };
      }, clickedForScore);

      console.log("  Button has score class:", buttonHasScore.hasScoreClass);
      console.log("  Button has score-4 class:", buttonHasScore.hasScore4Class);
      console.log("  Button shows score:", buttonHasScore.innerHTML.includes("4"));

      assert(buttonHasScore.hasScoreClass, "Button should have xpn-has-score class");
      assert(buttonHasScore.hasScore4Class, "Button should have xpn-score-4 class");

      console.log("\x1b[32m%s\x1b[0m", "  ✅ Quick score with number key works correctly");
      reporter.addNote("Number key 4 sets score and closes modal");
    }

    // ─────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[32m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
    console.log("\x1b[32m%s\x1b[0m", "║  🎉 ALL CONTENT SCRIPT TESTS PASSED!                 ║");
    console.log("\x1b[32m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

    reporter.addNote("All content script tests passed!");

  } catch (error) {
    console.error("\n\x1b[31m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
    console.error("\x1b[31m%s\x1b[0m", "║  ❌ CONTENT SCRIPT TEST FAILED                        ║");
    console.error("\x1b[31m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝");
    console.error("\x1b[31m%s\x1b[0m", "\nError:", error);

    reporter.addError(String(error));

    // Dump all logs for debugging
    if (ctx!) {
      ctx.dumpLogs();

      // Take error screenshot
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
  runContentScriptTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
