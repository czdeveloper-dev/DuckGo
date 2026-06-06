// DuckUtils - Shared utility functions

(function() {
    'use strict';

    window.DuckUtils = {
        /**
         * Format a date to a human-readable string.
         */
        formatDate(dateStr) {
            if (!dateStr) return '-';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '-';
            return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        },

        /**
         * Format relative time (e.g. "2 hours ago").
         */
        formatRelative(dateStr) {
            if (!dateStr) return '-';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '-';
            const diff = Date.now() - d.getTime();
            const mins = Math.floor(diff / 60000);
            if (mins < 1) return 'just now';
            if (mins < 60) return `${mins}m ago`;
            const hours = Math.floor(mins / 60);
            if (hours < 24) return `${hours}h ago`;
            const days = Math.floor(hours / 24);
            if (days < 30) return `${days}d ago`;
            return d.toLocaleDateString();
        },

        /**
         * Debounce a function.
         */
        debounce(fn, delay) {
            let timer;
            return (...args) => {
                clearTimeout(timer);
                timer = setTimeout(() => fn(...args), delay);
            };
        },

        /**
         * Generate a random string ID.
         */
        randomId() {
            return Math.random().toString(36).slice(2) + Date.now().toString(36);
        },

        /**
         * Escape HTML to prevent XSS.
         */
        escapeHtml(str) {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        },

        /**
         * Deep clone an object.
         */
        deepClone(obj) {
            return JSON.parse(JSON.stringify(obj));
        },

        /**
         * Check if array is empty or null.
         */
        isEmpty(arr) {
            return !arr || arr.length === 0;
        },

    }
})();
