/* =============================================================================
   Season switcher — shared season picker + archived-season banner
   -----------------------------------------------------------------------------
   Static pages: add [data-season-switcher] / [data-season-banner] elements.
   Rendered pages: interpolate SeasonSwitcher.html() / .bannerHtml().
   Picking a season reloads the page on it (every hub binds to one season).
   ============================================================================ */

const SeasonSwitcher = (() => {
  const db = () => window.DB;

  function html() {
    const d = db();
    if (!d?.seasons?.length) return '';
    const opt = (s) => `<option value="${s.id}"${s.id === d.season.id ? ' selected' : ''}>${s.label}</option>`;
    const current = d.seasons.filter((s) => !s.archived);
    const archived = d.seasons.filter((s) => s.archived);
    return `<label class="season-switch">
      <span class="season-switch-label">Season</span>
      <select class="select season-select" aria-label="Season">
        ${current.map(opt).join('')}
        ${archived.length ? `<optgroup label="Archive">${archived.map(opt).join('')}</optgroup>` : ''}
      </select>
    </label>`;
  }

  function bannerHtml() {
    const d = db();
    if (!d?.isArchived?.()) return '';
    const current = d.seasons.find((s) => s.id === d.defaultSeasonId);
    return `<div class="season-banner" role="status">
      <span>📦 Viewing <b>${d.season.label}</b> (archived) — results, rosters and stats are kept exactly as the season finished.</span>
      ${current ? `<button type="button" class="text-link" data-season-go="${current.id}">Back to ${current.label} →</button>` : ''}
    </div>`;
  }

  function mountAll(root = document) {
    root.querySelectorAll('[data-season-switcher]').forEach((el) => { el.innerHTML = html(); });
    root.querySelectorAll('[data-season-banner]').forEach((el) => {
      el.innerHTML = bannerHtml();
      el.hidden = !el.innerHTML;
    });
  }

  document.addEventListener('change', (e) => {
    const sel = e.target.closest?.('.season-select');
    if (sel) db()?.switchSeason(sel.value);
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('[data-season-go]');
    if (btn) db()?.switchSeason(btn.dataset.seasonGo);
  });

  mountAll();
  return { html, bannerHtml, mountAll };
})();

window.SeasonSwitcher = SeasonSwitcher;
