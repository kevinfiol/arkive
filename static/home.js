(() => {
  let editingEl = undefined;
  let editingFilename = '';

  const searchBar = document.getElementById('search-bar');
  const editForm = document.getElementById('edit-form');
  const editError = document.getElementById('edit-error');
  const editDialog = document.getElementById('edit-dialog');
  const submitDialogBtn = document.getElementById('submit-dialog');
  const closeDialogBtn = document.getElementById('close-dialog');
  const titleInput = editForm.querySelector('[name="title"]');
  const urlInput = editForm.querySelector('[name="url"]');

  let controller;

  const searchArchive = debounce((query = '') => {
    if (controller !== undefined) controller.abort();
    controller = new AbortController();

    fetch(`/search?query=${query}`, {
      method: 'GET',
      signal: controller.signal,
      headers: new Headers({ 'content-type': 'application/json' })
    }).then((res) => {
      console.log(res);
    }).catch((err) => {
      console.error(err);
    });
  }, 1000);

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
    editingEl = el.parentElement.parentElement.parentElement; // this is really bad, come up with alt solution
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
})();