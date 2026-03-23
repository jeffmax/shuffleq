#!/usr/bin/env node
/**
 * ShuffleQ — End-to-end test suite
 * Run: node test-e2e.mjs
 * Requires: playwright (npm install)
 */
import { chromium } from 'playwright';

const URL = `file://${process.cwd()}/index.html`;
let browser, page;
let passed = 0, failed = 0;
const failures = [];

function log(msg) { console.log(msg); }

async function assert(name, condition) {
  if (condition) {
    log(`  ✓ ${name}`);
    passed++;
  } else {
    log(`  ✗ ${name}`);
    failed++;
    failures.push(name);
  }
}

async function resetApp(seedData) {
  await page.evaluate((data) => {
    localStorage.clear();
    // Set schema version so migration doesn't overwrite seeded data
    localStorage.setItem('stack_schema_version', '3');
    if (data) {
      for (const [key, val] of Object.entries(data)) {
        localStorage.setItem(key, JSON.stringify(val));
      }
    }
  }, seedData || null);
  await page.reload();
  await page.waitForTimeout(400);
}

function makeCard(overrides = {}) {
  return {
    id: 'c' + Math.random().toString(36).slice(2, 8),
    type: 'task',
    title: 'Test Card',
    url: '',
    tags: [],
    notes: '',
    created: Date.now(),
    modified: Date.now(),
    ...overrides,
  };
}

// ─── TEST SUITES ───

async function testEmptyState() {
  log('\n═══ Empty State ═══');
  await resetApp();

  const emptyMsg = await page.$eval('.empty-state p', el => el.textContent);
  await assert('Shows empty message', emptyMsg.includes('empty'));

  const addBtn = await page.$('.empty-state .btn-primary');
  await assert('Shows add first card button', addBtn !== null);
}

async function testAddTaskCard() {
  log('\n═══ Add Task Card ═══');
  await resetApp();

  await page.click('#addBtn');
  await page.waitForTimeout(200);

  const modalOpen = await page.$eval('#modalOverlay', el => el.classList.contains('open'));
  await assert('Modal opens', modalOpen);

  await page.selectOption('#cardType', 'task');
  await page.fill('#cardTitleInput', 'My Test Task');
  await page.fill('#cardNotesInput', 'Some test notes');
  await page.fill('#cardTagsInput', '#test #demo');
  await page.click('#modalSave');
  await page.waitForTimeout(300);

  const modalClosed = await page.$eval('#modalOverlay', el => !el.classList.contains('open'));
  await assert('Modal closes after save', modalClosed);

  const title = await page.$eval('.card-title', el => el.textContent);
  await assert('Card title displayed', title === 'My Test Task');

  const notes = await page.$eval('.card-notes', el => el.textContent);
  await assert('Card notes displayed', notes === 'Some test notes');

  const tags = await page.$$eval('.card-tags .tag', els => els.map(e => e.textContent));
  await assert('Tags displayed', tags.includes('#test') && tags.includes('#demo'));

  const counter = await page.$eval('#counter', el => el.textContent);
  await assert('Counter shows 1/1', counter.trim() === '1 / 1');
}

async function testAddLinkCard() {
  log('\n═══ Add Link Card ═══');
  await resetApp();

  await page.click('#addBtn');
  await page.waitForTimeout(200);
  await page.selectOption('#cardType', 'link');
  await page.fill('#cardUrlInput', 'https://example.com');
  await page.fill('#cardTitleInput', 'Example Site');
  await page.click('#modalSave');
  await page.waitForTimeout(300);

  const cards = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_cards')));
  await assert('Link card saved', cards.length === 1);
  await assert('URL preserved', cards[0].url === 'https://example.com');
  await assert('Type is link', cards[0].type === 'link');
}

