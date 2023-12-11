(() => {
  const STORAGE_KEY = '$$ARKIVE_OPTS';

  const options = getOpts() ?? {};
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');

  // initialize
  for (const el of checkboxes) {
    const key = el.getAttribute('name');

    if (key in options) {
      el.setAttribute('checked', 'true');
    }

    // set event listeners on each checkbox
    el.addEventListener('change', ({ target }) => {
      if (target.checked) {
        options[key] = true;
      } else {
        delete options[key];
      }

      setOpts(options);
    });
  }

  function getOpts() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  }

  function setOpts(opts = {}) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
  }
})();