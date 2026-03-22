# ShuffleQ

**Focus on one thing at a time.**

ShuffleQ replaces browser tab overload with a focused, one-at-a-time card queue. Instead of dozens of open tabs, you add webpages and tasks to a queue and work through them one by one. Pages render inline, tasks display as readable cards with notes, and YouTube playlists get a dedicated player with progress tracking.

No accounts, no servers, no tracking. A single HTML file that stores everything in your browser's localStorage.

## Features

- **Card queue** — Add webpages, tasks, or study plans. Navigate with arrow keys or swipe.
- **Inline page viewing** — Webpages render in an iframe so you can read without leaving the app. Sites that block iframes get a clean fallback with an "Open in browser" button.
- **YouTube playlists** — Paste a playlist URL and get an embedded player with a collapsible video list and completion tracking.
- **Inbox** — A staging area for quick to-dos and parked items. Drag cards between Inbox and the main queue.
- **Archive** — Done with something? Archive it. Cards are organized by tag and can be restored later.
- **Notes drawer** — Per-card notes that slide out from the left (Shift+N). Annotate while reading or watching.
- **Study plans** — Import structured learning plans as JSON. Track exercise completion with collapsible progress in the sidebar.
- **Pomodoro timer** — 25-minute timer in the header. Click to start/pause, click the display to reset.
- **Search** — Search across all cards, notes, and tags with Cmd+K or `/`.
- **Drag to reorder** — Reorder cards in the sidebar via drag-and-drop (desktop and mobile).
- **Import/Export** — Export your data as JSON, copy to clipboard, or import from a backup with smart merge (deduplicates by card ID, newer wins).
- **Auto-detect titles** — Add a link without a title and ShuffleQ will try to fetch the page title automatically.
- **Mobile friendly** — Fully responsive with touch support for dragging and swiping.

## Getting Started

**Option 1: Just open the file**

Download `index.html` and open it in your browser. That's it.

> Note: YouTube embeds require an HTTP server (YouTube rejects `file://` origins).

**Option 2: Run with a local server**

```bash
npx serve . -l 3000
```

Then open [http://localhost:3000](http://localhost:3000).

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` `→` | Navigate between cards |
| `N` | Add new card |
| `E` | Edit current card |
| `T` | Toggle sidebar |
| `R` | Archive current card |
| `D` | Delete current card |
| `F` | Filter by tag |
| `Shift+N` | Open notes drawer |
| `/` or `Cmd+K` | Search |
| `O` | Open current page in new tab |
| `H` | Toggle header visibility |
| `?` | Show all shortcuts |

## Data Storage

All data lives in your browser's localStorage:

- `stack_cards` — Your card queue
- `stack_inbox` — Inbox items
- `stack_bookmarks` — Archived cards (organized by tag)
- `stack_index` — Current position in the queue

Use Export to back up your data as a JSON file. Use Import to restore or merge from another device.

## License

[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — Free to use, share, and adapt with attribution. No commercial use. Derivatives must use the same license.
