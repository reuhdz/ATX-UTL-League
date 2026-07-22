/* =============================================================================
   ATX UTL — Chart helpers (wraps vendored Chart.js)
   Keeps a registry so re-rendering a tab destroys old charts cleanly.
   ============================================================================ */

const ChartHub = {
  registry: {},

  _css(varName, fallback) {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(varName).trim();
    return v || fallback;
  },

  destroy(id) {
    if (this.registry[id]) { this.registry[id].destroy(); delete this.registry[id]; }
  },

  _base() {
    const grid = this._css('--chart-grid', 'rgba(148,163,184,0.15)');
    const text = this._css('--text-muted', '#94a3b8');
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: text, font: { size: 12 } } },
        tooltip: { intersect: false, mode: 'index' },
      },
      scales: {
        x: { grid: { color: grid }, ticks: { color: text } },
        y: { grid: { color: grid }, ticks: { color: text }, beginAtZero: true },
      },
    };
  },

  bar(id, labels, datasets, opts = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    this.destroy(id);
    this.registry[id] = new Chart(el, {
      type: 'bar',
      data: { labels, datasets },
      options: { ...this._base(), ...opts },
    });
  },

  line(id, labels, datasets, opts = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    this.destroy(id);
    this.registry[id] = new Chart(el, {
      type: 'line',
      data: { labels, datasets },
      options: { ...this._base(), ...opts },
    });
  },

  radar(id, labels, datasets) {
    const el = document.getElementById(id);
    if (!el) return;
    this.destroy(id);
    const text = this._css('--text-muted', '#94a3b8');
    const grid = this._css('--chart-grid', 'rgba(148,163,184,0.2)');
    this.registry[id] = new Chart(el, {
      type: 'radar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: text } } },
        scales: {
          r: {
            angleLines: { color: grid },
            grid: { color: grid },
            pointLabels: { color: text, font: { size: 11 } },
            ticks: { display: false, backdropColor: 'transparent' },
          },
        },
      },
    });
  },

  doughnut(id, labels, data, colors) {
    const el = document.getElementById(id);
    if (!el) return;
    this.destroy(id);
    const text = this._css('--text-muted', '#94a3b8');
    this.registry[id] = new Chart(el, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: { legend: { position: 'right', labels: { color: text } } },
      },
    });
  },
};

window.ChartHub = ChartHub;
