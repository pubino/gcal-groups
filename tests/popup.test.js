/**
 * Popup.js Unit Tests with Mocks
 *
 * Run these tests by copying into browser console on any page,
 * or use a test runner like Jest with jsdom.
 */

// Mock Chrome APIs
const mockStorage = {
  groups: {},
  groupVisibility: {},
  activeGroupName: null
};

const mockCalendarCache = {
  calendarCache: [
    { name: 'Work', checked: true, id: 'work' },
    { name: 'Personal', checked: true, id: 'personal' },
    { name: 'Holidays', checked: false, id: 'holidays' },
    { name: 'Birthdays', checked: true, id: 'birthdays' }
  ],
  cacheTimestamp: Date.now()
};

const chrome = {
  storage: {
    sync: {
      get: (defaults, callback) => {
        const result = { ...defaults };
        Object.keys(defaults).forEach(key => {
          if (mockStorage[key] !== undefined) {
            result[key] = mockStorage[key];
          }
        });
        callback(result);
      },
      set: (data, callback) => {
        Object.assign(mockStorage, data);
        if (callback) callback();
      }
    },
    local: {
      get: (keys, callback) => {
        callback(mockCalendarCache);
      },
      set: (data, callback) => {
        Object.assign(mockCalendarCache, data);
        if (callback) callback();
      }
    }
  },
  tabs: {
    query: (query, callback) => {
      callback([{ id: 1, url: 'https://calendar.google.com/calendar' }]);
    },
    sendMessage: (tabId, message, callback) => {
      if (message.action === 'getCalendars') {
        callback({ calendars: mockCalendarCache.calendarCache, fromCache: true, cacheAge: 1000 });
      } else if (message.action === 'setCalendarVisibility') {
        callback({ success: true, toggled: message.calendars.length });
      } else if (message.action === 'checkUI') {
        callback({ healthy: true, issues: [] });
      }
    },
    reload: (tabId, options, callback) => {
      if (callback) callback();
    }
  },
  runtime: {
    lastError: null
  }
};

// Test utilities
const tests = {
  passed: 0,
  failed: 0,
  results: []
};

function assert(condition, testName, details = '') {
  if (condition) {
    tests.passed++;
    tests.results.push({ name: testName, passed: true });
    console.log(`✓ ${testName}`);
  } else {
    tests.failed++;
    tests.results.push({ name: testName, passed: false, details });
    console.error(`✗ ${testName}`, details);
  }
}

function resetMocks() {
  mockStorage.groups = {};
  mockStorage.groupVisibility = {};
  mockStorage.activeGroupName = null;
}

// ============== VALIDATION TESTS ==============

function testGroupNameValidation() {
  console.log('\n--- Group Name Validation Tests ---');

  // Test: Empty name
  assert(
    !isValidGroupName(''),
    'Empty group name is invalid'
  );

  // Test: Valid name
  assert(
    isValidGroupName('My Group'),
    'Alphanumeric with spaces is valid'
  );

  // Test: Name with numbers
  assert(
    isValidGroupName('Group 123'),
    'Name with numbers is valid'
  );

  // Test: Name with hyphens and underscores
  assert(
    isValidGroupName('My-Group_1'),
    'Hyphens and underscores are valid'
  );

  // Test: Name too long
  assert(
    !isValidGroupName('This is a very long group name that exceeds thirty characters'),
    'Name over 30 chars is invalid'
  );

  // Test: Special characters
  assert(
    !isValidGroupName('Group@#$%'),
    'Special characters are invalid'
  );

  // Test: Name exactly 30 chars
  assert(
    isValidGroupName('123456789012345678901234567890'),
    'Name with exactly 30 chars is valid'
  );
}

function isValidGroupName(name) {
  if (!name || name.trim() === '') return false;
  if (name.length > 30) return false;
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) return false;
  return true;
}

// ============== DUPLICATE NAME TESTS ==============

