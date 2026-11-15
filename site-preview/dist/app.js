const panels = {
  overview: { title: 'Overview', executions: '2.48M', latency: '42.8ms', load: '18.4', regressions: '03' },
  queries: { title: 'Query Explorer', executions: '184.2k', latency: '118ms', load: '24.1', regressions: '08' },
  lineage: { title: 'Data Lineage', executions: '1,284', latency: '—', load: '342', regressions: '12' },
  investigator: { title: 'AI Investigator', executions: '47', latency: '3.2s', load: '19', regressions: '04' }
};

document.querySelectorAll('.side-item').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.side-item').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    const panel = panels[button.dataset.panel];
    document.querySelector('#panel-title').textContent = panel.title;
    const values = document.querySelectorAll('#metric-grid strong');
    [panel.executions, panel.latency, panel.load, panel.regressions].forEach((value, index) => {
      values[index].animate([{ opacity: .15, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240 });
      values[index].textContent = value;
    });
  });
});

document.querySelector('#inspect-button').addEventListener('click', () => {
  const card = document.querySelector('.finding-card');
  card.animate([{ outline: '1px solid transparent' }, { outline: '1px solid #42e5c2' }, { outline: '1px solid transparent' }], { duration: 900 });
  document.querySelector('[data-panel="investigator"]').click();
});

const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
  if (entry.isIntersecting) entry.target.animate([{ opacity: 0, transform: 'translateY(22px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
}), { threshold: .12 });
document.querySelectorAll('.section-intro, .workflow-track, .architecture-map').forEach((el) => observer.observe(el));
