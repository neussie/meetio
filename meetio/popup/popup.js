/**
 * Popup UI Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  const openZoomButton = document.getElementById('open-zoom');
  const openSettingsButton = document.getElementById('open-settings');
  const statusText = document.getElementById('status-text');
  const statusIndicator = document.getElementById('status-indicator');

  // Open Zoom notes page
  openZoomButton.addEventListener('click', () => {
    chrome.tabs.create({
      url: 'https://hub.zoom.us/notes'
    });
  });

  // Open settings page
  openSettingsButton.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Check if we're on Zoom notes page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab && currentTab.url && currentTab.url.includes('hub.zoom.us/notes')) {
      statusIndicator.className = 'status-badge status-ready';
      statusText.textContent = 'On Zoom Notes page';
    }
  });
});
