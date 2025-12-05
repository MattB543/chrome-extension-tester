/**
 * X Profile Notes - Popup Script
 * Manages the extension popup for viewing and managing all notes
 */

document.addEventListener('DOMContentLoaded', init);

let allNotes = {};

async function init() {
  await loadNotes();
  renderNotes();
  setupEventListeners();
}

// ============================================================
// Data Loading
// ============================================================

async function loadNotes() {
  try {
    const result = await chrome.storage.local.get(['notes']);
    allNotes = result.notes || {};

    // Migrate old format notes to new multi-score format
    let needsSave = false;
    for (const username in allNotes) {
      if (allNotes[username].score !== undefined && !allNotes[username].scores) {
        const oldScore = allNotes[username].score;
        allNotes[username].scores = oldScore !== null
          ? [{ value: oldScore, timestamp: allNotes[username].updatedAt || Date.now() }]
          : [];
        delete allNotes[username].score;
        needsSave = true;
      }
    }

    if (needsSave) {
      await chrome.storage.local.set({ notes: allNotes });
      xpnLog('popup', 'log', 'Migrated notes to multi-score format');
    }

    updateNoteCount();
    xpnLog('popup', 'log', 'Loaded notes:', Object.keys(allNotes).length);
  } catch (error) {
    xpnLog('popup', 'error', 'Error loading notes:', error);
    allNotes = {};
  }
}

// Calculate average score for a user
function getAverageScore(data) {
  if (!data?.scores?.length) return null;
  const sum = data.scores.reduce((acc, s) => acc + s.value, 0);
  return Math.round((sum / data.scores.length) * 10) / 10;
}

function updateNoteCount() {
  const count = Object.keys(allNotes).length;
  document.getElementById('noteCount').textContent =
    `${count} note${count !== 1 ? 's' : ''}`;
}

// ============================================================
// Rendering
// ============================================================

function renderNotes(filter = '') {
  const container = document.getElementById('notesList');
  const emptyState = document.getElementById('emptyState');

  const filteredNotes = Object.entries(allNotes)
    .filter(([username, data]) => {
      if (!filter) return true;
      const searchLower = filter.toLowerCase();
      return username.toLowerCase().includes(searchLower) ||
             (data.note && data.note.toLowerCase().includes(searchLower));
    })
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt);

  // Clear existing notes (keep empty state)
  container.querySelectorAll('.note-item').forEach(el => el.remove());

  if (filteredNotes.length === 0) {
    emptyState.style.display = 'flex';
    if (filter && Object.keys(allNotes).length > 0) {
      emptyState.querySelector('p').textContent = 'No matching notes';
      emptyState.querySelector('span').textContent = 'Try a different search term';
    } else {
      emptyState.querySelector('p').textContent = 'No notes yet';
      emptyState.querySelector('span').textContent =
        'Click the note icon next to any @username on X.com to add your first note';
    }
    return;
  }

  emptyState.style.display = 'none';

  filteredNotes.forEach(([username, data]) => {
    const noteEl = createNoteElement(username, data);
    container.appendChild(noteEl);
  });
}

function createNoteElement(username, data) {
  const div = document.createElement('div');
  div.className = 'note-item';
  div.setAttribute('data-username', username);

  const date = new Date(data.updatedAt);
  const dateStr = formatDate(date);

  // Truncate note for preview
  const preview = data.note && data.note.length > 100
    ? data.note.substring(0, 100) + '...'
    : (data.note || '');

  // Calculate average score
  const avgScore = getAverageScore(data);
  const scoreCount = data.scores?.length || 0;
  const hasScores = avgScore !== null;

  // Score badge HTML - show average with decimal
  let scoreBadge = '';
  if (hasScores) {
    const displayScore = avgScore % 1 === 0 ? avgScore.toString() : avgScore.toFixed(1);
    const colorTier = Math.max(1, Math.min(5, Math.round(avgScore)));
    scoreBadge = `<span class="note-score note-score-${colorTier}" title="${scoreCount} score${scoreCount > 1 ? 's' : ''}">${displayScore}</span>`;
  }

  // Content display - show score-only indicator if no text
  const contentHtml = preview
    ? escapeHtml(preview)
    : (hasScores ? '<em class="note-score-only">Score only</em>' : '');

  div.innerHTML = `
    <div class="note-header">
      <div class="note-header-left">
        ${scoreBadge}
        <a class="note-username" href="https://x.com/${username}" target="_blank" rel="noopener">
          @${username}
        </a>
      </div>
      <span class="note-date">${dateStr}</span>
    </div>
    <div class="note-content">${contentHtml}</div>
    <div class="note-actions">
      <button class="note-action-btn edit-btn" title="Edit note">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
        </svg>
      </button>
      <button class="note-action-btn delete-btn" title="Delete note">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
        </svg>
      </button>
    </div>
  `;

  // Event listeners
  div.querySelector('.edit-btn').addEventListener('click', () => editNote(username));
  div.querySelector('.delete-btn').addEventListener('click', () => deleteNote(username));

  return div;
}

