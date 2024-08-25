const $ = (query) => document.querySelector(query);

let editingEl = undefined;
let editingFilename = '';

const searchBar = $('#search-bar');
const editForm = $('#edit-form');
const editError = $('#edit-error');
const editDialog = $('#edit-dialog');
const submitDialogBtn = $('#submit-dialog');
const closeDialogBtn = $('#close-dialog');
const articlesContainer = $('.articles');

const titleInput = editForm.querySelector('[name="title"]');
const urlInput = editForm.querySelector('[name="url"]');

let controller;

const searchArchive = debounce((query = '') => {
  if (controller !== undefined) controller.abort();
  if (!query.trim()) return;
  controller = new AbortController();

  fetch(`/search?query=${query}`, {
    method: 'GET',
    signal: controller.signal,
    headers: new Headers({ 'content-type': 'application/json' })
  }).then((res) => {
    return res.text();
  }).then((text) => {
    articlesContainer.innerHTML = text;
  }).catch((err) => {
    console.error(err);
  });
}, 500);

searchBar.addEventListener('input', ({ target }) => {
  searchArchive(target.value);
});

closeDialogBtn.addEventListener('click', () => {
  editDialog.close();
});

submitDialogBtn.addEventListener('click', async (ev) => {
  ev.preventDefault();
  const formData = new FormData(editForm);
  formData.append('filename', editingFilename);

  submitDialogBtn.setAttribute('disabled', 'true');
  const { error } = await editPage(formData);
  submitDialogBtn.removeAttribute('disabled');

  if (error) {
    editError.classList.remove('-hidden');
    editError.innerText = error;
  } else {
    const title = formData.get('title');
    const url = formData.get('url');


    editingEl.querySelector('.title').innerText = title;
    editingEl.querySelector('.url').innerText = url;
    editingEl.querySelector('.edit-button').dataset.title = title;
    editingEl.querySelector('.edit-button').dataset.url = url;
    editDialog.close();
  }
});

window.openEditDialog = function(el) {
  const { title, url, filename } = el.dataset;
  editingEl = el.parentElement.parentElement.parentElement;
  editError.classList.add('-hidden');

  titleInput.value = title;
  urlInput.value = url ?? '';
  editingFilename = filename;
  editDialog.showModal();
}

async function editPage(formData) {
  let error = undefined;

  try {
    await fetch('/edit', {
      method: 'POST',
      body: formData
    });
  } catch (e) {
    console.error(e);
    error = 'An error occurred'
  }

  return { error };
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