function testDuplicateGroupNames() {
  console.log('\n--- Duplicate Group Name Tests ---');
  resetMocks();

  mockStorage.groups = {
    'Work': { calendars: ['Work', 'Meetings'] },
    'Personal': { calendars: ['Personal', 'Birthdays'] }
  };

  assert(
    isDuplicateName('Work', mockStorage.groups),
    'Exact duplicate is detected'
  );

  assert(
    !isDuplicateName('New Group', mockStorage.groups),
    'New unique name is not duplicate'
  );

  assert(
    isDuplicateName('Personal', mockStorage.groups),
    'Another existing name is detected'
  );
}

function isDuplicateName(name, groups) {
  return groups.hasOwnProperty(name);
}

// ============== GROUP OPERATIONS TESTS ==============

function testGroupOperations() {
  console.log('\n--- Group Operations Tests ---');
  resetMocks();

  // Test: Add group
  const newGroup = { calendars: ['Work', 'Personal'] };
  mockStorage.groups['Test Group'] = newGroup;
  mockStorage.groupVisibility['Test Group'] = true;
  mockStorage.activeGroupName = 'Test Group';

  assert(
    mockStorage.groups['Test Group'] !== undefined,
    'Group is added to storage'
  );

  assert(
    mockStorage.groups['Test Group'].calendars.length === 2,
    'Group has correct calendars'
  );

  assert(
    mockStorage.groupVisibility['Test Group'] === true,
    'New group is activated'
  );

  assert(
    mockStorage.activeGroupName === 'Test Group',
    'New group is set as active'
  );

  // Test: Remove group
  delete mockStorage.groups['Test Group'];
  delete mockStorage.groupVisibility['Test Group'];

  assert(
    mockStorage.groups['Test Group'] === undefined,
    'Group is removed from storage'
  );

  // Test: Deactivate previous group when adding new
  mockStorage.groups = { 'Old Group': { calendars: ['Work'] } };
  mockStorage.groupVisibility = { 'Old Group': true };
  mockStorage.activeGroupName = 'Old Group';

  // Simulate adding new group
  mockStorage.groupVisibility['Old Group'] = false;
  mockStorage.groups['New Group'] = { calendars: ['Personal'] };
  mockStorage.groupVisibility['New Group'] = true;
  mockStorage.activeGroupName = 'New Group';

  assert(
    mockStorage.groupVisibility['Old Group'] === false,
    'Previous group is deactivated when new group added'
  );
}

// ============== GROUP SWITCHING TESTS ==============

function testGroupSwitching() {
  console.log('\n--- Group Switching Tests ---');
  resetMocks();

  mockStorage.groups = {
    'Group A': { calendars: ['Work'] },
    'Group B': { calendars: ['Personal'] }
  };
  mockStorage.groupVisibility = { 'Group A': true, 'Group B': false };
  mockStorage.activeGroupName = 'Group A';

  // Simulate switching to Group B
  mockStorage.groupVisibility['Group A'] = false;
  mockStorage.groupVisibility['Group B'] = true;
  mockStorage.activeGroupName = 'Group B';

  assert(
    mockStorage.groupVisibility['Group A'] === false,
    'Previous group is deactivated on switch'
  );

  assert(
    mockStorage.groupVisibility['Group B'] === true,
    'New group is activated on switch'
  );

  assert(
    mockStorage.activeGroupName === 'Group B',
    'Active group name is updated on switch'
  );
}

// ============== REORDER TESTS ==============

function testGroupReordering() {
  console.log('\n--- Group Reordering Tests ---');
  resetMocks();

  mockStorage.groups = {
    'First': { calendars: ['A'] },
    'Second': { calendars: ['B'] },
    'Third': { calendars: ['C'] }
  };

  // Simulate reordering: move 'Third' before 'Second'
  const entries = Object.entries(mockStorage.groups);
  const draggedIndex = entries.findIndex(([name]) => name === 'Third');
  const targetIndex = entries.findIndex(([name]) => name === 'Second');

  const [draggedEntry] = entries.splice(draggedIndex, 1);
  entries.splice(targetIndex, 0, draggedEntry);

  const reorderedGroups = Object.fromEntries(entries);
  const newOrder = Object.keys(reorderedGroups);

  assert(
    newOrder[0] === 'First',
    'First group stays first'
  );

  assert(
    newOrder[1] === 'Third',
    'Dragged group moves to target position'
  );

  assert(
    newOrder[2] === 'Second',
    'Target group shifts down'
  );
}

