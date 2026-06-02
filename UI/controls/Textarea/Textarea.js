// Textarea.js - Multiline text input component

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    window.DuckControls.Textarea = {
        /**
         * options:
         * - label: string (optional)
         * - placeholder: string
         * - value: string
         * - rows: number
         * - onInput: function(e)
         */
        create(options = {}) {
            const wrap = document.createElement('div');
            wrap.className = 'duck-textarea-wrap';

            if (options.label) {
                const label = document.createElement('div');
                label.className = 'duck-textarea-label';
                label.textContent = options.label;
                wrap.appendChild(label);
            }

            const textarea = document.createElement('textarea');
            textarea.className = 'duck-textarea';
            if (options.placeholder) textarea.placeholder = options.placeholder;
            if (options.value) textarea.value = options.value;
            if (options.rows) textarea.rows = options.rows;
            else textarea.rows = 4; // Default to 4 rows

            if (options.onInput) {
                textarea.addEventListener('input', options.onInput);
            }

            wrap.appendChild(textarea);

            return {
                element: wrap,
                textarea: textarea,
                getValue: () => textarea.value,
                setValue: (val) => { textarea.value = val; }
            };
        }
    };
})();
