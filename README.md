# Meetio 🎯

**Export Zoom meeting transcripts to markdown with beautiful formatting. One click, all your notes.**

A Chrome/Edge browser extension that exports all your Zoom meeting notes from [hub.zoom.us/notes](https://hub.zoom.us/notes) into well-formatted markdown files with proper metadata and speaker labels.

## ✨ Features

- **Bulk Export**: Export all your Zoom meeting notes in one click
- **Beautiful Formatting**: Clean markdown with metadata headers and speaker timestamps
- **Smart Parsing**: Automatically extracts meeting names, dates, and attendees
- **Zero Configuration**: Just install and click the export button
- **Privacy First**: All processing happens locally in your browser

## 📦 Installation

### From Source (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/meetio.git
   cd meetio
   ```

2. Load the extension in Chrome/Edge:
   - Open `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `meetio` folder

3. Navigate to [hub.zoom.us/notes](https://hub.zoom.us/notes)

4. Click the "📚 Export All Notes" button that appears in the bottom right

## 🚀 Usage

1. Go to your Zoom notes: [hub.zoom.us/notes](https://hub.zoom.us/notes)
2. Wait for the sidebar with your notes list to load
3. Click the **"📚 Export All Notes"** button in the bottom right corner
4. Confirm the export (if you have more than 5 notes)
5. Your markdown files will download automatically!

Each exported file includes:
- Meeting title
- Date
- Attendees (extracted from title)
- Full transcript with speaker names and timestamps

### Example Output

```markdown
## ✧ Metadata
- **Meeting Title:** Team Sync
- **Date:** 2026-06-24
- **Attendees:** Alice, Bob
- **Recording / Source:** Zoom My Notes
- **Language:** English

## ✧ Transcript

**Alice** (11:31:23): Good morning everyone!
**Bob** (11:31:25): Hey Alice, ready for the demo?
**Alice** (11:31:30): Absolutely, let's dive in.
```

## 🛠️ Development

### Project Structure

```
meetio/
├── manifest.json                 # Extension configuration
├── content-scripts/
│   ├── utils.js                 # Utility functions (logging, file download)
│   ├── zoom-scraper-final.js    # Main scraper logic
│   └── injected-ui.css          # Button styles
├── background/
│   ├── service-worker.js        # Background tasks
│   └── notion-api.js            # Notion integration (future)
├── popup/
│   ├── popup.html               # Extension popup UI
│   └── popup.js                 # Popup logic
└── options/
    ├── options.html             # Settings page
    └── options.js               # Settings logic
```

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes

3. Test thoroughly on [hub.zoom.us/notes](https://hub.zoom.us/notes)

4. Commit with a descriptive message:
   ```bash
   git commit -m "feat: add support for different date formats"
   ```

5. Push and create a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## 🐛 Troubleshooting

**Extension button doesn't appear**
- Make sure you're on `hub.zoom.us/notes`
- Refresh the page
- Check the browser console for errors (F12)

**No transcripts exported**
- Verify your notes are visible in the sidebar
- Check that notes contain actual transcript content
- Open the browser console to see detailed logs

**Transcript formatting issues**
- Report an issue with the problematic note title/date format
- Include browser console logs

## 📝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting PRs.

### Quick Start for Contributors

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on real Zoom notes
5. Submit a PR with a clear description

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 👤 Author

**Neus Samir Escruela**
- Email: neus.escruela@harness.io
- GitHub: [@neussie](https://github.com/neussie)

## 🙏 Acknowledgments

Built with ☕ for the Harness.io team and anyone who needs their Zoom notes in a portable format.

---

**Note**: This extension is not affiliated with or endorsed by Zoom Video Communications, Inc.
