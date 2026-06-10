// Toast.js - Notification System with Progress Support
// Progress toasts are PERSISTENT - they don't auto-dismiss until explicitly cleared

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};
    window.Toast = window.Toast || {};

    const MAX_TOASTS = 5;
    const TOAST_DURATION = 5000;

    let container = null;
    let progressToast = null;

    /**
     * Handle toast push from backend.
     * Uses DuckControls.Toast.progress API for persistent progress toasts.
     * Backend sends: downloadedFormatted, totalFormatted (e.g. "45.2 MB / 100.5 MB")
     */
    window.Toast.push = function(toast) {
        if (!toast) return;

        var type = toast.type || toast.Type || 'info';
        var title = toast.title || toast.Title || 'Downloading...';
        var message = toast.message || toast.Message || '';
        var progress = toast.progressValue !== undefined ? toast.progressValue : (toast.ProgressValue !== undefined ? toast.ProgressValue : 0);
        var downloaded = toast.downloaded || toast.Downloaded || '0 B';
        var total = toast.total || toast.Total || '0 B';
        var status = toast.status || toast.Status || '';

        if (type === 'progress') {
            if (progress === 0 || progress === '0') {
                if (window.DuckControls && window.DuckControls.Toast && window.DuckControls.Toast.progress) {
                    window.DuckControls.Toast.progress.show(title);
                }
            } else if (progress >= 100) {
                if (window.DuckControls && window.DuckControls.Toast && window.DuckControls.Toast.progress) {
                    window.DuckControls.Toast.progress.complete(message || 'Download complete');
                }
            } else {
                if (window.DuckControls && window.DuckControls.Toast && window.DuckControls.Toast.progress) {
                    window.DuckControls.Toast.progress.update(progress, downloaded, total, status || message);
                }
            }
        } else if (type === 'success') {
            if (window.DuckControls && window.DuckControls.Toast) {
                window.DuckControls.Toast.success(title, message);
            }
        } else if (type === 'error') {
            if (window.DuckControls && window.DuckControls.Toast) {
                window.DuckControls.Toast.error(title, message);
            }
        } else {
            if (window.DuckControls && window.DuckControls.Toast) {
                window.DuckControls.Toast.info(title, message);
            }
        }
    };

    function initContainer() {
        if (!container) {
            container = document.getElementById('duck-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'duck-toast-container';
                container.style.cssText = ''; // Clear inline styles, handled by CSS
                document.body.appendChild(container);
            }
        }
    }

    function showToast(type, title, message) {
        initContainer();

        const toast = document.createElement('div');
        toast.className = 'duck-toast duck-toast-' + type;
        toast.style.cssText = ''; // Handled by CSS

        const iconMap = { success: 'check_circle', error: 'error', info: 'info', warning: 'warning' };
        const iconColors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6', warning: '#f59e0b' };

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined duck-toast-icon';
        icon.textContent = iconMap[type] || 'info';
        toast.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'duck-toast-content';

        if (title) {
            const t = document.createElement('div');
            t.textContent = title;
            t.className = 'duck-toast-title';
            content.appendChild(t);
        }

        if (message) {
            const m = document.createElement('div');
            m.textContent = message;
            m.className = 'duck-toast-message';
            content.appendChild(m);
        }

        toast.appendChild(content);
        container.appendChild(toast);

        // Auto remove
        setTimeout(function() {
            removeToast(toast);
        }, TOAST_DURATION);

        return toast;
    }

    function removeToast(toast) {
        if (!toast || toast.classList.contains('toast-hiding')) return;
        toast.classList.add('toast-hiding');
        // Animation handled by class
        toast.addEventListener('animationend', function() {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        });
    }

    // ─────────────────────────────────────────────────────────────────
    // PROGRESS TOAST - ONLY ONE, NO CLOSE BUTTON, TOP RIGHT
    // ─────────────────────────────────────────────────────────────────

    function createProgressToast() {
        const toast = document.createElement('div');
        toast.className = 'duck-toast toast-progress';
        toast.style.cssText = ''; // Handled by CSS

        // Header: icon + title
        const header = document.createElement('div');
        header.className = 'toast-progress-header';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined duck-toast-icon';
        icon.id = 'progress-toast-icon';
        icon.textContent = 'downloading';
        header.appendChild(icon);

        const titleEl = document.createElement('div');
        titleEl.id = 'progress-toast-title';
        titleEl.className = 'duck-toast-title';
        titleEl.textContent = 'Downloading...';
        titleEl.style.flex = '1';
        header.appendChild(titleEl);

        const pctEl = document.createElement('div');
        pctEl.id = 'progress-toast-percent';
        pctEl.className = 'toast-progress-pct';
        pctEl.textContent = '0%';
        header.appendChild(pctEl);

        toast.appendChild(header);

        // Progress bar
        const barContainer = document.createElement('div');
        barContainer.className = 'toast-progress-bar-wrap';

        const bar = document.createElement('div');
        bar.id = 'progress-toast-bar';
        bar.className = 'toast-progress-bar';
        barContainer.appendChild(bar);
        toast.appendChild(barContainer);

        // Info row: downloaded / total
        const infoRow = document.createElement('div');
        infoRow.className = 'toast-progress-info';
        
        const bytesEl = document.createElement('span');
        bytesEl.id = 'progress-toast-bytes';
        bytesEl.textContent = '0 B / 0 B';
        infoRow.appendChild(bytesEl);

        // Status message
        const statusEl = document.createElement('span');
        statusEl.id = 'progress-toast-status';
        statusEl.textContent = '';
        infoRow.appendChild(statusEl);
        
        toast.appendChild(infoRow);

        return toast;
    }

    function showProgressToast() {
        initContainer();

        // Remove existing
        if (progressToast && progressToast.parentNode) {
            progressToast.parentNode.removeChild(progressToast);
        }

        progressToast = createProgressToast();
        container.appendChild(progressToast);

        return progressToast;
    }

    function updateProgressToast(percent, downloadedFormatted, totalFormatted, statusMsg) {
        if (!progressToast) {
            showProgressToast();
        }

        var bar = document.getElementById('progress-toast-bar');
        var pct = document.getElementById('progress-toast-percent');
        var bytes = document.getElementById('progress-toast-bytes');
        var status = document.getElementById('progress-toast-status');

        var pctVal = Math.min(100, Math.max(0, Math.round(percent)));

        if (bar) bar.style.width = pctVal + '%';
        if (pct) pct.textContent = pctVal + '%';
        if (bytes) bytes.textContent = (downloadedFormatted || '0 B') + ' / ' + (totalFormatted || '0 B');
        if (status) status.textContent = statusMsg || '';
    }

    function clearProgressToast() {
        if (progressToast) {
            removeToast(progressToast);
            progressToast = null;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────

    window.DuckControls.Toast = {
        success: function(title, message) { showToast('success', title, message); },
        error: function(title, message) { showToast('error', title, message); },
        info: function(title, message) { showToast('info', title, message); },
        warning: function(title, message) { showToast('warning', title, message); },

        progress: {
            show: function(title) {
                showProgressToast();
                var titleEl = document.getElementById('progress-toast-title');
                if (titleEl) titleEl.textContent = title || 'Downloading...';
                var icon = document.getElementById('progress-toast-icon');
                if (icon) { icon.textContent = 'downloading'; icon.style.color = ''; }
                var bar = document.getElementById('progress-toast-bar');
                if (bar) { bar.className = 'toast-progress-bar'; bar.style.width = '0%'; }
                updateProgressToast(0, '0 B', '0 B', 'Starting...');
            },

            update: function(percent, downloadedFormatted, totalFormatted, statusMsg) {
                updateProgressToast(percent, downloadedFormatted, totalFormatted, statusMsg);
            },

            complete: function(message) {
                if (!progressToast) return;
                var icon = document.getElementById('progress-toast-icon');
                if (icon) { icon.textContent = 'check_circle'; icon.style.color = 'var(--success)'; }
                var bar = document.getElementById('progress-toast-bar');
                if (bar) { bar.classList.add('success'); bar.style.width = '100%'; }
                var pct = document.getElementById('progress-toast-percent');
                if (pct) pct.textContent = 'Done';
                var status = document.getElementById('progress-toast-status');
                if (status) status.textContent = message || 'Download complete';
                setTimeout(function() { clearProgressToast(); }, 2000);
            },

            fail: function(message) {
                if (!progressToast) return;
                var icon = document.getElementById('progress-toast-icon');
                if (icon) { icon.textContent = 'error'; icon.style.color = 'var(--danger)'; }
                var bar = document.getElementById('progress-toast-bar');
                if (bar) { bar.classList.add('error'); }
                var status = document.getElementById('progress-toast-status');
                if (status) status.textContent = message || 'Download failed';
                setTimeout(function() { clearProgressToast(); }, 3000);
            },

            clear: function() { clearProgressToast(); }
        }
    };

    // CSS animations now handled in Toast.css

})();
