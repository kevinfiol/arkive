const $ = (query) => document.querySelector(query);

const Spinner = {
  container: $('.spinner'),
  steps: ['|', '/', '-', '\\', '|', '/', '-', '\\'],
  timer: undefined,
  step: 0,
  ms: 100
};

Spinner.run = () => {
  Spinner.container.style.display = 'inherit';

  const { ms, steps } = Spinner;

  Spinner.timer = setInterval(() => {
    Spinner.step += 1;
    if (Spinner.step === steps.length) Spinner.step = 0;
    Spinner.container.innerText = steps[Spinner.step];
  }, ms);
};

Spinner.stop = () => {
  Spinner.container.style.display = 'none';
  clearInterval(Spinner.timer);
  Spinner.timer = undefined;
};

const Edit = {
  element: undefined,
  filename: '',
  form: $('#edit-form'),
  dialog: $('#edit-dialog'),
  error: $('#edit-error'),
  submitBtn: $('#edit-submit-btn'),
  closeBtn: $('#edit-close-btn')
};

Edit.titleInput = Edit.form.querySelector('[name="title"]'),
Edit.urlInput = Edit.form.querySelector('[name="url"]')

Edit.closeBtn.addEventListener('click', () => {
  Edit.dialog.close();
});

Edit.submitBtn.addEventListener('click', async (ev) => {
  ev.preventDefault();
  const formData = new FormData(Edit.form);
  formData.append('filename', Edit.filename);

  Edit.submitBtn.setAttribute('disabled', 'true');
  const { error } = await editPage(formData);
  Edit.submitBtn.removeAttribute('disabled');

  if (error) {
    Edit.error.classList.remove('-hidden');
    Edit.error.innerText = error;
  } else {
    const title = formData.get('title');
    const url = formData.get('url');

    Edit.element.querySelector('.title').innerText = title;
    Edit.element.querySelector('.url').innerText = url;
    Edit.element.querySelector('.edit-button').dataset.title = title;
    Edit.element.querySelector('.edit-button').dataset.url = url;
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

Search.onSearch = debounce((query = '') => {
  if (Search.controller !== undefined)
    Search.controller.abort();

  Search.controller = new AbortController();

  Spinner.run();
  fetch(`/api/search?query=${query}`, {
    method: 'GET',
    signal: Search.controller.signal,
    headers: new Headers({ 'content-type': 'application/json' })
  }).then((res) => {
    return res.text();
  }).then((text) => {
    Articles.container.innerHTML = text;
  }).catch((err) => {
    console.error(err);
  }).finally(Spinner.stop);
}, 400)

Search.input.addEventListener('input', ({ target }) => {
  Search.onSearch(target.value);
});

window.openEditDialog = function (el) {
  const { title, url, filename } = el.dataset;
  Edit.element = el.parentElement.parentElement.parentElement;
  Edit.error.classList.add('-hidden');

  Edit.titleInput.value = title;
  Edit.urlInput.value = url ?? '';
  Edit.filename = filename;
  Edit.dialog.showModal();
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