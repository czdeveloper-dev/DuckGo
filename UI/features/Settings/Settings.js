// Settings View
(function() {
    'use strict';
    const VIEW = {
        async onShow() {
            const el = document.getElementById('view-settings');
            if (el) el.innerHTML = '<div class="topbar"><span class="topbar-title">Settings</span></div><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Settings coming soon</div>';
        }
    };
    window.DuckApp?.registerView('settings', VIEW);
})();