async function testNavigation() {
  log('\n═══ Navigation ═══');
  const cards = [
    makeCard({ id: 'n1', title: 'Card One' }),
    makeCard({ id: 'n2', title: 'Card Two' }),
    makeCard({ id: 'n3', title: 'Card Three' }),
  ];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  let title = await page.$eval('.card-title', el => el.textContent);
  await assert('Starts on first card', title === 'Card One');

  // Navigate forward with arrow key
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  title = await page.$eval('.card-title', el => el.textContent);
  await assert('Arrow right goes to Card Two', title === 'Card Two');

  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  title = await page.$eval('.card-title', el => el.textContent);
  await assert('Arrow right goes to Card Three', title === 'Card Three');

  // Should not go past last card
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(200);
  title = await page.$eval('.card-title', el => el.textContent);
  await assert('Stays on last card', title === 'Card Three');

  // Navigate backward
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(200);
  title = await page.$eval('.card-title', el => el.textContent);
  await assert('Arrow left goes back to Card Two', title === 'Card Two');

  const counter = await page.$eval('#counter', el => el.textContent);
  await assert('Counter shows 2/3', counter.trim() === '2 / 3');
}

async function testEditCard() {
  log('\n═══ Edit Card ═══');
  const cards = [makeCard({ id: 'e1', title: 'Original Title', notes: 'Original notes' })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  await page.keyboard.press('e');
  await page.waitForTimeout(300);

  const modalOpen = await page.$eval('#modalOverlay', el => el.classList.contains('open'));
  await assert('Edit modal opens with E key', modalOpen);

  await page.fill('#cardTitleInput', 'Updated Title');
  await page.click('#modalSave');
  await page.waitForTimeout(300);

  const title = await page.$eval('.card-title', el => el.textContent);
  await assert('Title updated', title === 'Updated Title');
}

async function testEditPreservesUrl() {
  log('\n═══ Edit Preserves URL (converted task) ═══');
  const cards = [makeCard({
    id: 'eu1', title: 'Converted Page', type: 'task',
    url: 'https://example.com/article', notes: 'Was a link'
  })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  // Verify URL button is shown
  const linkBtn = await page.$('a[href="https://example.com/article"]');
  await assert('Open in new tab link shown', linkBtn !== null);

  // Edit the title
  await page.keyboard.press('e');
  await page.waitForTimeout(300);
  await page.fill('#cardTitleInput', 'Renamed Page');
  await page.click('#modalSave');
  await page.waitForTimeout(300);

  const cards2 = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_cards')));
  await assert('URL preserved after edit', cards2[0].url === 'https://example.com/article');
  await assert('Title updated', cards2[0].title === 'Renamed Page');
}

async function testArchiveAndRestore() {
  log('\n═══ Archive & Restore ═══');
  const cards = [
    makeCard({ id: 'a1', title: 'To Archive', tags: ['#test'] }),
    makeCard({ id: 'a2', title: 'Keep This' }),
  ];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  // Archive first card
  await page.keyboard.press('r');
  await page.waitForTimeout(300);

  const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_cards')));
  await assert('Card removed from stack', remaining.length === 1);
  await assert('Correct card remains', remaining[0].title === 'Keep This');

  const archive = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_bookmarks')));
  await assert('Card added to archive', Object.keys(archive).length > 0);

  // Open archive sidebar
  await page.keyboard.press('b');
  await page.waitForTimeout(300);

  const sidebarOpen = await page.$eval('.sidebar', el => el.classList.contains('open'));
  await assert('Archive sidebar opens', sidebarOpen);

  // Find and restore the card
  const restoreBtn = await page.$('.bm-restore-btn');
  await assert('Restore button exists', restoreBtn !== null);
  if (restoreBtn) {
    await restoreBtn.click();
    await page.waitForTimeout(300);
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_cards')));
    await assert('Card restored to stack', restored.length === 2);
  }
}

async function testDeleteCard() {
  log('\n═══ Delete Card ═══');
  const cards = [
    makeCard({ id: 'd1', title: 'Delete Me' }),
    makeCard({ id: 'd2', title: 'Keep Me' }),
  ];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  page.once('dialog', dialog => dialog.accept());
  await page.keyboard.press('d');
  await page.waitForTimeout(300);

  const remaining = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_cards')));
  await assert('Card deleted', remaining.length === 1);
  await assert('Correct card remains', remaining[0].title === 'Keep Me');
}

async function testInbox() {
  log('\n═══ Inbox ═══');
  const inboxItems = [
    makeCard({ id: 'i1', title: 'Inbox Item 1' }),
    makeCard({ id: 'i2', title: 'Inbox Item 2' }),
  ];
  await resetApp({ stack_cards: [], stack_inbox: inboxItems });

  // Open sidebar
  await page.keyboard.press('t');
  await page.waitForTimeout(300);

  const panelContent = await page.$eval('#panelTodos', el => el.textContent);
  await assert('Inbox section visible', panelContent.includes('Inbox'));
  await assert('Inbox items shown', panelContent.includes('Inbox Item 1'));

  // Promote item to stack — the arrow button in inbox section
  const promoteBtn = await page.$('.todo-actions .todo-action-btn[title="Move to stack"]');
  if (promoteBtn) {
    await promoteBtn.click();
    await page.waitForTimeout(300);
    const stack = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_cards')));
    const inbox = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_inbox')));
    await assert('Item promoted to stack', stack.length === 1);
    await assert('Item removed from inbox', inbox.length === 1);
  } else {
    await assert('Promote button exists', false);
  }
}

async function testStudyPlan() {
  log('\n═══ Study Plan Import ═══');
  await resetApp();

  await page.click('#addBtn');
  await page.waitForTimeout(200);
  await page.selectOption('#cardType', 'studyplan');
  await page.waitForTimeout(200);

  await page.fill('#studyPlanJsonInput', JSON.stringify({
    plan: {
      title: "Test Study Plan",
      description: "A description",
      exercises: [
        { id: "ex1", phase: "Phase 1", title: "Exercise One", description: "First", time_estimate: "30 min" },
        { id: "ex2", phase: "Phase 2", title: "Exercise Two", description: "Second", time_estimate: "45 min" },
      ]
    }
  }));
  await page.click('#modalSave');
  await page.waitForTimeout(500);

  const cards = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_cards')));
  await assert('Study plan card created', cards.length === 1);
  await assert('Card has studyPlan flag', cards[0].studyPlan === true);
  await assert('Exercises stored', cards[0].exercises.length === 2);

  const title = await page.$eval('.card-title', el => el.textContent);
  await assert('Study plan title displayed', title === 'Test Study Plan');

  const badge = await page.$eval('.card-type-badge', el => el.textContent);
  await assert('Badge shows Study Plan', badge.includes('Study Plan'));
}

async function testStudyPlanWithObjectLinks() {
  log('\n═══ Study Plan With Object Links ═══');
  await resetApp();

  await page.click('#addBtn');
  await page.waitForTimeout(200);
  await page.selectOption('#cardType', 'studyplan');
  await page.waitForTimeout(200);

  // Links as objects (Claude often generates this format)
  await page.fill('#studyPlanJsonInput', JSON.stringify({
    plan: {
      title: "Plan With Links",
      description: "Test object links",
      exercises: [
        {
          id: "ex1", phase: "Phase 1", title: "Exercise",
          description: "Has links", time_estimate: "30 min",
          links: [
            { url: "https://example.com", title: "Example" },
            "https://plain-string.com"
          ]
        },
      ]
    }
  }));
  await page.click('#modalSave');
  await page.waitForTimeout(500);

  const hasError = await page.evaluate(() => {
    // Check no JS errors by verifying the card rendered
    return document.querySelector('.card-title')?.textContent === 'Plan With Links';
  });
  await assert('Study plan with object links renders without error', hasError);

  const links = await page.$$eval('.sp-exercise a', els => els.map(e => e.href));
  await assert('Both links rendered', links.length === 2);
}

async function testStudyPlanWhileCardVisible() {
  log('\n═══ Study Plan While Card Visible ═══');
  const cards = [makeCard({ id: 'sp1', title: 'Existing Card' })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  // Confirm existing card is showing
  let title = await page.$eval('.card-title', el => el.textContent);
  await assert('Existing card shown first', title === 'Existing Card');

  // Add study plan
  await page.click('#addBtn');
  await page.waitForTimeout(200);
  await page.selectOption('#cardType', 'studyplan');
  await page.waitForTimeout(200);
  await page.fill('#studyPlanJsonInput', JSON.stringify({
    plan: {
      title: "New Plan",
      description: "Added on top of existing",
      exercises: [{ id: "ex1", phase: "1", title: "Ex", description: "Do it", time_estimate: "10 min" }]
    }
  }));
  await page.click('#modalSave');
  await page.waitForTimeout(500);

  title = await page.$eval('.card-title', el => el.textContent);
  await assert('Study plan displayed after add', title === 'New Plan');

  const counter = await page.$eval('#counter', el => el.textContent);
  await assert('Counter shows 2/2', counter.trim() === '2 / 2');
}

async function testStudyPlanWhileLinkVisible() {
  log('\n═══ Study Plan While Link Card Visible ═══');
  const cards = [makeCard({ id: 'spl1', type: 'link', title: 'A Website', url: 'https://example.com' })];
  await resetApp({ stack_cards: cards, stack_index: 0 });
  await page.waitForTimeout(1000); // let iframe attempt

  await page.click('#addBtn');
  await page.waitForTimeout(200);
  await page.selectOption('#cardType', 'studyplan');
  await page.waitForTimeout(200);
  await page.fill('#studyPlanJsonInput', JSON.stringify({
    plan: {
      title: "Plan Over Link",
      description: "Test",
      exercises: [{ id: "ex1", phase: "1", title: "Ex", description: "Do", time_estimate: "5 min" }]
    }
  }));
  await page.click('#modalSave');
  await page.waitForTimeout(500);

  const title = await page.$eval('.card-title', el => el.textContent);
  await assert('Study plan replaces link view', title === 'Plan Over Link');
}

async function testSearch() {
  log('\n═══ Search ═══');
  const cards = [
    makeCard({ id: 's1', title: 'Learn JavaScript', notes: 'Study closures and promises', tags: ['#coding'] }),
    makeCard({ id: 's2', title: 'Buy Groceries', notes: 'Milk, eggs, bread', tags: ['#personal'] }),
    makeCard({ id: 's3', title: 'Review PR', notes: 'Check the JavaScript refactor', tags: ['#work'] }),
  ];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  // Open search
  await page.evaluate(() => toggleSearch());
  await page.waitForTimeout(200);

  const searchOpen = await page.$eval('#searchOverlay', el => el.classList.contains('open'));
  await assert('Search modal opens', searchOpen);

  // Search by title
  await page.fill('#searchInput', 'JavaScript');
  await page.dispatchEvent('#searchInput', 'input');
  await page.waitForTimeout(200);

  const results = await page.$$('.search-result');
  await assert('Finds 2 results for JavaScript', results.length === 2);

  // Search by tag
  await page.fill('#searchInput', '#work');
  await page.dispatchEvent('#searchInput', 'input');
  await page.waitForTimeout(200);

  const tagResults = await page.$$('.search-result');
  await assert('Finds 1 result for #work tag', tagResults.length === 1);

  // Search with no matches
  await page.fill('#searchInput', 'xyznonexistent');
  await page.dispatchEvent('#searchInput', 'input');
  await page.waitForTimeout(200);

  const noResults = await page.$('.search-empty');
  await assert('Shows no results message', noResults !== null);

  // Close search
  await page.evaluate(() => toggleSearch());
  await page.waitForTimeout(200);
  const searchClosed = await page.$eval('#searchOverlay', el => !el.classList.contains('open'));
  await assert('Search modal closes', searchClosed);
}

async function testNotesDrawer() {
  log('\n═══ Notes Drawer ═══');
  const cards = [makeCard({ id: 'nd1', title: 'Notes Test', notes: 'Initial notes' })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  // Open notes via toggleNotes (Shift+N races with textarea focus)
  await page.evaluate(() => toggleNotes());
  await page.waitForTimeout(400);

  const drawerOpen = await page.$eval('#notesDrawer', el => el.classList.contains('open'));
  await assert('Notes drawer opens', drawerOpen);

  const notesContent = await page.$eval('#notesEditor', el => el.value);
  await assert('Notes content loaded', notesContent === 'Initial notes');

  // Edit notes
  await page.fill('#notesEditor', 'Updated notes content');
  await page.waitForTimeout(600); // debounce

  // Close and verify persistence
  await page.click('#closeNotes');
  await page.waitForTimeout(200);

  const drawerClosed = await page.$eval('#notesDrawer', el => !el.classList.contains('open'));
  await assert('Notes drawer closes', drawerClosed);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_cards'))[0].notes);
  await assert('Notes saved to localStorage', saved === 'Updated notes content');
}

async function testPomodoro() {
  log('\n═══ Pomodoro Timer ═══');
  const cards = [makeCard({ id: 'p1', title: 'Timer Test' })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  const display = await page.$eval('#pomoDisplay', el => el.textContent);
  await assert('Timer starts at 25:00', display === '25:00');

  // Start timer
  await page.click('#pomoStartBtn');
  await page.waitForTimeout(1500);

  const running = await page.$eval('#pomoDisplay', el => el.classList.contains('running'));
  await assert('Timer is running', running);

  const updated = await page.$eval('#pomoDisplay', el => el.textContent);
  await assert('Timer has ticked down', updated !== '25:00');

  // Pause timer
  await page.click('#pomoStartBtn');
  await page.waitForTimeout(200);
  const afterPause = await page.$eval('#pomoDisplay', el => el.textContent);
  await page.waitForTimeout(1200);
  const afterWait = await page.$eval('#pomoDisplay', el => el.textContent);
  await assert('Timer paused', afterPause === afterWait);

  // Reset timer
  await page.click('#pomoDisplay');
  await page.waitForTimeout(200);
  const reset = await page.$eval('#pomoDisplay', el => el.textContent);
  await assert('Timer reset to 25:00', reset === '25:00');
}

async function testHeaderDrawerToggle() {
  log('\n═══ Header Drawer Toggle ═══');
  const cards = [makeCard({ id: 'h1', title: 'Header Test' })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  const visibleBefore = await page.evaluate(() => !document.body.classList.contains('header-hidden'));
  await assert('Header visible initially', visibleBefore);

  await page.click('#headerHandle');
  await page.waitForTimeout(400);
  const hiddenAfter = await page.evaluate(() => document.body.classList.contains('header-hidden'));
  await assert('Header hidden after click', hiddenAfter);

  await page.click('#headerHandle');
  await page.waitForTimeout(400);
  const visibleAgain = await page.evaluate(() => !document.body.classList.contains('header-hidden'));
  await assert('Header visible after second click', visibleAgain);
}

async function testSidebarTabs() {
  log('\n═══ Sidebar Tabs ═══');
  const cards = [makeCard({ id: 'st1', title: 'Sidebar Test', tags: ['#work'] })];
  const inboxItems = [makeCard({ id: 'st2', title: 'Inbox Task' })];
  await resetApp({ stack_cards: cards, stack_inbox: inboxItems });

  // Open sidebar
  await page.keyboard.press('t');
  await page.waitForTimeout(300);

  const sidebarOpen = await page.$eval('.sidebar', el => el.classList.contains('open'));
  await assert('Sidebar opens', sidebarOpen);

  // Check stack tab content
  const stackContent = await page.$eval('#panelTodos', el => el.textContent);
  await assert('Stack tab shows card', stackContent.includes('Sidebar Test'));
  await assert('Inbox section visible', stackContent.includes('Inbox'));

  // Switch to archive tab
  await page.click('[data-panel="archive"]');
  await page.waitForTimeout(200);
  const archivePanel = await page.$eval('#panelArchive', el => el.style.display !== 'none');
  await assert('Archive tab switches', archivePanel);

  // Close sidebar
  await page.click('#closeSidebar');
  await page.waitForTimeout(300);
  const sidebarClosed = await page.$eval('.sidebar', el => !el.classList.contains('open'));
  await assert('Sidebar closes', sidebarClosed);
}

async function testTagFilter() {
  log('\n═══ Tag Filter ═══');
  const cards = [
    makeCard({ id: 'f1', title: 'Work Task', tags: ['#work'] }),
    makeCard({ id: 'f2', title: 'Personal Task', tags: ['#personal'] }),
    makeCard({ id: 'f3', title: 'Another Work', tags: ['#work'] }),
  ];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  // Click tag to filter
  await page.click('.tag');
  await page.waitForTimeout(300);

  const counter = await page.$eval('#counter', el => el.textContent);
  await assert('Filter shows 2 work cards', counter.trim() === '1 / 2');

  const filterBar = await page.$('#stackFilterBar');
  const filterVisible = await page.$eval('#stackFilterBar', el => el.style.display !== 'none');
  await assert('Filter bar visible', filterVisible);

  // Clear filter
  await page.evaluate(() => clearStackFilter());
  await page.waitForTimeout(200);

  const fullCounter = await page.$eval('#counter', el => el.textContent);
  await assert('All cards after clearing filter', fullCounter.trim().endsWith('/ 3'));
}

async function testExportImport() {
  log('\n═══ Export/Import ═══');
  const cards = [makeCard({ id: 'ei1', title: 'Export Test', tags: ['#test'] })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  // Export data
  const exported = await page.evaluate(() => {
    const data = {
      version: 1,
      stack_cards: JSON.parse(localStorage.getItem('stack_cards')),
      stack_inbox: JSON.parse(localStorage.getItem('stack_inbox') || '[]'),
      stack_bookmarks: JSON.parse(localStorage.getItem('stack_bookmarks') || '{}'),
      stack_index: parseInt(localStorage.getItem('stack_index') || '0'),
    };
    return data;
  });
  await assert('Export contains cards', exported.stack_cards.length === 1);
  await assert('Export has correct title', exported.stack_cards[0].title === 'Export Test');
}

async function testHelpModal() {
  log('\n═══ Help Modal ═══');
  const cards = [makeCard({ id: 'hm1', title: 'Help Test' })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  await page.keyboard.press('?');
  await page.waitForTimeout(200);

  const helpOpen = await page.$eval('#helpOverlay', el => el.classList.contains('open'));
  await assert('Help modal opens with ?', helpOpen);

  const helpContent = await page.$eval('#helpOverlay', el => el.textContent);
  await assert('Help shows keyboard shortcuts', helpContent.includes('Previous') && helpContent.includes('Shift'));

  await page.keyboard.press('?');
  await page.waitForTimeout(200);
  const helpClosed = await page.$eval('#helpOverlay', el => !el.classList.contains('open'));
  await assert('Help modal closes', helpClosed);
}

async function testCardCentering() {
  log('\n═══ Card Centering ═══');
  const cards = [makeCard({ id: 'cc1', title: 'Centering Test', notes: 'Short note' })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  const cardEl = await page.$('.card-container');
  const cardBox = await cardEl.boundingBox();
  const viewport = page.viewportSize();

  const cardCenterX = cardBox.x + cardBox.width / 2;
  const viewportCenterX = viewport.width / 2;
  const xOffset = Math.abs(cardCenterX - viewportCenterX);

  await assert('Card horizontally centered (within 30px)', xOffset <= 30);
}

async function testMobileLayout() {
  log('\n═══ Mobile Layout ═══');
  await page.setViewportSize({ width: 390, height: 844 });

  const cards = [makeCard({ id: 'ml1', title: 'Mobile Test', notes: 'Test notes' })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  // Title should be hidden
  const titleHidden = await page.$eval('.header-left h1', el => {
    return window.getComputedStyle(el).display === 'none';
  });
  await assert('Title hidden on mobile', titleHidden);

  // Card actions should be visible on mobile
  const mobileActions = await page.$('.mobile-only');
  const actionsVisible = await page.$eval('.mobile-only', el => {
    return window.getComputedStyle(el).display !== 'none';
  });
  await assert('Mobile card actions visible', actionsVisible);

  // Sidebar should be full width
  await page.keyboard.press('t');
  await page.waitForTimeout(300);

  const sidebarWidth = await page.$eval('.sidebar', el => el.getBoundingClientRect().width);
  await assert('Sidebar is full width on mobile', sidebarWidth >= 380);

  await page.click('#closeSidebar');
  await page.waitForTimeout(200);

  // Reset viewport
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(200);
}

async function testConvertToTask() {
  log('\n═══ Convert Link to Task ═══');
  const cards = [makeCard({
    id: 'ct1', type: 'link', title: 'Example', url: 'https://example.com'
  })];
  await resetApp({ stack_cards: cards, stack_index: 0 });
  await page.waitForTimeout(1000); // let iframe attempt

  // Call convertToTask directly
  await page.evaluate(() => convertToTask());
  await page.waitForTimeout(300);

  const card = await page.evaluate(() => JSON.parse(localStorage.getItem('stack_cards'))[0]);
  await assert('Type changed to task', card.type === 'task');
  await assert('URL preserved on convert', card.url === 'https://example.com');

  const linkBtn = await page.$('a[href="https://example.com"]');
  await assert('Open in new tab button shown', linkBtn !== null);
}

async function testMultipleCardDots() {
  log('\n═══ Navigation Dots ═══');
  const cards = Array.from({ length: 5 }, (_, i) =>
    makeCard({ id: `dot${i}`, title: `Card ${i + 1}` })
  );
  await resetApp({ stack_cards: cards, stack_index: 0 });

  const dots = await page.$$('.dot');
  await assert('5 dots rendered', dots.length === 5);

  const activeDots = await page.$$('.dot.active');
  await assert('1 active dot', activeDots.length === 1);

  // Click third dot
  await dots[2].click();
  await page.waitForTimeout(200);
  const title = await page.$eval('.card-title', el => el.textContent);
  await assert('Clicking dot navigates', title === 'Card 3');
}

async function testLocalStoragePersistence() {
  log('\n═══ LocalStorage Persistence ═══');
  const cards = [makeCard({ id: 'ls1', title: 'Persist Test' })];
  await resetApp({ stack_cards: cards, stack_index: 0 });

  // Reload and check
  await page.reload();
  await page.waitForTimeout(400);

  const title = await page.$eval('.card-title', el => el.textContent);
  await assert('Card persists after reload', title === 'Persist Test');
}

// ─── RUN ALL TESTS ───

async function run() {
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('pageerror', err => {
    console.log('  ⚠ PAGE ERROR:', err.message);
  });

  await page.goto(URL);
  await page.waitForTimeout(500);

  await testEmptyState();
  await testAddTaskCard();
  await testAddLinkCard();
  await testNavigation();
  await testEditCard();
  await testEditPreservesUrl();
  await testArchiveAndRestore();
  await testDeleteCard();
  await testInbox();
  await testStudyPlan();
  await testStudyPlanWithObjectLinks();
  await testStudyPlanWhileCardVisible();
  await testStudyPlanWhileLinkVisible();
  await testSearch();
  await testNotesDrawer();
  await testPomodoro();
  await testHeaderDrawerToggle();
  await testSidebarTabs();
  await testTagFilter();
  await testExportImport();
  await testHelpModal();
  await testCardCentering();
  await testMobileLayout();
  await testConvertToTask();
  await testMultipleCardDots();
  await testLocalStoragePersistence();

  await browser.close();

  log(`\n${'═'.repeat(40)}`);
  log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    log(`\nFailures:`);
    failures.forEach(f => log(`  ✗ ${f}`));
  }
  log('═'.repeat(40));

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
