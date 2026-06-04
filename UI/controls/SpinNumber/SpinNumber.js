// SpinNumber.js - Numeric input with up/down buttons

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    window.DuckControls.SpinNumber = {
        /**
         * options:
         * - label: string (optional)
         * - value: number
         * - min: number
         * - max: number
         * - step: number
         * - onChange: function(e, value)
         */
        create(options = {}) {
            const wrap = document.createElement('div');
            wrap.className = 'duck-spinnumber-wrap';

            if (options.label) {
                const label = document.createElement('label');
                label.className = 'duck-spinnumber-label';
                label.textContent = options.label;
                wrap.appendChild(label);
            }

            const inputContainer = document.createElement('div');
            inputContainer.className = 'duck-spinnumber-container';

            const btnMinus = document.createElement('button');
            btnMinus.className = 'duck-spinnumber-btn';
            btnMinus.innerHTML = '<span class="material-symbols-outlined">remove</span>';
            btnMinus.type = 'button';

            const input = document.createElement('input');
            input.type = 'number';
            input.className = 'duck-spinnumber-input';
            
            let val = options.value !== undefined ? options.value : 0;
            const min = options.min !== undefined ? options.min : -Infinity;
            const max = options.max !== undefined ? options.max : Infinity;
            const step = options.step !== undefined ? options.step : 1;
            
            input.value = val;
            if (options.min !== undefined) input.min = min;
            if (options.max !== undefined) input.max = max;
            if (options.step !== undefined) input.step = step;

            const btnPlus = document.createElement('button');
            btnPlus.className = 'duck-spinnumber-btn';
            btnPlus.innerHTML = '<span class="material-symbols-outlined">add</span>';
            btnPlus.type = 'button';

            const updateValue = (newVal) => {
                newVal = Math.max(min, Math.min(max, newVal));
                val = newVal;
                input.value = val;
                if (options.onChange) {
                    options.onChange(val);
                }
            };

            btnMinus.addEventListener('click', () => {
                updateValue(val - step);
            });

            btnPlus.addEventListener('click', () => {
                updateValue(val + step);
            });

            input.addEventListener('change', (e) => {
                let parsed = parseFloat(e.target.value);
                if (isNaN(parsed)) parsed = min !== -Infinity ? min : 0;
                updateValue(parsed);
            });

            inputContainer.appendChild(btnMinus);
            inputContainer.appendChild(input);
            inputContainer.appendChild(btnPlus);
            wrap.appendChild(inputContainer);

            return {
                element: wrap,
                input: input,
                getValue: () => val,
                setValue: (v) => updateValue(v)
            };
        }
    };
})();
