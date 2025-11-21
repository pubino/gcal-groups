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

// Check UI dependencies
function checkUIDependencies() {
  const issues = [];

  // Check for My calendars section
  const myCalendars = document.querySelector('[aria-label="My calendars"]');
  if (!myCalendars) {
    issues.push('Could not find "My calendars" section');
  }

  // Check for Other calendars section
  const otherCalendars = document.querySelector('[aria-label="Other calendars"]');
  if (!otherCalendars) {
    issues.push('Could not find "Other calendars" section');
  }

  // Check for calendar checkboxes
  const checkboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');
  if (checkboxes.length === 0) {
    issues.push('No calendar checkboxes found');
  }

  // Check for scrollable containers (needed for virtualization handling)
  let hasScrollable = false;
  document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 10) {
      hasScrollable = true;
    }
  });
  if (!hasScrollable) {
    issues.push('No scrollable calendar containers found');
  }

  return {
    healthy: issues.length === 0,
    issues: issues
  };
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'checkUI') {
    sendResponse(checkUIDependencies());
    return true;
  }

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
    (async () => {
      // Find main content area to exclude from scrolling
      const mainContent = document.querySelector('[role="main"]');

      // Find all scrollable containers (same as thoroughCalendarScan)
      const scrollables = [];
      document.querySelectorAll('*').forEach(el => {
        if (mainContent && mainContent.contains(el)) return;
        const style = window.getComputedStyle(el);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight + 10) {
          scrollables.push(el);
        }
      });

      // Track which calendars we need to toggle
      const toToggle = new Map(request.calendars.map(c => [c.name, c.visible]));
      const toggled = new Set();

      // Function to toggle visible calendars
      const toggleVisible = () => {
        toToggle.forEach((visible, name) => {
          if (toggled.has(name)) return;
          const input = document.querySelector(`input[type="checkbox"][aria-label="${name}"]`);
          if (input && input.checked !== visible) {
            input.click();
            toggled.add(name);
          } else if (input) {
            toggled.add(name); // Already correct state
          }
        });
      };

      // First pass - toggle what's visible
      toggleVisible();

      // If we got them all, we're done
      if (toggled.size >= toToggle.size) {
        sendResponse({ success: true, toggled: toggled.size });
        return;
      }

      // Scroll through containers to find remaining calendars
      for (const container of scrollables) {
        if (toggled.size >= toToggle.size) break;

        const originalScroll = container.scrollTop;
        const scrollHeight = container.scrollHeight;
        const step = Math.max(50, container.clientHeight * 0.5);

        for (let pos = 0; pos <= scrollHeight; pos += step) {
          container.scrollTop = pos;
          await new Promise(r => setTimeout(r, 100));
          toggleVisible();
          if (toggled.size >= toToggle.size) break;
        }

        container.scrollTop = originalScroll;
      }

      console.log(`Toggled ${toggled.size}/${toToggle.size} calendars`);
      sendResponse({ success: true, toggled: toggled.size });
    })();

    return true; // Keep message channel open for async
  }

  return true;
});
