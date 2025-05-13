export class Spinner {
  constructor(element) {
    this.el = element || document.createElement('span');
    this.el.classList.add('spinner');
    this.steps = ['|', '/', '-', '\\', '|', '/', '-', '\\'];
    this.timer = undefined;
    this.step = 0;
    this.ms = 100;
  }

  run() {
    this.el.style.display = 'inherit';
    this.el.style.width = '14px';
    this.timer = setInterval(() => {
      this.step += 1;
      if (this.step === this.steps.length) this.step = 0;
      this.el.innerText = this.steps[this.step];
    }, this.ms);

    return this;
  }

  stop() {
    this.el.style.display = 'none';
    clearInterval(this.timer);
    this.timer = undefined;
    return this;
  }

  appendTo(parent) {
    if (typeof parent === 'string') {
      document.querySelector(parent).appendChild(this.el);
    } else if (parent instanceof Element) {
      parent.appendChild(this.el);
    }

    return this;
  }
}