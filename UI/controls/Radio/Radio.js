// Radio.js - Custom Radio Control

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    window.DuckControls.RadioGroup = {
        /**
         * @param {Object} options 
         *  - name: string (radio group name)
         *  - options: array of { label: string, value: string, disabled: boolean }
         *  - value: string (selected value)
         *  - inline: boolean (horizontal vs vertical)
         *  - onChange: function(val)
         */
        create(options = {}) {
            const wrap = document.createElement('div');
            wrap.className = 'duck-radio-group' + (options.inline ? ' inline' : '');

            const groupName = options.name || 'radio-group-' + Math.random().toString(36).substring(2);
            let currentValue = options.value;

            options.options.forEach(opt => {
                const labelEl = document.createElement('label');
                labelEl.className = 'duck-radio-label';
                if (opt.disabled) labelEl.classList.add('disabled');

                const input = document.createElement('input');
                input.type = 'radio';
                input.name = groupName;
                input.className = 'duck-radio-input';
                input.value = opt.value;
                if (opt.disabled) input.disabled = true;
                if (opt.value === currentValue) input.checked = true;

                const customEl = document.createElement('span');
                customEl.className = 'duck-radio-custom';

                const textEl = document.createElement('span');
                textEl.textContent = opt.label;

                labelEl.appendChild(input);
                labelEl.appendChild(customEl);
                labelEl.appendChild(textEl);

                input.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        currentValue = e.target.value;
                        if (options.onChange) options.onChange(currentValue);
                    }
                });

                wrap.appendChild(labelEl);
            });

            return {
                element: wrap,
                getValue: () => currentValue,
                setValue: (val) => {
                    currentValue = val;
                    const inputs = wrap.querySelectorAll('input[type="radio"]');
                    inputs.forEach(input => {
                        if (input.value === val) input.checked = true;
                    });
                }
            };
        }
    };

})();
