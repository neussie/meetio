// Chorus Sidebar Diagnostic V3
// STEP 1: Go to Chorus home page
// STEP 2: Click a meeting (sidebar should open on RIGHT)
// STEP 3: Run this script in console

console.log("\n=== CHORUS SIDEBAR DIAGNOSTIC V3 ===\n");

// Check if we're on the right page
console.log("Current URL:", window.location.href);

// 1. Simple search for any button with "copy" in the text
console.log("\n=== SEARCHING FOR 'COPY' BUTTONS ===");
const buttons = document.querySelectorAll('button');
let copyButton = null;

buttons.forEach((btn, i) => {
  try {
    const text = btn.textContent || '';
    if (text.toLowerCase().includes('copy')) {
      console.log(`✓ [${i}] Found: "${text.trim()}"`);
      console.log(`    Visible: ${btn.offsetWidth > 0 && btn.offsetHeight > 0}`);
      console.log(`    Position: ${btn.getBoundingClientRect().left}px from left`);
      copyButton = btn;
    }
  } catch (e) {
    // Skip
  }
});

if (!copyButton) {
  console.log("❌ No 'Copy' button found!");
} else {
  console.log("\n✅ Found Copy button!");
}

// 2. Find the transcript content
console.log("\n=== LOOKING FOR TRANSCRIPT TEXT ===");
console.log("Searching page text for speaker patterns...");

const pageText = document.body.innerText;
const lines = pageText.split('\n');

// Look for timestamp patterns like "0:00" or "Neus Samir Escruela"
const speakerLines = lines.filter(line => {
  const trimmed = line.trim();
  // Match timestamp "0:04" or speaker names (2-3 words, capitalized)
  return trimmed.match(/^\d{1,2}:\d{2}$/) ||
         (trimmed.match(/^[A-Z][a-z]+\s+[A-Z][a-z]+/) && trimmed.length < 50);
});

console.log(`Found ${speakerLines.length} lines that look like speakers/timestamps:`);
speakerLines.slice(0, 10).forEach((line, i) => {
  console.log(`  [${i}] ${line}`);
});

// 3. Find what's visible on the RIGHT side (where sidebar would be)
console.log("\n=== RIGHT SIDE CONTENT ===");
const allDivs = document.querySelectorAll('div');
const rightSideDivs = Array.from(allDivs).filter(div => {
  try {
    const rect = div.getBoundingClientRect();
    // Right side of screen, reasonably sized
    return rect.left > window.innerWidth * 0.5 &&
           rect.width > 300 &&
           rect.height > 400 &&
           div.offsetParent !== null; // Visible
  } catch (e) {
    return false;
  }
});

console.log(`Found ${rightSideDivs.length} large visible divs on right side:`);
rightSideDivs.slice(0, 5).forEach((div, i) => {
  try {
    const classes = div.className || '';
    const text = (div.textContent || '').substring(0, 100);
    console.log(`  [${i}] ${classes.split(' ')[0] || 'no-class'}`);
    console.log(`      Text: ${text.trim()}...`);
  } catch (e) {
    // Skip
  }
});

// 4. Check if "Transcript" tab exists
console.log("\n=== LOOKING FOR 'TRANSCRIPT' TAB ===");
const allText = document.body.textContent;
if (allText.includes('Transcript')) {
  console.log("✓ 'Transcript' text found on page");

  // Find clickable elements with "Transcript"
  const clickables = document.querySelectorAll('button, a, [role="tab"]');
  Array.from(clickables).forEach((el, i) => {
    try {
      const text = el.textContent || '';
      if (text.trim() === 'Transcript' || text.includes('Transcript')) {
        console.log(`  [${i}] ${el.tagName} "${text.trim()}"`);
        console.log(`      class: ${el.className || 'none'}`);
        console.log(`      visible: ${el.offsetWidth > 0}`);
      }
    } catch (e) {
      // Skip
    }
  });
} else {
  console.log("✗ 'Transcript' text NOT found on page");
}

// 5. Test clipboard permission
console.log("\n=== TESTING CLIPBOARD ACCESS ===");
if (navigator.clipboard) {
  console.log("✓ Clipboard API available");

  if (copyButton) {
    console.log("Attempting to click copy button and read clipboard...");
    try {
      copyButton.click();
      setTimeout(async () => {
        try {
          const text = await navigator.clipboard.readText();
          console.log(`✓ Clipboard read successful! Got ${text.length} characters`);
          console.log("First 200 chars:", text.substring(0, 200));
        } catch (e) {
          console.log(`✗ Clipboard read failed: ${e.message}`);
        }
      }, 1000);
    } catch (e) {
      console.log(`✗ Click failed: ${e.message}`);
    }
  }
} else {
  console.log("✗ Clipboard API not available");
}

console.log("\n=== END DIAGNOSTIC V3 ===\n");
console.log("If no Copy button found, try:");
console.log("1. Make sure you clicked a meeting first");
console.log("2. Check if the right sidebar is visible");
console.log("3. Look for the 'Transcript' tab and click it");
