// content.js
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getCalendars') {
    const calendars = [];
    const calendarSections = document.querySelectorAll('div[aria-label="My calendars"], div[aria-label="Other calendars"]');

    calendarSections.forEach(section => {
      section.querySelectorAll('input[type="checkbox"][aria-label]').forEach(input => {
        const summary = input.getAttribute('aria-label');
        if (summary) {
          calendars.push({ name: summary, checked: input.checked });
        } else {
          console.log("Missing summary for input:", input);
        }
      });
    });

    console.log("Discovered Calendars (content.js):", calendars);
    sendResponse({ calendars: calendars });
  } else if (request.action === 'setCalendarVisibility') {
    request.calendars.forEach(calendar => {
      const input = document.querySelector(`input[type="checkbox"][aria-label="${calendar.name}"]`);
      if (input) {
        input.checked = calendar.visible;
      }
    });
  }
});
