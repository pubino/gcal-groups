// popup.js
document.addEventListener('DOMContentLoaded', function() {
  const notCalendarError = document.getElementById('notCalendarError');
  const mainContent = document.getElementById('mainContent');

  // Check if we're on Google Calendar first
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (!tabs[0] || !tabs[0].url || !tabs[0].url.includes('calendar.google.com')) {
      notCalendarError.style.display = 'block';
      mainContent.style.display = 'none';
      return;
    }

    // We're on Google Calendar, initialize the extension
    initializeExtension();
  });

  function initializeExtension() {
    const groupsDiv = document.getElementById('groups');
    const groupNameInput = document.getElementById('groupName');
    const addGroupButton = document.getElementById('addGroup');
    const calendarsDiv = document.getElementById('calendars');
    const refreshButton = document.getElementById('refreshCalendars');
    const cacheStatusDiv = document.getElementById('cacheStatus');
    const calendarsHeader = document.getElementById('calendarsHeader');
    const toggleCalendars = document.getElementById('toggleCalendars');
    const calendarControls = document.getElementById('calendarControls');
    const selectAllLink = document.getElementById('selectAll');
    const selectNoneLink = document.getElementById('selectNone');
    const uiWarning = document.getElementById('uiWarning');
    const uiWarningText = document.getElementById('uiWarningText');
    const groupNameError = document.getElementById('groupNameError');

    let calendarList = [];
    let activeGroupName = null;
    let groupVisibility = {};
    let calendarsCollapsed = true;
    let isUpdatingCalendars = false;

    addGroupButton.addEventListener('click', addGroup);
  refreshButton.addEventListener('click', (e) => {
    e.stopPropagation();
    cacheStatusDiv.textContent = 'Refreshing page...';
    cacheStatusDiv.style.display = 'block';
    refreshButton.disabled = true;

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id, {}, function() {
          // Wait for page to reload before scanning
          setTimeout(() => {
            getCalendarsFromPage(true);
          }, 2000);
        });
      }
    });
  });

  calendarsHeader.addEventListener('click', (e) => {
    if (e.target === refreshButton) return;
    calendarsCollapsed = !calendarsCollapsed;
    calendarsDiv.style.display = calendarsCollapsed ? 'none' : 'grid';
    cacheStatusDiv.style.display = calendarsCollapsed ? 'none' : 'block';
    calendarControls.style.display = calendarsCollapsed ? 'none' : 'block';
    toggleCalendars.innerHTML = calendarsCollapsed ? '&#9654;' : '&#9660;';
  });

  selectAllLink.addEventListener('click', (e) => {
    e.preventDefault();
    calendarsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
  });

  selectNoneLink.addEventListener('click', (e) => {
    e.preventDefault();
    calendarsDiv.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  });

  // Check UI dependencies on launch
  checkUIDependencies();
  getCalendarsFromPage(false);

  function checkUIDependencies() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs[0] || !tabs[0].url || !tabs[0].url.includes('calendar.google.com')) {
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action: 'checkUI' }, function(response) {
        if (chrome.runtime.lastError) {
          return;
        }

        if (response && !response.healthy) {
          uiWarning.style.display = 'block';
          uiWarningText.textContent = 'Google Calendar UI may have changed. ' + response.issues.join('. ') + '. Some features may not work correctly.';
        }
      });
    });
  }

  function getCalendarsFromPage(forceRefresh = false) {
    if (forceRefresh) {
      cacheStatusDiv.textContent = 'Scanning calendars...';
      refreshButton.disabled = true;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      if (!tabs[0]) {
        cacheStatusDiv.textContent = 'No active tab found';
        refreshButton.disabled = false;
        return;
      }

      if (!tabs[0].url || !tabs[0].url.includes('calendar.google.com')) {
        cacheStatusDiv.textContent = 'Please open Google Calendar first';
        refreshButton.disabled = false;
        return;
      }

      chrome.tabs.sendMessage(tabs[0].id, { action: 'getCalendars', forceRefresh }, function(response) {
        refreshButton.disabled = false;

        if (chrome.runtime.lastError) {
          console.error("Error:", chrome.runtime.lastError.message);
          cacheStatusDiv.textContent = 'Refresh the Google Calendar page';
          return;
        }

        if (response && response.calendars) {
          calendarList = response.calendars;
          displayCalendars();

          // Show cache status
          if (response.fromCache) {
            const hours = Math.floor(response.cacheAge / (1000 * 60 * 60));
            const mins = Math.floor((response.cacheAge % (1000 * 60 * 60)) / (1000 * 60));
            cacheStatusDiv.textContent = `Cached ${hours}h ${mins}m ago (${calendarList.length} calendars)`;
          } else {
            cacheStatusDiv.textContent = `Fresh scan (${calendarList.length} calendars)`;
          }
        } else {
          console.error("Failed to retrieve calendars:", response);
          cacheStatusDiv.textContent = 'Failed to load calendars';
        }
      });
    });
  }

  function deselectAllCalendars() {
    calendarsDiv.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.checked = false;
    });
  }

  function selectCalendarsForGroup(calendars) {
    deselectAllCalendars();
    calendars.forEach(calendarName => {
      const checkbox = calendarsDiv.querySelector(`input[id="${calendarName}"]`);
      if (checkbox) {
        checkbox.checked = true;
      }
    });
  }

  function displayCalendars() {
    calendarsDiv.innerHTML = '';
    calendarList.forEach(calendar => {
      const calendarDiv = document.createElement('div');
      calendarDiv.classList.add('calendar');
      calendarDiv.innerHTML = `
        <input type="checkbox" id="${calendar.name}" ${calendar.checked ? 'checked' : ''}>
        <label for="${calendar.name}">${calendar.name}</label>
      `;
      calendarsDiv.appendChild(calendarDiv);
    });
  }

  function showGroupNameError(message) {
    groupNameError.textContent = message;
    groupNameError.style.display = 'block';
    groupNameInput.style.borderColor = '#d32f2f';
  }

  function clearGroupNameError() {
    groupNameError.style.display = 'none';
    groupNameInput.style.borderColor = '#ccc';
  }

  // Clear error on input
  groupNameInput.addEventListener('input', clearGroupNameError);

  function addGroup() {
    const groupName = groupNameInput.value.trim();

    // Validation
    if (!groupName) {
      showGroupNameError('Group name is required');
      return;
    }

    if (groupName.length > 30) {
      showGroupNameError('Group name must be 30 characters or less');
      return;
    }

    if (!/^[a-zA-Z0-9\s\-_]+$/.test(groupName)) {
      showGroupNameError('Only letters, numbers, spaces, hyphens, and underscores allowed');
      return;
    }

    const selectedCalendars = Array.from(calendarsDiv.querySelectorAll('input[type="checkbox"]:checked'))
      .map(checkbox => checkbox.id);

    chrome.storage.sync.get({ groups: {} }, function(data) {
      // Check for duplicate name
      if (data.groups[groupName]) {
        showGroupNameError('A group with this name already exists');
        return;
      }

      clearGroupNameError();
      const groups = data.groups;
      groups[groupName] = { calendars: selectedCalendars };

      // Deactivate any currently active group
      if (activeGroupName && groupVisibility[activeGroupName]) {
        groupVisibility[activeGroupName] = false;
      }

      groupVisibility[groupName] = true;
      activeGroupName = groupName; // Set as active group
      chrome.storage.sync.set({ groups: groups, groupVisibility: groupVisibility, activeGroupName: activeGroupName }, function() {
        groupNameInput.value = '';

        // Collapse Available Calendars section
        if (!calendarsCollapsed) {
          calendarsCollapsed = true;
          calendarsDiv.style.display = 'none';
          cacheStatusDiv.style.display = 'none';
          calendarControls.style.display = 'none';
          toggleCalendars.innerHTML = '&#9654;';
        }

        loadGroups();
      });
    });
  }

  function loadGroups() {
    chrome.storage.sync.get({ groups: {}, groupVisibility: {}, activeGroupName: null }, function(data) {
      groupVisibility = data.groupVisibility;
      activeGroupName = data.activeGroupName;
      displayGroups(data.groups);
    });
  }

  function displayGroups(groups = {}) {
    groupsDiv.innerHTML = '';
    
    if (Object.keys(groups).length === 0) {
      const noGroupsMessage = document.createElement('p');
      noGroupsMessage.textContent = 'No groups created yet.';
      groupsDiv.appendChild(noGroupsMessage);
      return;
    }

    Object.entries(groups).forEach(([groupName, groupData]) => {
      const groupDiv = document.createElement('div');
      groupDiv.classList.add('group');
      if (groupName === activeGroupName) {
        groupDiv.classList.add('selected');
      }

      if (groupVisibility[groupName]) {
        groupDiv.classList.add('visible');
      }

      const calendarCount = groupData.calendars.length;
      groupDiv.setAttribute('draggable', 'true');
      groupDiv.setAttribute('data-group', groupName);
      groupDiv.innerHTML = `
        <div class="drag-handle"></div>
        <div class="group-content">
          <button class="remove-group" data-group="${groupName}">&times;</button>
          <h3>${groupName} Group</h3>
          <div class="group-calendars-header" style="cursor: pointer; font-size: 12px; color: #666;">
            <span class="group-calendars-toggle">&#9654;</span>${calendarCount} calendar${calendarCount !== 1 ? 's' : ''}
          </div>
          <div class="group-calendars-list" style="display: none;"></div>
        </div>
      `;
      groupsDiv.appendChild(groupDiv);

      // Drag and drop handlers
      groupDiv.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', groupName);
        groupDiv.classList.add('dragging');
      });

      groupDiv.addEventListener('dragend', () => {
        groupDiv.classList.remove('dragging');
        document.querySelectorAll('.group').forEach(g => g.classList.remove('drag-over'));
      });

      groupDiv.addEventListener('dragover', (e) => {
        e.preventDefault();
        const dragging = document.querySelector('.dragging');
        if (dragging !== groupDiv) {
          groupDiv.classList.add('drag-over');
        }
      });

      groupDiv.addEventListener('dragleave', () => {
        groupDiv.classList.remove('drag-over');
      });

      groupDiv.addEventListener('drop', (e) => {
        e.preventDefault();
        groupDiv.classList.remove('drag-over');
        const draggedGroupName = e.dataTransfer.getData('text/plain');
        if (draggedGroupName !== groupName) {
          reorderGroups(draggedGroupName, groupName, groups);
        }
      });

      const calendarListDiv = groupDiv.querySelector('.group-calendars-list');
      const calendarHeader = groupDiv.querySelector('.group-calendars-header');
      const calendarToggle = groupDiv.querySelector('.group-calendars-toggle');

      groupData.calendars.forEach(calendarName => {
        const calendar = calendarList.find(c => c.name === calendarName);
        if (calendar) {
          const calendarItem = document.createElement('div');
          calendarItem.textContent = calendar.name;
          calendarListDiv.appendChild(calendarItem);
        }
      });

      calendarHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = calendarListDiv.style.display === 'none';
        calendarListDiv.style.display = isHidden ? 'block' : 'none';
        calendarToggle.innerHTML = isHidden ? '&#9660;' : '&#9654;';
      });

      const removeButton = groupDiv.querySelector('.remove-group');
      removeButton.addEventListener('click', function(event) {
        event.stopPropagation();
        const groupToRemove = this.getAttribute('data-group');

        if (this.classList.contains('confirm')) {
          removeGroup(groupToRemove, groups);
        } else {
          this.classList.add('confirm');
          this.textContent = 'Remove';
          // Reset after 3 seconds if not clicked
          setTimeout(() => {
            if (this.classList.contains('confirm')) {
              this.classList.remove('confirm');
              this.innerHTML = '&times;';
            }
          }, 3000);
        }
      });

      groupDiv.addEventListener('click', async function() {
        // Prevent rapid switching
        if (isUpdatingCalendars) {
          return;
        }

        const wasActive = groupVisibility[groupName];

        // Deactivate any other active group first
        if (!wasActive && activeGroupName && activeGroupName !== groupName) {
          groupVisibility[activeGroupName] = false;
        }

        groupVisibility[groupName] = !wasActive;

        // Set active group only if it's being activated
        if (groupVisibility[groupName]) {
          activeGroupName = groupName;
        } else if (activeGroupName === groupName) {
          activeGroupName = null;
        }

        // Select/deselect only the calendars in this group
        selectCalendarsForGroup(groupData.calendars);

        chrome.storage.sync.set({ groupVisibility: groupVisibility, activeGroupName: activeGroupName }, async function() {
          displayGroups(groups);

          isUpdatingCalendars = true;

          if (groupVisibility[groupName]) {
            // Activating: hide all calendars, then show only this group's
            const allCalendarNames = calendarList.map(c => c.name);
            const groupCalendarNames = groupData.calendars;
            const calendarsToHide = allCalendarNames.filter(name => !groupCalendarNames.includes(name));

            // Hide non-group calendars, then show group calendars sequentially
            await updateCalendarVisibilityAsync(calendarsToHide, false);
            await updateCalendarVisibilityAsync(groupData.calendars, true);
          } else {
            // Deactivating: just hide this group's calendars
            await updateCalendarVisibilityAsync(groupData.calendars, false);
          }

          isUpdatingCalendars = false;
        });
      });

      updateCalendarVisibility(groupData.calendars, groupVisibility[groupName]);
    });
  }

  function removeGroup(groupName, groups) {
    chrome.storage.sync.get({ groups: {}, groupVisibility: {} }, function(data) {
      const updatedGroups = data.groups;
      const updatedVisibility = data.groupVisibility;
      delete updatedGroups[groupName];
      delete updatedVisibility[groupName];
      chrome.storage.sync.set({ groups: updatedGroups, groupVisibility: updatedVisibility }, function() {
        displayGroups(updatedGroups);
      });
    });
  }

  function reorderGroups(draggedName, targetName, groups) {
    const entries = Object.entries(groups);
    const draggedIndex = entries.findIndex(([name]) => name === draggedName);
    const targetIndex = entries.findIndex(([name]) => name === targetName);

    if (draggedIndex === -1 || targetIndex === -1) return;

    const [draggedEntry] = entries.splice(draggedIndex, 1);
    entries.splice(targetIndex, 0, draggedEntry);

    const reorderedGroups = Object.fromEntries(entries);
    chrome.storage.sync.set({ groups: reorderedGroups }, function() {
      displayGroups(reorderedGroups);
    });
  }

  function updateCalendarVisibility(calendarNames, visible) {
    const calendarsToUpdate = calendarNames.map(name => ({ name: name, visible: visible }));
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'setCalendarVisibility', calendars: calendarsToUpdate });
    });
  }

  function updateCalendarVisibilityAsync(calendarNames, visible) {
    return new Promise((resolve) => {
      if (calendarNames.length === 0) {
        resolve();
        return;
      }

      const calendarsToUpdate = calendarNames.map(name => ({ name: name, visible: visible }));
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'setCalendarVisibility', calendars: calendarsToUpdate }, function() {
          // Give time for the calendar UI to update
          setTimeout(resolve, 500);
        });
      });
    });
  }

  loadGroups();
  }
});
