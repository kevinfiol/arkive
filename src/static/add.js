import { Spinner } from './spinner.js';

const STORAGE_KEY = '$$ARKIVE_OPTS';
const JOB_STATUS = { processing: '1', completed: '2', failed: '3' };
const COMPLETED = 'Page Saved. Redirecting...';
const FAILED = 'Failed to save page. See system logs or try again.';
const PROCESSING = 'Saving Page...';

const $ = (query) => document.querySelector(query);
const $$ = (query) => document.querySelectorAll(query);

const Form = {
  el: $('.add-form'),
  alert: $('.alert'),
  status: $('.add-status'),
  processing: false
};

Spinner.el.style.width = '3%';

Form.el.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  if (Form.processing) return;

  Spinner.run();
  Form.alert.style.display = 'flex';
  Form.processing = true;
  Form.status.innerText = PROCESSING;

  const formData = new FormData(ev.target);
  const res = await fetch('/add-job', { method: 'POST', body: formData });
  const { jobId } = await res.json();

  // track progress
  const source = new EventSource(`/add-event/${jobId}`);
  source.onmessage = (event) => {
    Form.status.innerText = event.data === JOB_STATUS.processing
      ? PROCESSING
      : event.data === JOB_STATUS.completed
      ? COMPLETED
      : event.data === JOB_STATUS.failed
      ? FAILED
      : '';

    if (event.data === JOB_STATUS.completed || event.data === JOB_STATUS.failed) {
      source.close();

      if (event.data === JOB_STATUS.completed) {
        setTimeout(() => window.location.replace('/'), 500);
      } else {
        Spinner.stop();
        Form.processing = false;
      }
    }
  };

  source.onerror = (err) => {
    console.error('add-event source failed', err);
    source.close();

    Spinner.stop();
    Form.alert.style.display = 'none';
    Form.processing = false;
    Form.status.innerText = FAILED;
  };
});

const checkboxes = $$('input[type="checkbox"]');
const options = getOpts() ?? {
  // default options
  'no-audio': true,
  'no-frames': true,
  'isolate': true,
  'no-metadata': true,
  'no-video': true,
  'max-res': '720'
};

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

const maxResSelect = $('select[name="maxres"]');
maxResSelect.value = options['max-res'];
maxResSelect.addEventListener('change', ({ target }) => {
  options['max-res'] = target.value;
  setOpts(options);
});

function getOpts() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY));
}

function setOpts(opts = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(opts));
}