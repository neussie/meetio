/**
 * Options/Settings Page Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settings-form');
  const notionTokenInput = document.getElementById('notion-token');
  const notionDatabaseIdInput = document.getElementById('notion-database-id');
  const testConnectionButton = document.getElementById('test-connection');
  const saveStatus = document.getElementById('save-status');

  // Load saved settings
  loadSettings();

  // Save settings on form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveSettings();
  });

  // Test Notion connection
  testConnectionButton.addEventListener('click', () => {
    testNotionConnection();
  });

  /**
   * Load saved settings from storage
   */
  function loadSettings() {
    chrome.storage.local.get(['notionToken', 'notionDatabaseId'], (result) => {
      if (result.notionToken) {
        notionTokenInput.value = result.notionToken;
      }
      if (result.notionDatabaseId) {
        notionDatabaseIdInput.value = result.notionDatabaseId;
      }
    });
  }

  /**
   * Save settings to storage
   */
  function saveSettings() {
    const notionToken = notionTokenInput.value.trim();
    const notionDatabaseId = notionDatabaseIdInput.value.trim();

    if (!notionToken || !notionDatabaseId) {
      showStatus('Please fill in both fields', 'error');
      return;
    }

    chrome.storage.local.set({
      notionToken: notionToken,
      notionDatabaseId: notionDatabaseId
    }, () => {
      showStatus('Settings saved successfully!', 'success');
    });
  }

  /**
   * Test Notion API connection
   */
  async function testNotionConnection() {
    const notionToken = notionTokenInput.value.trim();
    const notionDatabaseId = notionDatabaseIdInput.value.trim();

    if (!notionToken || !notionDatabaseId) {
      showStatus('Please fill in both fields first', 'error');
      return;
    }

    showStatus('Testing connection...', 'info');
    testConnectionButton.disabled = true;

    try {
      // Test API call to get database
      const response = await fetch(`https://api.notion.com/v1/databases/${notionDatabaseId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Notion-Version': '2022-06-28'
        }
      });

      if (response.ok) {
        const data = await response.json();
        showStatus(`✓ Connected! Database: "${data.title[0]?.plain_text || 'Untitled'}"`, 'success');
      } else {
        const error = await response.json();
        showStatus(`✗ Connection failed: ${error.message || response.statusText}`, 'error');
      }
    } catch (error) {
      showStatus(`✗ Connection error: ${error.message}`, 'error');
    } finally {
      testConnectionButton.disabled = false;
    }
  }

  /**
   * Show status message
   */
  function showStatus(message, type) {
    saveStatus.textContent = message;
    saveStatus.className = 'status-message status-' + type;
    saveStatus.style.display = 'block';

    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
      setTimeout(() => {
        saveStatus.style.display = 'none';
      }, 3000);
    }
  }
});
