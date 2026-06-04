// MultiSelectComboBox.js

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    window.DuckControls.MultiSelectComboBox = {
        /**
         * @param {Object} options
         *  - options: Array<{label: string, value: any}>
         *  - values: Array<any> (currently selected values)
         *  - placeholder: string
         *  - onChange: function(values)
         */
        create(options = {}) {
            const wrap = document.createElement('div');
            wrap.className = 'filter-stacked';
            if (options.width) {
                wrap.style.width = options.width;
                wrap.style.minWidth = options.width;
                wrap.style.maxWidth = options.width;
            }
            
            let currentValues = new Set(options.values || []);
            let allOptions = options.options || [];

            if (options.label) {
                const head = document.createElement('div');
                head.className = 'filter-stacked-head';
                const label = document.createElement('span');
                label.className = 'ui-label-sm';
                label.textContent = options.label;
                head.appendChild(label);
                
                const actionsContainer = document.createElement('div');
                actionsContainer.style.display = 'flex';
                actionsContainer.style.alignItems = 'center';
                actionsContainer.style.gap = '12px';

                const addAction = (act) => {
                    const actionBtn = document.createElement('span');
                    actionBtn.className = 'filter-stacked-create';
                    if (act.icon) {
                        const iconSpan = document.createElement('span');
                        iconSpan.className = 'material-symbols-outlined';
                        iconSpan.style.cssText = 'font-size:15px; vertical-align:middle;';
                        iconSpan.textContent = act.icon;
                        if (window.DuckControls && DuckControls.Tooltip) {
                            DuckControls.Tooltip.create(iconSpan, { text: act.text, position: 'top' });
                        } else {
                            iconSpan.title = act.text;
                        }
                        actionBtn.appendChild(iconSpan);
                    } else {
                        actionBtn.textContent = act.text;
                    }
                    if (act.color) {
                        actionBtn.style.color = act.color;
                    }
                    actionBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        act.onClick(e);
                    });
                    actionsContainer.appendChild(actionBtn);
                };

                if (options.actions && options.actions.length > 0) {
                    options.actions.forEach(addAction);
                } else if (options.action) {
                    addAction(options.action);
                }
                
                if (actionsContainer.children.length > 0) {
                    head.appendChild(actionsContainer);
                }
                
                wrap.appendChild(head);
            }
            
            const triggerBtn = document.createElement('button');
            triggerBtn.className = 'input-field-sm duck-custom-select';
            if (options.bgVariant === 'subtle') triggerBtn.classList.add('bg-subtle');
            triggerBtn.style.width = '100%';
            triggerBtn.style.display = 'flex';
            triggerBtn.style.alignItems = 'center';
            triggerBtn.style.justifyContent = 'space-between';
            
            const textSpan = document.createElement('span');
            textSpan.style.overflow = 'hidden';
            textSpan.style.textOverflow = 'ellipsis';
            textSpan.style.whiteSpace = 'nowrap';
            textSpan.style.flex = '1';
            textSpan.style.textAlign = 'left';
            
            const updateDisplay = () => {
                if (currentValues.size === 0) {
                    // Fallback to label or placeholder
                    textSpan.textContent = options.label || options.placeholder || 'Select...';
                    textSpan.style.color = 'var(--text-secondary)';
                } else if (currentValues.size === 1) {
                    const val = Array.from(currentValues)[0];
                    const opt = allOptions.find(o => String(o.value) === String(val));
                    textSpan.textContent = opt ? opt.label : val;
                    textSpan.style.color = 'var(--text-primary)';
                } else {
                    textSpan.textContent = `${currentValues.size} selected`;
                    textSpan.style.color = 'var(--text-primary)';
                }
            };
            
            updateDisplay();
            
            const arrow = document.createElement('span');
            arrow.className = 'material-symbols-outlined duck-select-arrow-icon';
            arrow.textContent = 'expand_more';
            arrow.style.fontSize = '18px';
            arrow.style.color = 'var(--text-tertiary)';
            arrow.style.transition = 'transform 0.2s';
            arrow.style.marginLeft = '8px';
            arrow.style.flexShrink = '0';
            
            triggerBtn.appendChild(textSpan);
            triggerBtn.appendChild(arrow);
            wrap.appendChild(triggerBtn);

            // Initialize Dropdown
            let dropdown = null;
            if (window.DuckControls && window.DuckControls.Dropdown) {
                dropdown = window.DuckControls.Dropdown.create(triggerBtn, {
                    value: '',
                    values: Array.from(currentValues),
                    items: allOptions.length > 0 ? allOptions : [{ label: 'No records found', disabled: true }],
                    multi: true,
                    matchTriggerWidth: true,
                    onChange: (selectedValuesArray) => {
                        currentValues.clear();
                        selectedValuesArray.forEach(v => currentValues.add(v));
                        updateDisplay();
                        if (options.onChange) {
                            options.onChange(Array.from(currentValues));
                        }
                    }
                });

                // Sync arrow and focus state with dropdown's open class
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((m) => {
                        if (m.attributeName === 'class') {
                            const isActive = dropdown.menu.classList.contains('duck-dropdown-open') || dropdown.menu.classList.contains('active');
                            if (isActive) {
                                arrow.style.transform = 'rotate(180deg)';
                                triggerBtn.classList.add('focused');
                            } else {
                                arrow.style.transform = 'rotate(0deg)';
                                triggerBtn.classList.remove('focused');
                            }
                        }
                    });
                });
                observer.observe(dropdown.menu, { attributes: true });
            }

            return {
                element: wrap,
                getValues: () => Array.from(currentValues),
                setValues: (newValues) => {
                    currentValues.clear();
                    if (newValues && Array.isArray(newValues)) {
                        newValues.forEach(v => currentValues.add(v));
                    }
                    updateDisplay();
                    if (dropdown) {
                        dropdown.setSelectedValues(Array.from(currentValues));
                    }
                },
                /** Rebuild dropdown items when the options list changes (e.g. after CRUD). */
                setOptions(newOptions) {
                    allOptions = Array.isArray(newOptions) ? newOptions.slice() : [];
                    if (dropdown) {
                        dropdown.setItems(allOptions.length > 0 ? allOptions : [{ label: 'No records found', disabled: true }]);
                    }
                },
                destroy: () => {
                    if (dropdown) {
                        dropdown.destroy();
                    }
                }
            };
        }
    };
})();
