/**
 * Popup UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const openZoomButton = document.getElementById('open-zoom');
  const openChorusButton = document.getElementById('open-chorus');
  const openSettingsButton = document.getElementById('open-settings');
  const statusText = document.getElementById('status-text');
  const statusIndicator = document.getElementById('status-indicator');

  // Open Zoom notes page
  openZoomButton.addEventListener('click', () => {
    chrome.tabs.create({
      url: 'https://hub.zoom.us/notes'
    });
  });

  // Open Chorus.ai
  openChorusButton.addEventListener('click', () => {
    chrome.tabs.create({
      url: 'https://app.chorus.ai/'
    });
  });

  // Open settings page
  openSettingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Check if we're on a supported page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const statusBadge = document.getElementById('status-badge');

    if (currentTab && currentTab.url) {
      if (currentTab.url.includes('hub.zoom.us/notes')) {
        statusText.textContent = 'On Zoom';
      } else if (currentTab.url.includes('chorus.ai')) {
        statusText.textContent = 'On Chorus.ai';
      } else {
        statusText.textContent = 'Ready';
      }
    }
  });
});
