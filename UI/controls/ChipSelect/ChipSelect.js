// ChipSelect.js - Custom Chip Selector Control (single-select)

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

            const buildChips = (opts) => {
                chips.length = 0;
                while (wrap.firstChild) wrap.removeChild(wrap.firstChild);
                (opts || []).forEach(opt => {
                    const chip = document.createElement('div');
                    chip.className = 'duck-chip';
                    chip.textContent = opt.label;
                    chip.dataset.value = opt.value;

                    if (opt.disabled) chip.classList.add('is-disabled');
                    if (String(opt.value) === String(currentValue)) chip.classList.add('is-active');

                    chip.addEventListener('click', () => {
                        if (opt.disabled || String(opt.value) === String(currentValue)) return;
                        chips.forEach(c => c.classList.remove('is-active'));
                        chip.classList.add('is-active');
                        currentValue = opt.value;
                        if (options.onChange) options.onChange(currentValue);
                    });

                    chips.push(chip);
                    wrap.appendChild(chip);
                });
            };

            buildChips(options.options);

            let _onChange = options.onChange;

            return {
                element: wrap,

                getValue: () => currentValue,

                setValue: (val) => {
                    currentValue = val;
                    chips.forEach(c => {
                        if (String(c.dataset.value) === String(val)) c.classList.add('is-active');
                        else c.classList.remove('is-active');
                    });
                },

                /** Replace all chip options (used by cascade) */
                setOptions(newOptions) {
                    buildChips(newOptions);
                },

                /** Overridable change handler — set by caller to intercept chip clicks */
                get onChange() { return _onChange; },
                set onChange(fn) { _onChange = fn; }
            };
        }
    };
})();
