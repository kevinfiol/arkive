import { Spinner } from './spinner.js';

const MAX_UPLOAD_SIZE = 50 * 1000 * 1000; // 50 mb

const $ = (query) => document.querySelector(query);
const spinner = new Spinner(document.querySelector('.spinner'));

const Edit = {
  element: undefined,
  filename: '',
  pageId: '',
  form: $('#edit-form'),
  dialog: $('#edit-dialog'),
  error: $('#edit-error'),
  submitBtn: $('#edit-submit-btn'),
  closeBtn: $('#edit-close-btn')
};

Edit.titleInput = Edit.form.querySelector('[name="title"]'),
Edit.urlInput = Edit.form.querySelector('[name="url"]')
Edit.tagsInput = Edit.form.querySelector('[name="tags"]');

Edit.closeBtn.addEventListener('click', () => {
  Edit.dialog.close();
});

Edit.submitBtn.addEventListener('click', async (ev) => {
  ev.preventDefault();
  const formData = new FormData(Edit.form);
  formData.append('filename', Edit.filename);
  formData.append('pageId', Edit.pageId);

  Edit.submitBtn.setAttribute('disabled', 'true');
  const { data, error } = await editPage(formData);
  Edit.submitBtn.removeAttribute('disabled');

  if (error) {
    Edit.error.classList.remove('-hidden');
    Edit.error.innerText = error;
  } else {
    const title = formData.get('title');
    const url = formData.get('url');
    const tags = data.tags ?? [];

    Edit.element.querySelector('.title').innerText = title;
    Edit.element.querySelector('.url').innerText = url;
    Edit.element.querySelector('.tags').style.display = tags.length > 0 ? 'flex' : 'none';
    Edit.element.querySelector('.tags > small').innerHTML = '';
    for (const tag of tags) {
      const span = document.createElement('span');
      span.style.cursor = "pointer";

      const a = document.createElement('a');
      a.setAttribute('data-tag', tag);
      a.setAttribute('onclick', 'window.filterByTag(this)');
      a.innerText = '#' + tag;

      span.appendChild(a);
      Edit.element.querySelector('.tags > small').appendChild(span);
    }

    Edit.element.querySelector('.edit-button').dataset.title = title;
    Edit.element.querySelector('.edit-button').dataset.url = url;
    Edit.element.querySelector('.edit-button').dataset.tags = tags.join(', ').trim();
    Edit.dialog.close();
  }
});

const Articles = {
  container: $('.articles')
};

const Search = {
  controller: undefined,
  input: $('#search-input')
};

Search.onSearch = (query = '') => {
  if (Search.controller !== undefined)
    Search.controller.abort();

  Search.controller = new AbortController();
  spinner.el.style.position = 'absolute';
  spinner.el.style.right = '17px';
  spinner.el.style.top = '3px;'

  spinner.run();
  fetch(`/api/search?query=${encodeURIComponent(query)}`, {
    method: 'GET',
    signal: Search.controller.signal,
    headers: new Headers({ 'content-type': 'application/json' })
  }).then((res) => {
    return res.text();
  }).then((text) => {
    Articles.container.innerHTML = text;
  }).catch((err) => {
    console.error(err);
  }).finally(() => spinner.stop());
};

const debouncedSearch = debounce(Search.onSearch, 400);
Search.input.addEventListener('input', ({ target }) => {
  const value = target.value.trim();
  if (value) debouncedSearch(target.value.trim());
  else Search.onSearch(value);
});

const BookmarksUploadInput = document.getElementById('bookmarks-upload');

BookmarksUploadInput.addEventListener('change', (e) => {
  const file = e.target.files[0];

  if (file && file.type.startsWith('text/') || file.type.startsWith('application/json')) {
    if (file.size > MAX_UPLOAD_SIZE) {
      BookmarksUploadInput.value = '';
      return;
    }

    (async () => {
      try {
        await uploadBookmarks(file);
      } catch (e) {
        console.error('Failed to upload bookmarks: ', e);
      } finally {
        BookmarksUploadInput.value = '';
      }
    })();
  }
});

function uploadBookmarks(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/bookmarks', true);

    xhr.onload = () => {
      if (xhr.status === 200) resolve(xhr.response);
      else reject(Error('Failed to upload file'));
    };

    xhr.onerror = () =>
      reject(Error('Network error occurred while uploading file'));

    const formData = new FormData();
    formData.append('file', file);
    xhr.send(formData);
  });
}

window.openEditDialog = function (el) {
  const { pageid, title, url, tags, filename } = el.dataset;
  Edit.element = el.parentElement.parentElement.parentElement;
  Edit.error.classList.add('-hidden');

  Edit.titleInput.value = title;
  Edit.urlInput.value = url ?? '';
  Edit.tagsInput.value = tags ?? '';
  Edit.filename = filename;
  Edit.pageId = pageid;
  Edit.dialog.showModal();
}

window.filterByTag = function (el) {
  const tag = el.dataset.tag;
  Search.input.value = '#' + tag;
  Search.onSearch(Search.input.value);
}

async function editPage(formData) {
  let data = {};
  let error = undefined;

  try {
    const res = await fetch('/edit', {
      method: 'POST',
      body: formData
    });

    data = await res.json();
  } catch (e) {
    console.error(e);
    error = 'An error occurred'
  }

  return { data, error };
}

// track jobs progress
const source = new EventSource('/job-event');
source.onmessage = (event) => {
  const jobCount = Number(event.data);
  const el = $('.jobs-in-progress');

  if (jobCount === NaN) return;
  if (jobCount === 0) el.innerText = 'Job Dashboard';
  else el.innerText = `${jobCount} jobs in progress`;
}

function debounce(callback, wait) {
  let timer;

  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(
      () => callback(...args),
      wait
    );
  };
}