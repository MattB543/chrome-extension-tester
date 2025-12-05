/**
 * X Profile Notes - Feed Tests with Stealth (rebrowser-playwright)
 * Uses rebrowser-playwright to bypass X.com's CDP detection
 */

import { chromium } from "rebrowser-playwright";
import path from "path";
import fs from "fs";
import "dotenv/config";

// Human-like delay helper
const humanDelay = (min: number, max: number) =>
  new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

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
  console.log("\n\x1b[36m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
  console.log("\x1b[36m%s\x1b[0m", "║           FEED STEALTH TEST (rebrowser)               ║");
  console.log("\x1b[36m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

  const chromePath = findChromeForTesting();
  const extensionPath = path.resolve(__dirname, "..");
  const profilePath = path.resolve(__dirname, "../.test-profile");

  // Create report directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reportDir = path.resolve(__dirname, "..", "test-reports", `${timestamp}_feed-stealth`);
  fs.mkdirSync(reportDir, { recursive: true });

  console.log("\x1b[32m%s\x1b[0m", "[INFO] Using rebrowser-playwright (stealth mode)");
  console.log("\x1b[32m%s\x1b[0m", "[INFO] Chrome:", chromePath);
  console.log("\x1b[32m%s\x1b[0m", "[INFO] Profile:", profilePath);
  console.log("\x1b[32m%s\x1b[0m", "[INFO] Report:", reportDir);
  console.log();

  const context = await chromium.launchPersistentContext(profilePath, {
    headless: false,
    executablePath: chromePath,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-first-run",
      "--no-default-browser-check",
      "--start-maximized",
    ],
    viewport: { width: 1280, height: 900 },
  });

  const page = context.pages()[0] || await context.newPage();
  let stepNum = 0;

  // Collect console logs from the page (includes content script logs)
  const consoleLogs: { type: string; text: string; time: string }[] = [];
  const pageErrors: { message: string; time: string }[] = [];

  // IMPORTANT: Attach listeners BEFORE navigating to capture all logs
  // Note: Content scripts may still run in isolated world that Playwright doesn't capture

  page.on('console', (msg) => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text(),
      time: new Date().toISOString(),
    });
  });

  page.on('pageerror', (error) => {
    pageErrors.push({
      message: error.message,
      time: new Date().toISOString(),
    });
  });

  // Helper to get extension logs via event-based API
  const getExtensionLogs = async (): Promise<any[]> => {
    try {
      const logs = await page.evaluate(async () => {
        return new Promise<string>((resolve) => {
          // Set up one-time listener for response
          const handler = (e: CustomEvent) => {
            resolve(e.detail);
          };
          window.addEventListener('__xpn_logs_response__', handler as EventListener, { once: true });

          // Request logs from content script
          window.dispatchEvent(new Event('__xpn_get_logs__'));

          // Timeout after 2 seconds
          setTimeout(() => resolve('[]'), 2000);
        });
      });
      return JSON.parse(logs);
    } catch (e) {
      console.error('Failed to get extension logs:', e);
      return [];
    }
  };

  // Helper to save logs
  const saveLogs = async () => {
    // Get extension state from DOM
    const extensionState = await page.evaluate(() => {
      const buttons = document.querySelectorAll('.xpn-note-btn');
      const modal = document.querySelector('.xpn-modal');
      const wrappers = document.querySelectorAll('.xpn-username-wrapper');

      return {
        buttonCount: buttons.length,
        modalExists: !!modal,
        wrapperCount: wrappers.length,
      };
    });

    // Get extension logs via event API
    const extensionLogs = await getExtensionLogs();

    // Format extension logs
    const formatExtLog = (log: any) => {
      const time = new Date(log.t).toISOString();
      return `[${time}] [${log.s}:${log.l.toUpperCase()}] ${log.m}`;
    };

    const logsContent = `# Extension Logs

## Extension Logs (from chrome.storage)
${extensionLogs.length === 0 ? '_No extension logs captured_' : extensionLogs.map(formatExtLog).join('\n')}

## Page Console (website JS only)
${consoleLogs.length === 0 ? '_No page console logs_' : consoleLogs.map(l => `[${l.time}] [${l.type.toUpperCase()}] ${l.text}`).join('\n')}

## Page Errors
${pageErrors.length === 0 ? '_No errors_' : pageErrors.map(e => `[${e.time}] ${e.message}`).join('\n')}

## Extension State (from DOM)
- Buttons injected: ${extensionState.buttonCount}
- Wrappers created: ${extensionState.wrapperCount}
- Modal exists: ${extensionState.modalExists}

## Log Sources
- **content** - content.js (runs on X.com pages)
- **background** - background.js (service worker)
- **popup** - popup.js (extension popup)
`;
    fs.writeFileSync(path.join(reportDir, 'console-logs.md'), logsContent);
    console.log(`  📋 Logs saved: console-logs.md (${extensionLogs.length} extension logs, ${consoleLogs.length} page console, ext: ${extensionState.buttonCount} buttons)`);
  };

  const takeScreenshot = async (name: string) => {
    stepNum++;
    const filename = `${String(stepNum).padStart(2, "0")}_${name}.png`;
    const filepath = path.join(reportDir, filename);
    await page.screenshot({ path: filepath, clip: { x: 0, y: 0, width: 1280, height: 900 } });
    console.log(`  📸 Screenshot: ${filename}`);
    return filepath;
  };

  // Save HTML helper - saves full page and optionally extracts specific sections
  const saveHtml = async (name: string, options?: { selector?: string; aroundButtons?: boolean }) => {
    const filename = `${name}.html`;
    const filepath = path.join(reportDir, filename);

    let html: string;

    if (options?.aroundButtons) {
      // Extract HTML around each note button for analysis
      html = await page.evaluate(() => {
        const buttons = document.querySelectorAll(".xpn-note-btn");
        const fragments: string[] = [];

        buttons.forEach((btn, i) => {
          if (i >= 10) return; // Only first 10 buttons

          // Get the parent chain up to 5 levels
          let el: Element | null = btn;
          for (let j = 0; j < 5 && el?.parentElement; j++) {
            el = el.parentElement;
          }

          if (el) {
            fragments.push(`\n<!-- ===== BUTTON ${i} CONTEXT ===== -->\n${el.outerHTML}`);
          }
        });

        return `<!DOCTYPE html>
<html>
<head><title>Button Context HTML</title></head>
<body>
<h1>HTML Context Around First 10 Note Buttons</h1>
${fragments.join("\n\n<hr>\n\n")}
</body>
</html>`;
      });
    } else if (options?.selector) {
      // Extract specific selector
      html = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.outerHTML : `<!-- Element not found: ${sel} -->`;
      }, options.selector);
    } else {
      // Full page HTML
      html = await page.content();
    }

    fs.writeFileSync(filepath, html, "utf-8");
    console.log(`  📄 HTML saved: ${filename} (${Math.round(html.length / 1024)}KB)`);
    return filepath;
  };

  // Analyze username elements - find what's being matched
  const analyzeSelectors = async () => {
    const analysis = await page.evaluate(() => {
      const results: any = {
        totalButtons: document.querySelectorAll(".xpn-note-btn").length,
        wrappers: document.querySelectorAll(".xpn-username-wrapper").length,
        profileLinks: 0,
        usernameSpans: 0,
        processedElements: 0,
        buttonContexts: [] as any[],
      };

      // Count profile links
      document.querySelectorAll('a[href^="/"]').forEach(link => {
        const href = link.getAttribute('href');
        if (href && /^\/[a-zA-Z0-9_]{1,15}$/.test(href)) {
          results.profileLinks++;
        }
      });

      // Count username spans
      document.querySelectorAll('span').forEach(span => {
        const text = span.textContent?.trim() || "";
        if (/^@[a-zA-Z0-9_]{1,15}$/.test(text)) {
          results.usernameSpans++;
        }
      });

      // Count processed elements
      results.processedElements = document.querySelectorAll('[data-xpn-processed]').length;

      // Get context for first 5 buttons
      document.querySelectorAll(".xpn-note-btn").forEach((btn, i) => {
        if (i >= 5) return;
        const username = btn.getAttribute('data-username');
        const parent = btn.parentElement;
        const grandparent = parent?.parentElement;

        results.buttonContexts.push({
          index: i,
          username,
          parentTag: parent?.tagName,
          parentClass: parent?.className,
          grandparentTag: grandparent?.tagName,
          grandparentClass: grandparent?.className?.slice(0, 50),
          siblingCount: parent?.children.length,
          prevSiblingTag: btn.previousElementSibling?.tagName,
          prevSiblingText: btn.previousElementSibling?.textContent?.slice(0, 30),
        });
      });

      return results;
    });

    console.log("\n  📊 Selector Analysis:");
    console.log(`     Total buttons: ${analysis.totalButtons}`);
    console.log(`     Wrappers created: ${analysis.wrappers}`);
    console.log(`     Profile links found: ${analysis.profileLinks}`);
    console.log(`     Username spans found: ${analysis.usernameSpans}`);
    console.log(`     Processed elements: ${analysis.processedElements}`);

    if (analysis.buttonContexts.length > 0) {
      console.log("\n  📍 First 5 button contexts:");
      analysis.buttonContexts.forEach((ctx: any) => {
        console.log(`     [${ctx.index}] @${ctx.username}`);
        console.log(`         parent: <${ctx.parentTag}> class="${ctx.parentClass}"`);
        console.log(`         siblings: ${ctx.siblingCount}, prev: <${ctx.prevSiblingTag}> "${ctx.prevSiblingText}"`);
      });
    }

    return analysis;
  };

  try {
    // ─────────────────────────────────────────────────────────────
    // Step 1: Navigate to Home Feed
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 1: Navigate to Home Feed");

    await page.goto("https://x.com/home");
    await humanDelay(5000, 7000);

    await takeScreenshot("home-feed");

    // Check if logged in
    const pageContent = await page.content();
    const hasError = pageContent.includes("Something went wrong");

    if (hasError) {
      console.log("\x1b[31m%s\x1b[0m", "  ❌ Still getting 'Something went wrong' - detection not bypassed");
      await takeScreenshot("error-state");
    } else {
      console.log("\x1b[32m%s\x1b[0m", "  ✅ Page loaded without error!");
    }

    // ─────────────────────────────────────────────────────────────
    // Step 2: Check for Note Buttons & Capture HTML
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 2: Check Note Buttons & Capture HTML");

    const buttonCount = await page.evaluate(() => {
      return document.querySelectorAll(".xpn-note-btn").length;
    });

    console.log(`  Note buttons found: ${buttonCount}`);

    if (buttonCount > 0) {
      await takeScreenshot("note-buttons-found");
    }

    // Save HTML for analysis
    await saveHtml("full-page");
    await saveHtml("button-contexts", { aroundButtons: true });

    // Run selector analysis
    await analyzeSelectors();

    // ─────────────────────────────────────────────────────────────
    // Step 3: Scroll Feed
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 3: Scroll Feed");

    for (let i = 1; i <= 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 400));
      await humanDelay(2000, 3000);
      await takeScreenshot(`scroll-${i}`);

      const currentButtons = await page.evaluate(() => {
        return document.querySelectorAll(".xpn-note-btn").length;
      });
      console.log(`  Scroll ${i}: ${currentButtons} buttons visible`);
    }

    // ─────────────────────────────────────────────────────────────
    // Step 4: Examine Button Styling
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 4: Examine Button Styling");

    const buttonInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll(".xpn-note-btn")).slice(0, 3);
      return buttons.map((btn, i) => {
        const el = btn as HTMLElement;
        const rect = el.getBoundingClientRect();
        const styles = window.getComputedStyle(el);
        const parent = el.parentElement;
        const parentStyles = parent ? window.getComputedStyle(parent) : null;

        return {
          index: i,
          position: `(${Math.round(rect.x)}, ${Math.round(rect.y)})`,
          size: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
          display: styles.display,
          parentDisplay: parentStyles?.display || "N/A",
          parentFlex: parentStyles?.flexDirection || "N/A",
        };
      });
    });

    if (buttonInfo.length > 0) {
      console.log("  Button info:");
      buttonInfo.forEach(info => {
        console.log(`    ${info.index}: pos${info.position} size(${info.size}) display=${info.display}`);
        console.log(`       parent: display=${info.parentDisplay} flex=${info.parentFlex}`);
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Step 5: Test Multi-Score Feature
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[33m%s\x1b[0m", "📝 Step 5: Test Multi-Score Feature");

    await page.evaluate(() => window.scrollTo(0, 0));
    await humanDelay(1000, 2000);

    // Get the first button's username for verification
    const firstButtonUsername = await page.evaluate(() => {
      const btn = document.querySelector(".xpn-note-btn");
      return btn?.getAttribute('data-username') || null;
    });

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
      await takeScreenshot("modal-open");

      // Check if score buttons and history section exist
      const modalCheck = await page.evaluate(() => {
        return {
          scoreButtons: document.querySelectorAll('.xpn-score-btn').length,
          hasHistorySection: !!document.querySelector('.xpn-score-history'),
          hasHint: !!document.querySelector('.xpn-score-hint'),
        };
      });
      console.log(`  Score buttons present: ${modalCheck.scoreButtons}`);
      console.log(`  History section exists: ${modalCheck.hasHistorySection}`);
      console.log(`  Has score hint: ${modalCheck.hasHint}`);

      // Type a test note first
      await page.fill('.xpn-modal-textarea', 'Test note for multi-score feature');
      await humanDelay(300, 500);

      // Add first score (score 4) - this saves immediately in new system
      console.log("  Adding first score: 4");
      await page.evaluate(() => {
        const scoreBtn = document.querySelector('.xpn-score-btn[data-score="4"]') as HTMLButtonElement;
        if (scoreBtn) scoreBtn.click();
      });
      await humanDelay(500, 800);
      await takeScreenshot("score-1-added");

      // Verify score history shows 1 entry
      const historyAfter1 = await page.evaluate(() => {
        const entries = document.querySelectorAll('.xpn-score-entry');
        const avgSpan = document.querySelector('.xpn-score-avg');
        return {
          count: entries.length,
          average: avgSpan?.textContent || 'N/A',
        };
      });
      console.log(`  After 1st score: ${historyAfter1.count} entries, avg: ${historyAfter1.average}`);

      // Add second score (score 5)
      console.log("  Adding second score: 5");
      await page.evaluate(() => {
        const scoreBtn = document.querySelector('.xpn-score-btn[data-score="5"]') as HTMLButtonElement;
        if (scoreBtn) scoreBtn.click();
      });
      await humanDelay(500, 800);
      await takeScreenshot("score-2-added");

      // Verify average is now 4.5
      const historyAfter2 = await page.evaluate(() => {
        const entries = document.querySelectorAll('.xpn-score-entry');
        const avgSpan = document.querySelector('.xpn-score-avg');
        return {
          count: entries.length,
          average: avgSpan?.textContent || 'N/A',
        };
      });
      console.log(`  After 2nd score: ${historyAfter2.count} entries, avg: ${historyAfter2.average}`);

      // Add third score (score 3)
      console.log("  Adding third score: 3");
      await page.evaluate(() => {
        const scoreBtn = document.querySelector('.xpn-score-btn[data-score="3"]') as HTMLButtonElement;
        if (scoreBtn) scoreBtn.click();
      });
      await humanDelay(500, 800);
      await takeScreenshot("score-3-added");

      // Check history now shows 3 entries with correct average
      const historyAfter3 = await page.evaluate(() => {
        const entries = document.querySelectorAll('.xpn-score-entry');
        const avgSpan = document.querySelector('.xpn-score-avg');
        const countSpan = document.querySelector('.xpn-score-count');
        return {
          count: entries.length,
          average: avgSpan?.textContent || 'N/A',
          countText: countSpan?.textContent || 'N/A',
        };
      });
      console.log(`  After 3rd score: ${historyAfter3.count} entries, avg: ${historyAfter3.average}, count: ${historyAfter3.countText}`);

      // Save the note text
      await page.click('.xpn-modal-save');
      await humanDelay(500, 1000);
      await takeScreenshot("after-save");

      // Verify the button now shows the average score with decimal
      if (firstButtonUsername) {
        const buttonDisplay = await page.evaluate((username) => {
          const btn = document.querySelector(`.xpn-note-btn[data-username="${username}"]`);
          if (!btn) return null;
          return {
            hasScoreClass: btn.classList.contains('xpn-has-score'),
            scoreClass: Array.from(btn.classList).find(c => c.startsWith('xpn-score-')),
            innerHTML: btn.innerHTML.trim(),
            title: btn.getAttribute('title'),
          };
        }, firstButtonUsername);

        if (buttonDisplay) {
          console.log(`  Button updated: hasScoreClass=${buttonDisplay.hasScoreClass}`);
          console.log(`  Score class: ${buttonDisplay.scoreClass}`);
          console.log(`  Button content: ${buttonDisplay.innerHTML}`);
          console.log(`  Button title: ${buttonDisplay.title}`);
        }
      }

      // Test: Open modal again and verify score history is persisted
      await page.evaluate(() => {
        const btn = document.querySelector(".xpn-note-btn") as HTMLButtonElement;
        if (btn) btn.click();
      });
      await humanDelay(500, 1000);
      await takeScreenshot("modal-reopened-with-history");

      const persistedHistory = await page.evaluate(() => {
        const entries = document.querySelectorAll('.xpn-score-entry');
        const avgSpan = document.querySelector('.xpn-score-avg');
        return {
          count: entries.length,
          average: avgSpan?.textContent || 'N/A',
        };
      });
      console.log(`  Persisted after reopen: ${persistedHistory.count} entries, avg: ${persistedHistory.average}`);

      // Test: Delete one score from history
      console.log("  Testing score deletion...");
      const deleteResult = await page.evaluate(() => {
        const deleteBtn = document.querySelector('.xpn-score-entry .xpn-score-delete') as HTMLButtonElement;
        if (deleteBtn) {
          deleteBtn.click();
          return true;
        }
        return false;
      });
      await humanDelay(500, 800);

      if (deleteResult) {
        await takeScreenshot("after-score-delete");
        const historyAfterDelete = await page.evaluate(() => {
          const entries = document.querySelectorAll('.xpn-score-entry');
          const avgSpan = document.querySelector('.xpn-score-avg');
          return {
            count: entries.length,
            average: avgSpan?.textContent || 'N/A',
          };
        });
        console.log(`  After delete: ${historyAfterDelete.count} entries, avg: ${historyAfterDelete.average}`);
      }

      // Close modal
      await page.evaluate(() => {
        const closeBtn = document.querySelector('.xpn-modal-close, .xpn-modal-cancel') as HTMLButtonElement;
        if (closeBtn) closeBtn.click();
      });
      await humanDelay(500, 1000);
    }

    // Final screenshot
    await takeScreenshot("final-state");

    // Save console logs
    await saveLogs();

    // ─────────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────────
    console.log("\n\x1b[32m%s\x1b[0m", "╔═══════════════════════════════════════════════════════╗");
    console.log("\x1b[32m%s\x1b[0m", "║  🎉 TEST COMPLETED!                                   ║");
    console.log("\x1b[32m%s\x1b[0m", "╚═══════════════════════════════════════════════════════╝\n");

    console.log("\x1b[36m%s\x1b[0m", `Screenshots saved to: ${reportDir}\n`);

  } catch (error) {
    console.error("\x1b[31m%s\x1b[0m", "\n❌ Test failed:", error);
    await takeScreenshot("error");
    await saveLogs(); // Also save logs on error
  } finally {
    await context.close();
  }
}

main().catch(console.error);
