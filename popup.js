// popup.js
document.addEventListener('DOMContentLoaded', function() {
  const groupsDiv = document.getElementById('groups');
  const groupNameInput = document.getElementById('groupName');
  const addGroupButton = document.getElementById('addGroup');
  const calendarsDiv = document.getElementById('calendars');
  const refreshButton = document.getElementById('refreshCalendars');
  const cacheStatusDiv = document.getElementById('cacheStatus');
  const calendarsHeader = document.getElementById('calendarsHeader');
  const toggleCalendars = document.getElementById('toggleCalendars');

  let calendarList = [];
  let activeGroupName = null;
  let groupVisibility = {};
  let calendarsCollapsed = true;

  addGroupButton.addEventListener('click', addGroup);
  refreshButton.addEventListener('click', (e) => {
    e.stopPropagation();
    getCalendarsFromPage(true);
  });

  calendarsHeader.addEventListener('click', (e) => {
    if (e.target === refreshButton) return;
    calendarsCollapsed = !calendarsCollapsed;
    calendarsDiv.style.display = calendarsCollapsed ? 'none' : 'grid';
    cacheStatusDiv.style.display = calendarsCollapsed ? 'none' : 'block';
    toggleCalendars.innerHTML = calendarsCollapsed ? '&#9654;' : '&#9660;';
  });

  getCalendarsFromPage(false);

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

  function addGroup() {
    const groupName = groupNameInput.value.trim();

    // Validation
    if (!groupName) {
      alert("Group name is required.");
      return;
    }

    if (groupName.length > 255) {
      alert("Group name must be 255 characters or less.");
      return;
    }

    const selectedCalendars = Array.from(calendarsDiv.querySelectorAll('input[type="checkbox"]:checked'))
      .map(checkbox => checkbox.id);

    chrome.storage.sync.get({ groups: {} }, function(data) {
      const groups = data.groups;
      groups[groupName] = { calendars: selectedCalendars };
      groupVisibility[groupName] = true;
      chrome.storage.sync.set({ groups: groups, groupVisibility: groupVisibility }, function() {
        groupNameInput.value = '';

        // Collapse Available Calendars section
        if (!calendarsCollapsed) {
          calendarsCollapsed = true;
          calendarsDiv.style.display = 'none';
          cacheStatusDiv.style.display = 'none';
          toggleCalendars.innerHTML = '&#9654;';
        }

        loadGroups();
      });
    });
  }

  function loadGroups() {
    chrome.storage.sync.get({ groups: {}, groupVisibility: {} }, function(data) {
      groupVisibility = data.groupVisibility;
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
      groupDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>${groupName} Group</h3>
          <button class="remove-group" data-group="${groupName}">&times;</button>
        </div>
        <div class="group-calendars-header" style="cursor: pointer; font-size: 12px; color: #666;">
          <span class="group-calendars-toggle">&#9654;</span>${calendarCount} calendar${calendarCount !== 1 ? 's' : ''}
        </div>
        <div class="group-calendars-list" style="display: none;"></div>
      `;
      groupsDiv.appendChild(groupDiv);

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

      groupDiv.addEventListener('click', function() {
        groupVisibility[groupName] = !groupVisibility[groupName];

        // Set active group only if it's being activated
        if (groupVisibility[groupName]) {
          activeGroupName = groupName;
        } else if (activeGroupName === groupName) {
          activeGroupName = null;
        }

        // Select/deselect only the calendars in this group
        selectCalendarsForGroup(groupData.calendars);

        chrome.storage.sync.set({ groupVisibility: groupVisibility }, function() {
          displayGroups(groups);
          updateCalendarVisibility(groupData.calendars, groupVisibility[groupName]);
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

  function updateCalendarVisibility(calendarNames, visible) {
    const calendarsToUpdate = calendarNames.map(name => ({ name: name, visible: visible }));
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'setCalendarVisibility', calendars: calendarsToUpdate });
    });
  }

  loadGroups();
});