function formatDate(date) {
  const now = new Date();
  const diff = now - date;

  // Less than 1 minute
  if (diff < 60000) return 'Just now';

  // Less than 1 hour
  if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    return `${mins}m ago`;
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  // Otherwise show date
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================
// Note Actions
// ============================================================

async function editNote(username) {
  const data = allNotes[username];
  if (!data) return;

  const newNote = prompt(`Edit note for @${username}:`, data.note);
  if (newNote === null) return; // Cancelled

  const hasScores = data.scores && data.scores.length > 0;

  if (newNote.trim() === '' && !hasScores) {
    // Delete only if no scores remain
    await deleteNote(username);
  } else {
    allNotes[username] = {
      ...data,
      note: newNote.trim(),
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({ notes: allNotes });
    renderNotes(document.getElementById('searchInput').value);
    updateNoteCount();
  }
}

async function deleteNote(username) {
  if (!confirm(`Delete note for @${username}?`)) return;

  delete allNotes[username];
  await chrome.storage.local.set({ notes: allNotes });
  renderNotes(document.getElementById('searchInput').value);
  updateNoteCount();
}

// ============================================================
// Import/Export
// ============================================================

function exportNotes() {
  const dataStr = JSON.stringify(allNotes, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `x-profile-notes-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importNotes(file) {
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);

      // Validate structure
      if (typeof imported !== 'object' || imported === null) {
        throw new Error('Invalid format');
      }

      // Count new and updated
      let newCount = 0;
      let updateCount = 0;

      for (const [username, data] of Object.entries(imported)) {
        // Skip if neither note nor scores/score exists
        const hasScores = data.scores && data.scores.length > 0;
        const hasOldScore = data.score !== undefined && data.score !== null;
        if (typeof data.note !== 'string' && !hasScores && !hasOldScore) continue;

        if (allNotes[username]) {
          updateCount++;
        } else {
          newCount++;
        }

        // Handle both old single-score and new multi-score formats
        let scores = [];
        if (data.scores && Array.isArray(data.scores)) {
          scores = data.scores;
        } else if (data.score !== undefined && data.score !== null) {
          // Migrate old format
          scores = [{ value: data.score, timestamp: data.updatedAt || Date.now() }];
        }

        allNotes[username] = {
          note: data.note || '',
          scores: scores,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now()
        };
      }

      await chrome.storage.local.set({ notes: allNotes });
      renderNotes();
      updateNoteCount();

      xpnLog('popup', 'log', `Imported ${newCount} new notes, updated ${updateCount} existing notes.`);
      alert(`Imported ${newCount} new notes, updated ${updateCount} existing notes.`);
    } catch (error) {
      alert('Failed to import notes. Please check the file format.');
      xpnLog('popup', 'error', 'Import error:', error);
    }
  };

  reader.readAsText(file);
}

// ============================================================
// Event Listeners
// ============================================================

function setupEventListeners() {
  // Search
  const searchInput = document.getElementById('searchInput');
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderNotes(e.target.value);
    }, 150);
  });

  // Export
  document.getElementById('exportBtn').addEventListener('click', exportNotes);

  // Import
  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');

  importBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importNotes(e.target.files[0]);
      e.target.value = ''; // Reset for re-import
    }
  });

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.notes) {
      allNotes = changes.notes.newValue || {};
      renderNotes(searchInput.value);
      updateNoteCount();
    }
  });
}
