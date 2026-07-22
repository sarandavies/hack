(function () {
  'use strict';
  var body = document.body;
  var runId = body.getAttribute('data-run');
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  // Tabs
  var tabs = document.querySelectorAll('[data-tab]');
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.forEach(function (b) {
        b.classList.toggle('active', b === btn);
      });
      document.querySelectorAll('.tab-section').forEach(function (s) {
        s.style.display = s.id === 'tab-' + btn.getAttribute('data-tab') ? '' : 'none';
      });
    });
  });

  // Founder feedback → rerank without restarting the run
  document.querySelectorAll('[data-feedback]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.disabled = true;
      fetch('/api/runs/' + runId + '/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          candidateId: btn.getAttribute('data-candidate'),
          type: btn.getAttribute('data-feedback'),
          reason: btn.getAttribute('data-reason') || undefined,
        }),
      }).then(function () {
        location.reload();
      });
    });
  });

  // Poll persisted run state while running (no open connection required)
  if (body.getAttribute('data-status') === 'running' && runId) {
    var tick = function () {
      fetch('/api/runs/' + runId)
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (v) {
          if (!v) return;
          if (v.status !== 'running') {
            location.reload();
            return;
          }
          v.stages.forEach(function (s) {
            var el = document.querySelector('[data-stage="' + s.key + '"]');
            if (el) el.className = 'stage ' + s.status;
          });
          var set = function (id, val) {
            var el = document.getElementById(id);
            if (el) el.textContent = val;
          };
          set('m-sources', v.metrics.sourcesReviewed);
          set('m-companies', v.metrics.companiesConsidered);
          set('m-queries', v.budget.searchQueries.used + ' / ' + v.budget.searchQueries.limit);
          set('m-pages', v.budget.pagesFetched.used + ' / ' + v.budget.pagesFetched.limit);
          set('m-elapsed', v.budget.elapsedSeconds.used + 's / ' + v.budget.elapsedSeconds.limit + 's');
          var prelim = document.getElementById('prelim');
          if (prelim) {
            prelim.innerHTML =
              v.preliminaryCandidates
                .map(function (p) {
                  return (
                    '<div class="card prelim-card"><div class="row"><strong>' +
                    esc(p.name) +
                    '</strong><span class="muted small">' +
                    esc(p.domain) +
                    '</span><span class="badge">' +
                    esc(String(p.motion).replace(/_/g, ' ')) +
                    '</span></div><p class="small">' +
                    esc(p.hypothesis) +
                    '</p><p class="small muted">' +
                    esc(p.evidenceNote) +
                    ' — <a href="' +
                    esc(p.sourceUrl) +
                    '" rel="noopener nofollow">source</a></p></div>'
                  );
                })
                .join('') ||
              '<p class="muted small">Preliminary candidates will appear here as evidence lands…</p>';
          }
        })
        .catch(function () {})
        .then(function () {
          setTimeout(tick, 1500);
        });
    };
    tick();
  }
})();
