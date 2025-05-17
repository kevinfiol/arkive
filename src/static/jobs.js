const { m, redraw, mount } = window.umai;
import { Spinner } from './spinner.js';

const html = window.htm.bind(m);
const ROOT = document.getElementById("JOBS_ROOT");

const JOB_STATUS = {
  processing: '1',
  completed: '2',
  failed: '3',
  pending: '4'
};

const state = { jobs: [], pending: [], completed: [], loading: true };

const ProgressSpinner = () => {
  let spinner;

  const onMount = (node) => {
    spinner = new Spinner(node);
    spinner.run();

    return () => {
      spinner.stop();
      spinner = undefined;
    }
  };

  return () => (
    m('div', { dom: onMount })
  );
};

const App = () => html`
  <section class="articles">
    ${state.loading && html`
      <div style="display: flex;">
        <${ProgressSpinner} />
        <span>Loading jobs</span>
      </div>
    `}

    ${!state.loading && state.jobs.length === 0 && html`
      <figure class="alert">
        <em>No active or pending jobs</em>
      </figure>
    `}

    ${state.jobs.length > 0 && state.jobs.map((job) => html`
      <article
        class="article"
        key="${job.id}"
        id="${job.id}"
        style="display: grid; align-items: center; grid-template-columns: 1fr auto 1fr;"
      >
        <div style="justify-self: start;">
          <header>
            <p style="margin: 0; overflow: hidden; white-space: nowrap; padding-right: 0.5rem; text-overflow: ellipsis;">
              ${job.title}
            </p>
          </header>
          <div class="info">
            <small>
              <a href="${job.url}" class="url">${job.url}</a>
            </small>
          </div>
        </div>

        <div class="status" style="justify-self: center; grid-column: 2">
          ${(job.status === JOB_STATUS.pending || job.status === JOB_STATUS.processing) && html`
            <div style="display: flex;">
              <${ProgressSpinner} />
              <span>
                ${job.status === JOB_STATUS.pending && 'Pending'}
                ${job.status === JOB_STATUS.processing && 'Processing'}
              </span>
            </div>
          `}

          ${job.status === JOB_STATUS.completed && 'Complete'}
          ${job.status === JOB_STATUS.failed && 'Failed'}
        </div>

        <div class="actions" style="justify-self: end; grid-column: 3;">
          ${job.status === JOB_STATUS.failed && html`
            <div style="display: flex; gap: 8px;">
              <button onclick=${() => queueFailedJob(job)}>Retry</button>
              <button onclick=${() => clearJob(job.id)}>Clear</button>
            </div>
          `}
        </div>
      </article>
    `)}
  </section>
`;

mount(ROOT, App);

function queueFailedJob(job) {
  const formData = new FormData();
  formData.append('failed-id', job.id);
  fetch('/add', { method: 'POST', body: formData })
    .finally(redraw);
}

function clearJob(jobId) {
  fetch(`/job?id=${jobId}`, { method: 'DELETE' })
    .finally(() => {
      state.jobs = state.jobs.filter((job) => job.id !== jobId);
      redraw();
    });
}

// track jobs progress
const source = new EventSource('/job-status-event');
source.onmessage = (event) => {
  try {
    const jobs = JSON.parse(event.data);
    state.pending = [];

    for (const job of jobs) {
      if (job.status === JOB_STATUS.completed) {
        state.completed.push(job);
      } else {
        state.pending.push(job);
      }
    }

    const seen = {};
    state.jobs = [...state.completed, ...state.pending].reduce((all, job) => {
      if (seen[job.id]) return all;
      seen[job.id] = 1;
      all.push(job);
      return all;
    }, []);

    console.log({ jobs, statejobs: state.jobs });
  } catch {
    state.jobs = [];
  } finally {
    if (state.loading) state.loading = false;
    redraw();
  }
}
