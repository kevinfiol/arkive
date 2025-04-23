export const Spinner = {
  el: document.querySelector('.spinner'),
  steps: ['|', '/', '-', '\\', '|', '/', '-', '\\'],
  timer: undefined,
  step: 0,
  ms: 100
};

Spinner.run = () => {
  Spinner.el.style.display = 'inherit';

  const { ms, steps } = Spinner;

  Spinner.timer = setInterval(() => {
    Spinner.step += 1;
    if (Spinner.step === steps.length) Spinner.step = 0;
    Spinner.el.innerText = steps[Spinner.step];
  }, ms);
};

Spinner.stop = () => {
  Spinner.el.style.display = 'none';
  clearInterval(Spinner.timer);
  Spinner.timer = undefined;
};