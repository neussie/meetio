/**
 * Background Service Worker
 * Handles downloads, Notion sync, and message passing
 */

console.log('Harness Meeting Exporter - Service Worker loaded');

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type);

  switch (request.type) {
    case 'DOWNLOAD_MARKDOWN':
      handleDownloadMarkdown(request.data);
      sendResponse({ success: true });
      break;

    case 'SYNC_TO_NOTION':
      handleNotionSync(request.data)
        .then(result => sendResponse({ success: true, data: result }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response

    case 'GET_SETTINGS':
      getSettings()
        .then(settings => sendResponse({ success: true, data: settings }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    default:
      console.warn('Unknown message type:', request.type);
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

/**
 * Download a markdown file
 */
function handleDownloadMarkdown(data) {
  const { filename, content } = data;

  // Create blob and download
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: false // Auto-save to downloads folder
  }, (downloadId) => {
    console.log('Download started:', downloadId);
    // Clean up blob URL after download starts
    setTimeout(() => URL.revokeObjectURL(url), 100);
  });
}

/**
 * Get saved settings
 */
async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['notionToken', 'notionDatabaseId'], (result) => {
      resolve({
        notionToken: result.notionToken || '',
        notionDatabaseId: result.notionDatabaseId || ''
      });
    });
  });
}

/**
 * Sync transcript to Notion
 * TODO: Implement in Phase 5
 */
async function handleNotionSync(data) {
  console.log('Notion sync requested:', data.title);

  // Get settings
  const settings = await getSettings();

  if (!settings.notionToken || !settings.notionDatabaseId) {
    throw new Error('Notion not configured. Please set API token and database ID in settings.');
  }

  // TODO: Implement Notion API call
  // For now, just log
  console.log('Would sync to Notion:', {
    token: settings.notionToken.substring(0, 10) + '...',
    database: settings.notionDatabaseId,
    meeting: data.title
  });

  throw new Error('Notion sync not yet implemented (Phase 5)');
}

// Installation handler
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Extension installed!');
    // Could open welcome page here
  } else if (details.reason === 'update') {
    console.log('Extension updated to version', chrome.runtime.getManifest().version);
  }
});
