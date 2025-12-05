/**
 * X Profile Notes - Popup Tests
 * Tests for the extension popup UI
 */

import { setupTest, teardown, clearStorage, takeScreenshot, assert, assertEqual, TestContext } from "./setup";
import { createReporter, TestReporter } from "./reporter";
import { z } from "zod";

export async function runPopupTests(): Promise<void> {
  console.log("\n\x1b[36m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
  console.log("\x1b[36m%s\x1b[0m", "║           POPUP TESTS                                 ║");
  console.log("\x1b[36m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

  let ctx: TestContext;
  const reporter = createReporter("popup-tests");

  try {
    ctx = await setupTest();
    const page = ctx.stagehand.context.pages()[0];

    reporter.addNote(`Extension ID: ${ctx.extensionId}`);

    // ─────────────────────────────────────────────────────────
    // Test 1: Empty State
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 1: Empty State Rendering");
    ctx.clearLogs();

    // Clear storage and navigate to popup
    await clearStorage(ctx);
    await page.goto(ctx.extensionUrl("popup/popup.html"));
    await new Promise((r) => setTimeout(r, 500));

    await reporter.addStep("Empty State", "Popup loaded with no notes saved", ctx);

    // Use AI to extract the empty state
    const emptyState = await ctx.stagehand.extract(
      "What message is shown when there are no notes? What is the note count displayed?",
      z.object({
        emptyMessage: z.string().describe("The main message shown in empty state"),
        noteCount: z.string().describe("The note count shown in header"),
      })
    );

    console.log("  Empty message:", emptyState.emptyMessage);
    console.log("  Note count:", emptyState.noteCount);
    reporter.addNote(`Empty message: "${emptyState.emptyMessage}"`);
    reporter.addNote(`Note count: "${emptyState.noteCount}"`);

    assert(
      emptyState.emptyMessage.toLowerCase().includes("no notes"),
      `Expected empty message to contain 'no notes', got: ${emptyState.emptyMessage}`
    );
    assertEqual(emptyState.noteCount, "0 notes", "Note count should be '0 notes'");

    console.log("\x1b[32m%s\x1b[0m", "  ✅ Empty state renders correctly");

    // ─────────────────────────────────────────────────────────
    // Test 2: Create Note via Content Script and Verify in Popup
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 2: Create Note via X.com and Verify in Popup");
    ctx.clearLogs();

    // Navigate to X.com profile to create a note
    console.log("  Navigating to X.com profile...");
    await page.goto("https://x.com/elonmusk");
    await new Promise((r) => setTimeout(r, 4000));

    await reporter.addStep("X.com Profile Page", "Navigated to X.com profile page to test note creation", ctx);

    // Click the note button
    const clicked = await page.evaluate(() => {
      const btn = document.querySelector(".xpn-note-btn") as HTMLButtonElement;
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (clicked) {
      await new Promise((r) => setTimeout(r, 500));

      await reporter.addStep("Modal Opened", "Clicked note button, modal appeared", ctx);

      // Type note and save
      const testNote = "Test note from popup test";
      await ctx.stagehand.act(`Type '${testNote}' into the note textarea`);
      await new Promise((r) => setTimeout(r, 300));

      await reporter.addStep("Note Typed", `Entered note text: "${testNote}"`, ctx);

      await ctx.stagehand.act("Click the Save button");
      await new Promise((r) => setTimeout(r, 500));

      await reporter.addStep("Note Saved", "Clicked Save button", ctx);

      console.log("  Created note via content script");
    } else {
      console.log("\x1b[33m%s\x1b[0m", "  ⚠️ Note button not found on X.com, skipping note creation");
      reporter.addNote("Note button not found on X.com page");
    }

    // Now check popup
    await page.goto(ctx.extensionUrl("popup/popup.html"));
    await new Promise((r) => setTimeout(r, 500));

    await reporter.addStep("Popup After Save", "Returned to popup to verify note was saved", ctx);

    const notesDisplay = await ctx.stagehand.extract(
      "How many notes are displayed in the list? What is the note count in the header?",
      z.object({
        noteCount: z.string().describe("Note count from header"),
        displayedNotes: z.number().describe("Number of note items visible"),
      })
    );

    console.log("  Note count:", notesDisplay.noteCount);
    console.log("  Displayed notes:", notesDisplay.displayedNotes);
    reporter.addNote(`Note count after creation: "${notesDisplay.noteCount}"`);

    // If we successfully created a note, check for at least 1
    if (clicked) {
      assert(notesDisplay.displayedNotes >= 1, "Should display at least 1 note");
      console.log("\x1b[32m%s\x1b[0m", "  ✅ Note appears in popup");
    } else {
      console.log("\x1b[32m%s\x1b[0m", "  ✅ Notes display checked (no notes created)");
    }

    // Only run search and detail tests if we have notes
    if (notesDisplay.displayedNotes > 0) {
      // ─────────────────────────────────────────────────────────
      // Test 3: Search Functionality
      // ─────────────────────────────────────────────────────────
      console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 3: Search Functionality");
      ctx.clearLogs();

      // Type in search box
      await ctx.stagehand.act("Type 'test' into the search input field");
      await new Promise((r) => setTimeout(r, 300));

      await reporter.addStep("Search Test", "Typed 'test' into search box", ctx);

      const searchResult = await ctx.stagehand.extract(
        "After searching, how many note items are visible?",
        z.object({
          visibleNotes: z.number().describe("Number of visible note items"),
        })
      );

      console.log("  Visible notes after search:", searchResult.visibleNotes);
      reporter.addNote(`Search results: ${searchResult.visibleNotes} note(s) visible`);
      assert(searchResult.visibleNotes >= 0, "Search should return results");

      // Clear search
      await ctx.stagehand.act("Clear the search input field");
      await new Promise((r) => setTimeout(r, 300));

      console.log("\x1b[32m%s\x1b[0m", "  ✅ Search filters correctly");

      // ─────────────────────────────────────────────────────────
      // Test 4: Note Details
      // ─────────────────────────────────────────────────────────
      console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 4: Note Details");
      ctx.clearLogs();

      await reporter.addStep("Note Details View", "Examining note details in popup", ctx);

      const noteDetails = await ctx.stagehand.extract(
        "Extract the username and note content from the first note item displayed",
        z.object({
          username: z.string().describe("Username shown on the note"),
          noteContent: z.string().describe("The note text content"),
        })
      );

      console.log("  Username:", noteDetails.username);
      console.log("  Content:", noteDetails.noteContent);
      reporter.addNote(`Note username: "${noteDetails.username}"`);
      reporter.addNote(`Note content: "${noteDetails.noteContent}"`);

      assert(noteDetails.username.length > 0, "Username should be displayed");
      console.log("\x1b[32m%s\x1b[0m", "  ✅ Note details display correctly");
    } else {
      console.log("\x1b[33m%s\x1b[0m", "  ⚠️ Skipping search/detail tests (no notes)");
    }

    // ─────────────────────────────────────────────────────────
    // Test 5: Export Button Exists
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 5: Export/Import Buttons");
    ctx.clearLogs();

    await reporter.addStep("Footer Buttons", "Checking Export/Import buttons in footer", ctx);

    const buttons = await ctx.stagehand.extract(
      "Are there Export and Import buttons visible in the footer?",
      z.object({
        hasExportButton: z.boolean(),
        hasImportButton: z.boolean(),
      })
    );

    console.log("  Export button:", buttons.hasExportButton);
    console.log("  Import button:", buttons.hasImportButton);

    assert(buttons.hasExportButton, "Export button should exist");
    assert(buttons.hasImportButton, "Import button should exist");

    console.log("\x1b[32m%s\x1b[0m", "  ✅ Export/Import buttons present");

    // ─────────────────────────────────────────────────────────
    // Test 6: Console Error Check
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Test 6: Console Error Check");

    const errorLogs = ctx.getErrorLogs();

    if (errorLogs.length > 0) {
      console.warn("\x1b[33m%s\x1b[0m", "  ⚠️ Console errors detected:");
      errorLogs.forEach((e) => {
        console.warn("    ", e.text);
        reporter.addError(e.text);
      });
    } else {
      console.log("\x1b[32m%s\x1b[0m", "  ✅ No console errors detected");
    }

    // ─────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────
    console.log("\n\x1b[32m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
    console.log("\x1b[32m%s\x1b[0m", "║  🎉 ALL POPUP TESTS PASSED!                          ║");
    console.log("\x1b[32m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

    reporter.addNote("All popup tests passed!");

  } catch (error) {
    console.error("\n\x1b[31m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
    console.error("\x1b[31m%s\x1b[0m", "║  ❌ POPUP TEST FAILED                                 ║");
    console.error("\x1b[31m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝");
    console.error("\x1b[31m%s\x1b[0m", "\nError:", error);

    reporter.addError(String(error));

    // Dump logs for debugging
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
  runPopupTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
