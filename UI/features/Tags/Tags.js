// Tags View
(function() {
    'use strict';
    const VIEW = {
        async onShow() {
            const el = document.getElementById('view-tags');
            if (el) el.innerHTML = '<div class="topbar"><span class="topbar-title">Tags</span></div><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Tags management coming soon</div>';
        }
    };
    window.DuckApp?.registerView('tags', VIEW);
})();