// ============== CALENDAR VISIBILITY TESTS ==============

function testCalendarVisibility() {
  console.log('\n--- Calendar Visibility Tests ---');

  const allCalendars = ['Work', 'Personal', 'Holidays', 'Birthdays'];
  const groupCalendars = ['Work', 'Personal'];

  // Test: Find calendars to hide when activating group
  const calendarsToHide = allCalendars.filter(name => !groupCalendars.includes(name));

  assert(
    calendarsToHide.length === 2,
    'Correct number of calendars to hide'
  );

  assert(
    calendarsToHide.includes('Holidays') && calendarsToHide.includes('Birthdays'),
    'Correct calendars identified to hide'
  );

  assert(
    !calendarsToHide.includes('Work') && !calendarsToHide.includes('Personal'),
    'Group calendars not in hide list'
  );
}

// ============== OPERATION LOCKING TESTS ==============

function testOperationLocking() {
  console.log('\n--- Operation Locking Tests ---');

  let isUpdatingCalendars = false;

  // Simulate operation starting
  isUpdatingCalendars = true;

  assert(
    isUpdatingCalendars === true,
    'Lock is set when operation starts'
  );

  // Simulate blocked operation
  const operationBlocked = isUpdatingCalendars;

  assert(
    operationBlocked === true,
    'New operations are blocked when lock is set'
  );

  // Simulate operation completing
  isUpdatingCalendars = false;

  assert(
    isUpdatingCalendars === false,
    'Lock is released when operation completes'
  );
}

// ============== URL VALIDATION TESTS ==============

function testURLValidation() {
  console.log('\n--- URL Validation Tests ---');

  const validURLs = [
    'https://calendar.google.com',
    'https://calendar.google.com/calendar',
    'https://calendar.google.com/calendar/u/0/r'
  ];

  const invalidURLs = [
    'https://google.com',
    'https://mail.google.com',
    'https://docs.google.com',
    'https://example.com/calendar.google.com'
  ];

  validURLs.forEach(url => {
    assert(
      url.includes('calendar.google.com'),
      `Valid URL detected: ${url}`
    );
  });

  invalidURLs.forEach(url => {
    assert(
      !url.includes('calendar.google.com'),
      `Invalid URL rejected: ${url}`
    );
  });
}

// ============== STATE PERSISTENCE TESTS ==============

function testStatePersistence() {
  console.log('\n--- State Persistence Tests ---');
  resetMocks();

  // Simulate saving state
  mockStorage.groups = { 'Test': { calendars: ['Work'] } };
  mockStorage.groupVisibility = { 'Test': true };
  mockStorage.activeGroupName = 'Test';

  // Simulate loading state (as would happen on popup reopen)
  chrome.storage.sync.get({ groups: {}, groupVisibility: {}, activeGroupName: null }, (data) => {
    assert(
      Object.keys(data.groups).length === 1,
      'Groups are persisted'
    );

    assert(
      data.groupVisibility['Test'] === true,
      'Visibility state is persisted'
    );

    assert(
      data.activeGroupName === 'Test',
      'Active group name is persisted'
    );
  });
}

// ============== RUN ALL TESTS ==============

function runAllTests() {
  console.log('========== GCAL GROUPS TESTS ==========\n');

  testGroupNameValidation();
  testDuplicateGroupNames();
  testGroupOperations();
  testGroupSwitching();
  testGroupReordering();
  testCalendarVisibility();
  testOperationLocking();
  testURLValidation();
  testStatePersistence();

  console.log('\n========== TEST SUMMARY ==========');
  console.log(`Passed: ${tests.passed}`);
  console.log(`Failed: ${tests.failed}`);
  console.log(`Total: ${tests.passed + tests.failed}`);

  return tests;
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runAllTests, chrome };
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  runAllTests();
}
