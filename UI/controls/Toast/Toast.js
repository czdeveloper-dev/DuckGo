// Toast.js - Notification System

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    const MAX_TOASTS = 5;
    const TOAST_DURATION = 3000;
    
    let container = null;

    function initContainer() {
        if (!container) {
            container = document.getElementById('duck-toast-container');
            if (!container) {
                container = document.createElement('div');
                container.id = 'duck-toast-container';
                document.body.appendChild(container);
            }
        }
    }

    function showToast(type, title, message) {
        initContainer();

        const toast = document.createElement('div');
        toast.className = `duck-toast duck-toast-${type}`;

        let iconStr = 'info';
        if (type === 'success') iconStr = 'check_circle';
        if (type === 'error') iconStr = 'error';

        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined duck-toast-icon';
        icon.textContent = iconStr;
        toast.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'duck-toast-content';

        if (title) {
            const tEl = document.createElement('div');
            tEl.className = 'duck-toast-title';
            tEl.textContent = title;
            content.appendChild(tEl);
        }

        if (message) {
            const mEl = document.createElement('div');
            mEl.className = 'duck-toast-message';
            mEl.textContent = message;
            content.appendChild(mEl);
        }

        toast.appendChild(content);

        // Add to container
        container.appendChild(toast);

        // Manage max toasts
        while (container.children.length > MAX_TOASTS) {
            const oldest = container.firstElementChild;
            if (oldest && !oldest.classList.contains('toast-hiding')) {
                removeToast(oldest);
            } else {
                break; // If the oldest is already hiding, just wait
            }
        }

        // Auto remove
        setTimeout(() => {
            removeToast(toast);
        }, TOAST_DURATION);
    }

    function removeToast(toast) {
        if (toast.classList.contains('toast-hiding')) return;
        toast.classList.add('toast-hiding');
        toast.addEventListener('animationend', () => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        });
    }

    window.DuckControls.Toast = {
        success(title, message) {
            showToast('success', title, message);
        },
        error(title, message) {
            showToast('error', title, message);
        },
        info(title, message) {
            showToast('info', title, message);
        }
    };

})();
