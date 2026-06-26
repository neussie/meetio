# Contributing to Meetio

Thank you for your interest in contributing to Meetio! This document provides guidelines and instructions for contributing.

## 🚀 Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/meetio.git
   cd meetio
   ```
3. **Load the extension** in your browser (see README.md for instructions)
4. **Create a branch** for your work:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## 📋 Development Workflow

### Branch Naming

Use descriptive branch names with prefixes:
- `feature/` - New features (e.g., `feature/notion-integration`)
- `fix/` - Bug fixes (e.g., `fix/date-parsing-error`)
- `docs/` - Documentation updates (e.g., `docs/update-installation`)
- `refactor/` - Code refactoring (e.g., `refactor/cleanup-parser`)
- `test/` - Test additions/fixes (e.g., `test/add-unit-tests`)

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>: <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, no logic change)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

**Examples:**
```bash
git commit -m "feat: add export to CSV option"
git commit -m "fix: handle missing date fields in transcript"
git commit -m "docs: update installation instructions"
```

### Testing Your Changes

Before submitting a PR, test your changes thoroughly:

1. **Load the extension** with your changes in Chrome/Edge
2. **Test on real Zoom notes** at [hub.zoom.us/notes](https://hub.zoom.us/notes)
3. **Check the browser console** (F12) for errors or warnings
4. **Test edge cases**:
   - Notes with unusual date formats
   - Notes with no speakers
   - Notes with special characters in titles
   - Empty notes
   - Very long transcripts

### Code Style

- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Add **JSDoc comments** for functions:
  ```javascript
  /**
   * Extract transcript from the currently displayed note
   * @returns {Promise<Object>} Transcript data with metadata
   */
  async function extractCurrentTranscript() {
    // ...
  }
  ```
- Keep functions **small and focused**
- Use **descriptive variable names**

## 🔄 Pull Request Process

### Before Submitting

- [ ] Test your changes on [hub.zoom.us/notes](https://hub.zoom.us/notes)
- [ ] Check browser console for errors
- [ ] Update documentation if needed
- [ ] Add comments for complex logic
- [ ] Ensure code follows style guidelines

### Creating a Pull Request

1. **Push your branch** to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub with:
   - Clear title describing the change
   - Description explaining what and why
   - Screenshots/recordings if UI changes
   - Steps to test the changes

3. **PR Template**:
   ```markdown
   ## Description
   Brief description of the change

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation update
   - [ ] Refactoring

   ## Testing
   How to test this change:
   1. Step one
   2. Step two
   3. Expected result

   ## Screenshots (if applicable)
   Add screenshots or screen recordings

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Tested on hub.zoom.us/notes
   - [ ] No console errors
   - [ ] Documentation updated
   ```

### Review Process

1. A maintainer will review your PR
2. Address any feedback or requested changes
3. Once approved, your PR will be merged
4. Your contribution will be credited in the release notes

## 🐛 Reporting Bugs

### Before Reporting

1. Check if the issue already exists in GitHub Issues
2. Test with the latest version of the extension
3. Try to reproduce in a fresh browser profile

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Browser Info**
- Browser: [e.g., Chrome 120]
- Extension Version: [e.g., 1.0.0]
- OS: [e.g., macOS 14.0]

**Console Logs**
Paste relevant console output (F12 → Console tab)
```

## 💡 Feature Requests

We welcome feature ideas! Please:
1. Check if the feature is already requested
2. Describe the use case clearly
3. Explain why it would be valuable
4. Consider if it fits the extension's scope

## 📝 Documentation

Documentation improvements are always welcome:
- Fix typos or unclear instructions
- Add examples or clarifications
- Improve code comments
- Add troubleshooting tips

## ⚖️ Code of Conduct

- Be respectful and constructive
- Welcome newcomers and help them learn
- Focus on what is best for the community
- Show empathy towards other contributors

## 🎯 Project Vision

Meetio aims to be:
- **Simple**: One-click export, no configuration
- **Reliable**: Works consistently across Zoom note formats
- **Fast**: Quick export of large note collections
- **Privacy-focused**: All processing happens locally

When contributing, keep these principles in mind.

## 🤝 Questions?

If you have questions:
- Open a GitHub Issue with the "question" label
- Check existing issues and discussions
- Reach out to the maintainer: neus.escruela@harness.io

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Meetio! 🎉
