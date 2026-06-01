// Automation View
(function() {
    'use strict';
    const VIEW = {
        async onShow() {
            const el = document.getElementById('view-automation');
            if (el) el.innerHTML = '<div class="topbar"><span class="topbar-title">Automation</span></div><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Automation coming soon</div>';
        }
    };
    window.DuckApp?.registerView('automation', VIEW);
})();
