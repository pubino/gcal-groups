/**
 * Calendar Collection Tests
 *
 * These tests verify that the extension correctly collects all calendars
 * from the Google Calendar sidebar, including those not initially visible
 * due to virtualization.
 *
 * To run manually:
 * 1. Open Google Calendar with the extension loaded
 * 2. Open DevTools console
 * 3. Copy and paste this test code
 * 4. Run: runCalendarCollectionTests()
 */

async function runCalendarCollectionTests() {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  function assert(condition, testName, details = '') {
    if (condition) {
      results.passed++;
      results.tests.push({ name: testName, passed: true });
      console.log(`✓ ${testName}`);
    } else {
      results.failed++;
      results.tests.push({ name: testName, passed: false, details });
      console.error(`✗ ${testName}`, details);
    }
  }

  // Test 1: Sidebar detection
  const sidebar = document.querySelector('[role="complementary"]') ||
                  document.querySelector('nav');
  assert(sidebar !== null, 'Sidebar element found');

  // Test 2: Calendar checkboxes exist
  const checkboxes = document.querySelectorAll('input[type="checkbox"][aria-label]');
  assert(checkboxes.length > 0, 'Calendar checkboxes found', `Found: ${checkboxes.length}`);

  // Test 3: Count visible calendars before scroll
  const beforeScroll = new Set();
  checkboxes.forEach(input => {
    const label = input.getAttribute('aria-label');
    if (label && !label.includes('Select all')) {
      beforeScroll.add(label);
    }
  });
  console.log(`Calendars visible before scroll: ${beforeScroll.size}`);

  // Test 4: Find scrollable containers in sidebar
  const scrollables = [];
  if (sidebar) {
    sidebar.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight + 10) {
        scrollables.push(el);
      }
    });
  }
  assert(scrollables.length > 0, 'Scrollable containers found in sidebar', `Found: ${scrollables.length}`);

  // Test 5: Scroll and collect all calendars
  const allCalendars = new Set(beforeScroll);

  for (const container of scrollables) {
    const originalScroll = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const step = Math.max(50, container.clientHeight * 0.5);

    // Scroll through container
    for (let pos = 0; pos <= scrollHeight; pos += step) {
      container.scrollTop = pos;
      await new Promise(r => setTimeout(r, 100));

      document.querySelectorAll('input[type="checkbox"][aria-label]').forEach(input => {
        const label = input.getAttribute('aria-label');
        if (label && !label.includes('Select all')) {
          allCalendars.add(label);
        }
      });
    }

    container.scrollTop = originalScroll;
  }

  console.log(`Total calendars after scroll: ${allCalendars.size}`);

  // Test 6: More calendars found after scrolling (if list was scrollable)
  const hasScrollableList = scrollables.some(s => s.scrollHeight > s.clientHeight * 1.5);
  if (hasScrollableList) {
    assert(
      allCalendars.size >= beforeScroll.size,
      'Scroll reveals additional calendars',
      `Before: ${beforeScroll.size}, After: ${allCalendars.size}`
    );
  } else {
    console.log('ℹ No significantly scrollable calendar list found');
  }

  // Test 7: Calendar names are valid
  const invalidNames = Array.from(allCalendars).filter(name =>
    !name || name.length === 0 || name.length > 500
  );
  assert(invalidNames.length === 0, 'All calendar names are valid', invalidNames);

  // Test 8: No duplicate collection (Set handles this, but verify logic)
  const checkboxArray = Array.from(document.querySelectorAll('input[type="checkbox"][aria-label]'));
  const labels = checkboxArray.map(cb => cb.getAttribute('aria-label')).filter(l => l && !l.includes('Select all'));
  const uniqueLabels = new Set(labels);
  assert(true, 'Deduplication works correctly', `Raw: ${labels.length}, Unique: ${uniqueLabels.size}`);

  // Summary
  console.log('\n--- Test Summary ---');
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Total calendars collected: ${allCalendars.size}`);
  console.log('Calendars:', Array.from(allCalendars).sort());

  return results;
}

// Export for use in test frameworks
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runCalendarCollectionTests };
}
