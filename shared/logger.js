/**
 * X Profile Notes - Shared Debug Logger
 *
 * Captures console logs from all extension scripts (content, background, popup)
 * and stores them in chrome.storage.local for retrieval during automated testing.
 *
 * Usage:
 *   xpnLog('content', 'log', 'Message here', someData);
 *   xpnLog('background', 'error', 'Something went wrong', error);
 */

(function() {
  'use strict';

  const XPN_LOG_KEY = '__xpn_debug_logs__';
  const XPN_MAX_LOGS = 1000;

  // Queue for batching writes to storage
  let logQueue = [];
  let flushTimeout = null;
  let isFlushing = false;

  /**
   * Log a message to both console and chrome.storage
   * @param {string} source - 'content' | 'background' | 'popup'
   * @param {string} level - 'log' | 'error' | 'warn' | 'info'
   * @param {...any} args - Arguments to log
   */
  function xpnLog(source, level, ...args) {
    // Always log to console immediately (for manual debugging)
    const consoleFn = console[level] || console.log;
    consoleFn.apply(console, [`[XPN:${source}]`, ...args]);

    // Format arguments for storage
    const message = args.map(arg => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    // Queue the log entry
    logQueue.push({
      t: Date.now(),
      s: source,
      l: level,
      m: message
    });

    // Debounce flush to batch writes (100ms)
    if (!flushTimeout) {
      flushTimeout = setTimeout(flushLogs, 100);
    }
  }

  /**
   * Flush queued logs to chrome.storage.local
   */
  async function flushLogs() {
    flushTimeout = null;

    if (logQueue.length === 0 || isFlushing) return;

    isFlushing = true;
    const toFlush = logQueue;
    logQueue = [];

    try {
      const result = await chrome.storage.local.get(XPN_LOG_KEY);
      const existing = result[XPN_LOG_KEY] || [];
      const combined = [...existing, ...toFlush];

      // Keep only last MAX_LOGS entries to prevent bloat
      const trimmed = combined.length > XPN_MAX_LOGS
        ? combined.slice(-XPN_MAX_LOGS)
        : combined;

      await chrome.storage.local.set({ [XPN_LOG_KEY]: trimmed });
    } catch (e) {
      // If storage fails, at least we logged to console
      console.error('[XPN:logger] Failed to flush logs to storage:', e);
    } finally {
      isFlushing = false;

      // If more logs queued during flush, schedule another flush
      if (logQueue.length > 0 && !flushTimeout) {
        flushTimeout = setTimeout(flushLogs, 100);
      }
    }
  }

  /**
   * Get all stored logs
   * @returns {Promise<Array>} Array of log entries
   */
  async function xpnGetLogs() {
    // Flush any pending logs first
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    if (logQueue.length > 0) {
      await flushLogs();
    }

    try {
      const result = await chrome.storage.local.get(XPN_LOG_KEY);
      return result[XPN_LOG_KEY] || [];
    } catch (e) {
      console.error('[XPN:logger] Failed to get logs:', e);
      return [];
    }
  }

  /**
   * Clear all stored logs
   */
  async function xpnClearLogs() {
    logQueue = [];
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }

    try {
      await chrome.storage.local.remove(XPN_LOG_KEY);
    } catch (e) {
      console.error('[XPN:logger] Failed to clear logs:', e);
    }
  }

  // ============================================================
  // Event-based API for test retrieval
  // (Content scripts run in isolated world, so we use events
  // to communicate with the main world where Playwright runs)
  // ============================================================

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // Content script context - set up event listeners for test communication

    window.addEventListener('__xpn_get_logs__', async () => {
      const logs = await xpnGetLogs();
      window.dispatchEvent(new CustomEvent('__xpn_logs_response__', {
        detail: JSON.stringify(logs) // Stringify to safely pass through
      }));
    });

    window.addEventListener('__xpn_clear_logs__', async () => {
      await xpnClearLogs();
      window.dispatchEvent(new Event('__xpn_clear_logs_done__'));
    });
  }

  // ============================================================
  // Expose globally
  // ============================================================

  // For content scripts and popup (window context)
  if (typeof window !== 'undefined') {
    window.xpnLog = xpnLog;
    window.xpnGetLogs = xpnGetLogs;
    window.xpnClearLogs = xpnClearLogs;
  }

  // For service worker (self context)
  if (typeof self !== 'undefined' && typeof window === 'undefined') {
    self.xpnLog = xpnLog;
    self.xpnGetLogs = xpnGetLogs;
    self.xpnClearLogs = xpnClearLogs;
  }

  // Also expose on globalThis for universal access
  if (typeof globalThis !== 'undefined') {
    globalThis.xpnLog = xpnLog;
    globalThis.xpnGetLogs = xpnGetLogs;
    globalThis.xpnClearLogs = xpnClearLogs;
  }

})();
