// Groups View
(function() {
    'use strict';
    const VIEW = {
        async onShow() {
            const el = document.getElementById('view-groups');
            if (el) el.innerHTML = '<div class="topbar"><span class="topbar-title">Groups</span></div><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Groups management coming soon</div>';
        }
    };
    window.DuckApp?.registerView('groups', VIEW);
})();
