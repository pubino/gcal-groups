// content.js

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Collect currently visible calendars (quick scan)
function collectVisibleCalendars() {
  const calendars = new Map();
  const allCheckboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');

  allCheckboxes.forEach(input => {
    const label = input.getAttribute('aria-label');
    if (label && !label.includes('Select all') && !label.includes('Deselect')) {
      const listItem = input.closest('li, [data-calendarid], [role="listitem"], [role="treeitem"]');
      if (listItem || input.closest('[aria-label*="calendars"]')) {
        calendars.set(label, {
          name: label,
          checked: input.checked,
          id: input.id || label
        });
      }
    }
  });

  return calendars;
}

// Thorough scan with scrolling
async function thoroughCalendarScan() {
  const calendars = new Map();

  // Find main content area to exclude from scrolling
  const mainContent = document.querySelector('[role="main"]') ||
                      document.querySelector('[data-view-name="day"]')?.closest('div') ||
                      document.querySelector('[aria-label*="Calendar"]');

  // Expand collapsed calendar sections (be specific to avoid search fields)
  document.querySelectorAll('[aria-label="My calendars"], [aria-label="Other calendars"]').forEach(section => {
    const toggle = section.querySelector('[aria-expanded="false"]');
    if (toggle) toggle.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Find ALL scrollable elements except main content
  const allElements = document.querySelectorAll('*');
  const scrollables = [];

  allElements.forEach(el => {
    // Skip if inside main content area
    if (mainContent && mainContent.contains(el)) return;

    const style = window.getComputedStyle(el);
    const isScrollable = (
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      el.scrollHeight > el.clientHeight + 10
    );
    if (isScrollable) {
      scrollables.push(el);
    }
  });

  console.log(`Found ${scrollables.length} scrollable containers (excluding main content)`);

  // Scroll through each container
  for (const container of scrollables) {
    const originalScroll = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;

    if (scrollHeight <= clientHeight) continue;

    const step = Math.max(50, clientHeight * 0.5);
    console.log(`Scrolling container: scrollHeight=${scrollHeight}, step=${step}`);

    // Scroll down incrementally
    for (let pos = 0; pos <= scrollHeight; pos += step) {
      container.scrollTop = pos;
      await new Promise(r => setTimeout(r, 150));

      collectVisibleCalendars().forEach((cal, name) => {
        calendars.set(name, cal);
      });
    }

    // Make sure we hit the very bottom
    container.scrollTop = scrollHeight;
    await new Promise(r => setTimeout(r, 200));
    collectVisibleCalendars().forEach((cal, name) => {
      calendars.set(name, cal);
    });

    // Scroll back up
    for (let pos = scrollHeight; pos >= 0; pos -= step) {
      container.scrollTop = pos;
      await new Promise(r => setTimeout(r, 150));

      collectVisibleCalendars().forEach((cal, name) => {
        calendars.set(name, cal);
      });
    }

    // Back to top
    container.scrollTop = 0;
    await new Promise(r => setTimeout(r, 200));
    collectVisibleCalendars().forEach((cal, name) => {
      calendars.set(name, cal);
    });

    // Restore original position
    container.scrollTop = originalScroll;
  }

  // Final collection
  collectVisibleCalendars().forEach((cal, name) => {
    calendars.set(name, cal);
  });

  console.log(`Total calendars found: ${calendars.size}`);
  return Array.from(calendars.values());
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getCalendars') {
    const forceRefresh = request.forceRefresh || false;

    chrome.storage.local.get(['calendarCache', 'cacheTimestamp'], async (data) => {
      const now = Date.now();
      const cacheAge = now - (data.cacheTimestamp || 0);
      const needsFullScan = forceRefresh || !data.calendarCache || cacheAge > CACHE_DURATION;

      if (needsFullScan) {
        // Do thorough scan
        console.log("Performing thorough calendar scan...");
        const calendars = await thoroughCalendarScan();

        // Save to cache
        chrome.storage.local.set({
          calendarCache: calendars,
          cacheTimestamp: now
        });

        console.log("Cached calendars:", calendars);
        sendResponse({ calendars, fromCache: false, cacheAge: 0 });
      } else {
        // Use cache but update with currently visible calendars
        const cached = new Map(data.calendarCache.map(c => [c.name, c]));
        const visible = collectVisibleCalendars();

        // Update cached entries with current visibility state
        visible.forEach((cal, name) => {
          cached.set(name, cal);
        });

        const result = Array.from(cached.values());

        // Update cache with new visibility states
        chrome.storage.local.set({ calendarCache: result });

        console.log("Using cached calendars (updated visibility):", result);
        sendResponse({ calendars: result, fromCache: true, cacheAge });
      }
    });

    return true; // Keep message channel open for async response

  } else if (request.action === 'setCalendarVisibility') {
    request.calendars.forEach(calendar => {
      const input = document.querySelector(`input[type="checkbox"][aria-label="${calendar.name}"]`);
      if (input && input.checked !== calendar.visible) {
        // Dispatch a real click event to trigger Google Calendar's handlers
        input.click();
      }
    });
    sendResponse({ success: true });
  }

  return true;
});
