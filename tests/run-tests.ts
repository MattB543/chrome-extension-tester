/**
 * X Profile Notes - Test Runner
 * Main entry point for running all tests
 */

import "dotenv/config";
import { runPopupTests } from "./popup.test";
import { runContentScriptTests } from "./content-script.test";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

async function main() {
  console.log("\n");
  console.log("\x1b[36m%s\x1b[0m", "╔═══════════════════════════════════════════════════════════════════╗");
  console.log("\x1b[36m%s\x1b[0m", "║                                                                   ║");
  console.log("\x1b[36m%s\x1b[0m", "║     X Profile Notes - Automated Test Suite                       ║");
  console.log("\x1b[36m%s\x1b[0m", "║     Using Stagehand + Console Capture                            ║");
  console.log("\x1b[36m%s\x1b[0m", "║                                                                   ║");
  console.log("\x1b[36m%s\x1b[0m", "╚═══════════════════════════════════════════════════════════════════╝");
  console.log("\n");

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error("\x1b[31m%s\x1b[0m", "Error: No API key found!");
    console.error("Please set ANTHROPIC_API_KEY or OPENAI_API_KEY in your .env file");
    console.error("Copy .env.example to .env and add your API key");
    process.exit(1);
  }

  const startTime = Date.now();
  const results: TestResult[] = [];

  // ─────────────────────────────────────────────────────────
  // Run Popup Tests
  // ─────────────────────────────────────────────────────────
  console.log("\x1b[33m%s\x1b[0m", "Starting Popup Tests...\n");
  const popupStart = Date.now();

  try {
    await runPopupTests();
    results.push({
      name: "Popup Tests",
      passed: true,
      duration: Date.now() - popupStart,
    });
  } catch (error) {
    results.push({
      name: "Popup Tests",
      passed: false,
      error: String(error),
      duration: Date.now() - popupStart,
    });
  }

  // Brief pause between test suites
  await new Promise((r) => setTimeout(r, 2000));

  // ─────────────────────────────────────────────────────────
  // Run Content Script Tests
  // ─────────────────────────────────────────────────────────
  console.log("\x1b[33m%s\x1b[0m", "Starting Content Script Tests...\n");
  const contentStart = Date.now();

  try {
    await runContentScriptTests();
    results.push({
      name: "Content Script Tests",
      passed: true,
      duration: Date.now() - contentStart,
    });
  } catch (error) {
    results.push({
      name: "Content Script Tests",
      passed: false,
      error: String(error),
      duration: Date.now() - contentStart,
    });
  }

  // ─────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log("\n");
  console.log("\x1b[36m%s\x1b[0m", "╔═══════════════════════════════════════════════════════════════════╗");
  console.log("\x1b[36m%s\x1b[0m", "║                       TEST RESULTS                                ║");
  console.log("\x1b[36m%s\x1b[0m", "╠═══════════════════════════════════════════════════════════════════╣");

  results.forEach((r) => {
    const status = r.passed ? "\x1b[32m✅ PASS\x1b[0m" : "\x1b[31m❌ FAIL\x1b[0m";
    const duration = `${(r.duration / 1000).toFixed(1)}s`;
    const line = `║  ${status}  ${r.name.padEnd(35)} ${duration.padStart(10)} ║`;
    console.log(line);

    if (!r.passed && r.error) {
      const errorLine = `║         ${r.error.substring(0, 55).padEnd(55)} ║`;
      console.log("\x1b[31m%s\x1b[0m", errorLine);
    }
  });

  console.log("\x1b[36m%s\x1b[0m", "╠═══════════════════════════════════════════════════════════════════╣");

  const summaryColor = failed > 0 ? "\x1b[31m" : "\x1b[32m";
  const summaryText = `║  Total: ${passed} passed, ${failed} failed in ${totalDuration}s`;
  console.log(`${summaryColor}${summaryText.padEnd(68)}║\x1b[0m`);

  console.log("\x1b[36m%s\x1b[0m", "╚═══════════════════════════════════════════════════════════════════╝");
  console.log("\n");

  // Exit with error code if any tests failed
  if (failed > 0) {
    console.log("\x1b[31m%s\x1b[0m", "Some tests failed. See above for details.\n");
    process.exit(1);
  } else {
    console.log("\x1b[32m%s\x1b[0m", "All tests passed! 🎉\n");
    process.exit(0);
  }
}

// Run the tests
main().catch((error) => {
  console.error("\x1b[31m%s\x1b[0m", "Fatal error:", error);
  process.exit(1);
});
