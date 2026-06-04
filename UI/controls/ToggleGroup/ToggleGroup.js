// ToggleGroup.js - A button group control

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    window.DuckControls.ToggleGroup = {
        /**
         * Create a Toggle Group
         * @param {Object} config
         * @param {Array} config.options - Array of { label: 'text', value: 'val' }
         * @param {String} config.value - Initial selected value
         * @param {Boolean} config.fullWidth - If true, stretches buttons equally
         * @param {Function} config.onChange - Callback(value)
         * @returns {Object} { element, getValue, setValue }
         */
        create(config = {}) {
            const wrap = document.createElement('div');
            wrap.className = 'duck-toggle-group';
            if (config.fullWidth) wrap.classList.add('full-width');

            let currentValue = config.value;
            const buttons = [];

            (config.options || []).forEach(opt => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'duck-toggle-group-btn';
                btn.textContent = opt.label;
                btn.dataset.value = opt.value;

                if (opt.value === currentValue) {
                    btn.classList.add('active');
                }

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    if (currentValue === opt.value) return; // already active

                    // Update UI
                    buttons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Update State
                    currentValue = opt.value;

                    // Trigger callback
                    if (config.onChange) {
                        config.onChange(currentValue);
                    }
                });

                buttons.push(btn);
                wrap.appendChild(btn);
            });

            // Default to first if none matched
            if (currentValue === undefined && buttons.length > 0) {
                currentValue = config.options[0].value;
                buttons[0].classList.add('active');
            }

            return {
                element: wrap,
                getValue: () => currentValue,
                setValue: (val) => {
                    currentValue = val;
                    buttons.forEach(b => {
                        if (b.dataset.value === val) b.classList.add('active');
                        else b.classList.remove('active');
                    });
                }
            };
        }
    };
})();
