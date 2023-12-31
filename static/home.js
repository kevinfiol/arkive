(() => {
  const searchBar = document.getElementById('search-bar');
  let controller;

  const searchArchive = debounce((input = '') => {
    if (controller !== undefined) controller.abort();
    controller = new AbortController();

    fetch('/search', {
      method: 'POST',
      signal: controller.signal,
      headers: new Headers({ 'content-type': 'application/json' }),
      body: JSON.stringify({ input })
    }).then((res) => {
      console.log(res);
    }).catch((err) => {
      console.error(err);
    });
  }, 1000);

  searchBar.addEventListener('input', ({ target }) => {
    searchArchive(target.value);
  });

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