// ChipSelect.js - Custom Chip Selector Control

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    window.DuckControls.ChipSelect = {
        /**
         * @param {Object} options
         *  - options: Array<{label: string, value: any, disabled: boolean}>
         *  - value: any (currently selected value)
         *  - onChange: function(val)
         */
        create(options = {}) {
            const wrap = document.createElement('div');
            wrap.className = 'duck-chip-select';
            
            let currentValue = options.value;
            const chips = [];

            options.options.forEach(opt => {
                const chip = document.createElement('div');
                chip.className = 'duck-chip';
                chip.textContent = opt.label;
                chip.dataset.value = opt.value;
                
                if (opt.disabled) {
                    chip.classList.add('is-disabled');
                }

                if (opt.value === currentValue) {
                    chip.classList.add('is-active');
                }

                chip.addEventListener('click', () => {
                    if (opt.disabled || currentValue === opt.value) return;
                    
                    // Update UI
                    chips.forEach(c => c.classList.remove('is-active'));
                    chip.classList.add('is-active');
                    
                    // Update state and trigger callback
                    currentValue = opt.value;
                    if (options.onChange) {
                        options.onChange(currentValue);
                    }
                });

                chips.push(chip);
                wrap.appendChild(chip);
            });

            return {
                element: wrap,
                getValue: () => currentValue,
                setValue: (val) => {
                    currentValue = val;
                    chips.forEach(c => {
                        if (c.dataset.value === String(val)) {
                            c.classList.add('is-active');
                        } else {
                            c.classList.remove('is-active');
                        }
                    });
                }
            };
        }
    };
})();
