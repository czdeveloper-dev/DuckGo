// Proxies View
(function() {
    'use strict';
    const VIEW = {
        async onShow() {
            const el = document.getElementById('view-proxies');
            if (el) el.innerHTML = '<div class="topbar"><span class="topbar-title">Proxies</span></div><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Proxies management coming soon</div>';
        }
    };
    window.DuckApp?.registerView('proxies', VIEW);
})();
