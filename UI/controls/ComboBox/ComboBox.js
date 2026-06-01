// ComboBox.js - Inline combobox/dropdown control (label + select in one line)

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    /**
     * ComboBox Control - Inline dropdown with label
     * Options:
     *   - label: string - Label text
     *   - options: array - [{value, label}]
     *   - value: string - Selected value
     *   - onChange: function - Change callback
     *   - placeholder: string - Default text
     *   - actions: array - [{text, onClick}] action links
     *   - icon: string - Material icon name
     */
    window.DuckControls.ComboBox = {
        create(options = {}) {
            const wrap = document.createElement('div');
            wrap.className = 'duck-combobox';
            
            // Left side: Label + Select
            const left = document.createElement('div');
            left.className = 'duck-combobox-left';
            
            if (options.label) {
                const label = document.createElement('span');
                label.className = 'duck-combobox-label';
                label.textContent = options.label;
                left.appendChild(label);
            }
            
            // Select container
            const selectContainer = document.createElement('div');
            selectContainer.className = 'duck-combobox-select-wrap';
            
            if (options.icon) {
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined duck-combobox-icon';
                icon.textContent = options.icon;
                selectContainer.appendChild(icon);
            }
            
            const select = document.createElement('select');
            select.className = 'duck-combobox-select';
            
            const renderOptions = (opts) => {
                select.innerHTML = '';
                (opts || []).forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt.value;
                    option.textContent = opt.label;
                    if (options.value == opt.value) option.selected = true;
                    select.appendChild(option);
                });
            };
            
            renderOptions(options.options || []);
            if (options.onChange) select.addEventListener('change', options.onChange);
            
            selectContainer.appendChild(select);
            
            // Arrow
            const arrow = document.createElement('span');
            arrow.className = 'material-symbols-outlined duck-combobox-arrow';
            arrow.textContent = 'expand_more';
            selectContainer.appendChild(arrow);
            
            left.appendChild(selectContainer);
            wrap.appendChild(left);
            
            // Right side: Actions
            if (options.actions?.length) {
                const actions = document.createElement('div');
                actions.className = 'duck-combobox-actions';
                options.actions.forEach(action => {
                    const btn = document.createElement('button');
                    btn.className = 'duck-combobox-action';
                    btn.textContent = action.text;
                    if (action.onClick) btn.addEventListener('click', action.onClick);
                    actions.appendChild(btn);
                });
                wrap.appendChild(actions);
            }
            
            return {
                element: wrap,
                select: select,
                getValue: () => select.value,
                setValue: (val) => {
                    select.value = val;
                    select.dispatchEvent(new Event('change'));
                },
                setOptions: renderOptions
            };
        }
    };
})();
