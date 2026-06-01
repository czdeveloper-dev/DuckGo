// Badge.js - Badge control component

(function() {
    'use strict';

    class Badge {
        constructor(element, options = {}) {
            this.element = element instanceof HTMLElement ? element : document.querySelector(element);
            this.options = {
                text: options.text || '',
                ...options
            };
            this._init();
        }

        _init() {
            this.element.classList.add('duck-badge');
            if (this.options.text) {
                this.setText(this.options.text);
            }
        }

        setText(text) {
            this.element.textContent = text;
            this.options.text = text;
        }
    }

    // Badge API
    window.DuckControls = window.DuckControls || {};
    window.DuckControls.Badge = {
        create(element, options) {
            return new Badge(element, options);
        }
    };
})();
