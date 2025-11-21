# gcal-groups
Chrome-compatible extension for hiding and showing groups of Google calendars.

## Testing

### Calendar Collection Test

To verify that all calendars are being collected correctly (including those hidden by virtualization):

1. Load the extension in Chrome (`chrome://extensions` → Load unpacked)
2. Open [Google Calendar](https://calendar.google.com)
3. Open DevTools (F12 or Cmd+Option+I)
4. Go to the Console tab
5. Copy the contents of `tests/calendar-collection.test.js` and paste into the console
6. Run: `runCalendarCollectionTests()`

The test will:
- Verify the sidebar is found
- Count calendars before and after scrolling
- Report the total number of calendars collected
- List all calendar names found

Expected output shows passed/failed tests and total calendar count. If scrolling reveals additional calendars beyond the initially visible ones, the test confirms the scroll-based collection is working.

### Unit Tests

To run the popup functionality tests with mocks:

1. Open any webpage in Chrome
2. Open DevTools (F12 or Cmd+Option+I)
3. Go to the Console tab
4. Copy the contents of `tests/popup.test.js` and paste into the console
5. Tests will auto-run and display results

The tests cover:
- Group name validation (length, characters, duplicates)
- Group operations (add, remove, activate, deactivate)
- Group switching behavior
- Group reordering
- Calendar visibility logic
- Operation locking mechanism
- URL validation
- State persistence
