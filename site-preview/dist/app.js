const panels = {
  overview: { title: 'Overview', description: 'Current workload health, query behavior, and performance regressions from collected database evidence.', executions: '2.48M', latency: '42.8ms', load: '106.3s', regressions: '184' },
  queries: { title: 'Query Explorer', description: 'Compare normalized fingerprints across PostgreSQL and Snowflake with source-aware history.', executions: '184.2k', latency: '118ms', load: '284.9s', regressions: '08' },
  lineage: { title: 'Data Lineage', description: 'Trace catalog-backed and parsed dependencies with visible evidence quality.', executions: '1,284', latency: '—', load: '342', regressions: '12' },
  investigator: { title: 'AI Investigator', description: 'Ask questions grounded in authorized query, plan, metric, schema, and lineage evidence.', executions: '47', latency: '3.2s', load: '19', regressions: '04' }
};

document.querySelectorAll('.side-item, .public-nav').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.side-item, .public-nav').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const panel = panels[button.dataset.panel];
    document.querySelector('#panel-title').textContent = panel.title;
    const description = document.querySelector('#panel-description');
    if (description) description.textContent = panel.description;
    const values = document.querySelectorAll('#metric-grid strong');
    [panel.executions, panel.latency, panel.load, panel.regressions].forEach((value, index) => {
      values[index].animate([{ opacity: .15, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240 });
      values[index].textContent = value;
    });
  });
});

document.querySelector('#inspect-button')?.addEventListener('click', () => {
  const card = document.querySelector('.finding-card');
  card.animate([{ outline: '1px solid transparent' }, { outline: '1px solid #42e5c2' }, { outline: '1px solid transparent' }], { duration: 900 });
  document.querySelector('[data-panel="investigator"]').click();
});

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) entry.target.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
}), { threshold: .12 });
document.querySelectorAll('.section-intro, .workflow-track, .architecture-map').forEach((el) => observer.observe(el));
