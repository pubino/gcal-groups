// popup.js
document.addEventListener('DOMContentLoaded', function() {
  const groupsDiv = document.getElementById('groups');
  const groupNameInput = document.getElementById('groupName');
  const addGroupButton = document.getElementById('addGroup');
  const calendarsDiv = document.getElementById('calendars');

  let calendarList = [];
  let activeGroupName = null;
  let groupVisibility = {};

  addGroupButton.addEventListener('click', addGroup);
  getCalendarsFromPage();

  function getCalendarsFromPage() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'getCalendars' }, function(response) {
        if (response && response.calendars) {
          calendarList = response.calendars;
          displayCalendars();
        } else {
          console.error("Failed to retrieve calendars.");
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

      groupDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>${groupName} Group</h3>
          <button class="remove-group" data-group="${groupName}">Remove</button>
        </div>
        <div id="calendars-${groupName}"></div>
      `;
      groupsDiv.appendChild(groupDiv);

      const calendarListDiv = groupDiv.querySelector(`#calendars-${groupName}`);
      groupData.calendars.forEach(calendarName => {
        const calendar = calendarList.find(c => c.name === calendarName);
        if (calendar) {
          const calendarItem = document.createElement('div');
          calendarItem.textContent = calendar.name;
          calendarListDiv.appendChild(calendarItem);
        }
      });

      const removeButton = groupDiv.querySelector('.remove-group');
      removeButton.addEventListener('click', function(event) {
        event.stopPropagation();
        const groupToRemove = this.getAttribute('data-group');
        removeGroup(groupToRemove, groups);
      });

      groupDiv.addEventListener('click', function() {
        activeGroupName = groupName;
        groupVisibility[groupName] = !groupVisibility[groupName];
        
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
