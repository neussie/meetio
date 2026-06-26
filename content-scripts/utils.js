/**
 * Shared utilities for content scripts
 */

// Wait for an element to appear in the DOM
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      return resolve(element);
    }

    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

// Sleep/delay function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate slug from title
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-')  // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

// Format date as YYYY-MM-DD
function formatDate(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Parse various date formats
function parseDate(dateString) {
  // Try standard formats first
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try common Zoom formats
  // "June 23, 2026"
  // "Jun 23, 2026"
  // "6/23/2026"
  // etc.

  // If all else fails, return current date
  console.warn('Could not parse date:', dateString);
  return new Date();
}

// Generate markdown content
function generateMarkdown(data) {
  const { title, date, attendees, transcript, source = 'Zoom My Notes', language = 'English' } = data;

  let md = '## ✧ Metadata\n';
  md += `- **Meeting Title:** ${title}\n`;
  md += `- **Date:** ${date}\n`;

  if (attendees && attendees.length > 0) {
    md += `- **Attendees:** ${attendees.join(', ')}\n`;
  }

  md += `- **Recording / Source:** ${source}\n`;
  md += `- **Language:** ${language}\n\n`;
  md += '## ✧ Transcript\n\n';
  md += transcript;

  return md;
}

// Download a text file
function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Log with timestamp
function log(...args) {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  console.log(`[HarnessExporter ${timestamp}]`, ...args);
}

// Export utilities
window.HarnessExporterUtils = {
  waitForElement,
  sleep,
  slugify,
  formatDate,
  parseDate,
  generateMarkdown,
  downloadFile,
  log
};
