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
            
            const displaySpan = document.createElement('span');
            displaySpan.className = 'duck-combobox-select';
            displaySpan.style.cssText = 'flex: 1; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; color: var(--text-primary);';
            let currentValue = options.value || '';
            let originalOptions = options.options || [];
            let currentOptions = [...originalOptions];
            if (currentOptions.length === 0) {
                currentOptions = [{ label: 'No records found', icon: 'inbox', disabled: true }];
            }
            let _handlers = [];
            if (options.onChange) _handlers.push(options.onChange);

            const _emit = (val) => {
                currentValue = val;
                updateDisplay();
                clearError();
                _handlers.forEach(h => { try { h({ target: { value: val } }); } catch (e) { console.error(e); } });
            };

            const updateDisplay = () => {
                const selectedOpt = originalOptions.find(o => o.value == currentValue);
                displaySpan.textContent = selectedOpt ? selectedOpt.label : (options.placeholder || 'Select...');
            };
            updateDisplay();
            
            selectContainer.appendChild(displaySpan);
            
            // Arrow
            const arrow = document.createElement('span');
            arrow.className = 'material-symbols-outlined duck-combobox-arrow';
            arrow.textContent = 'expand_more';
            arrow.style.transition = 'transform 0.2s';
            selectContainer.appendChild(arrow);
            
            left.appendChild(selectContainer);
            wrap.appendChild(left);
            // Initialize Dropdown
            let dropdown = null;
            if (window.DuckControls && window.DuckControls.Dropdown) {
                dropdown = window.DuckControls.Dropdown.create(wrap, {
                    value: currentValue,
                    items: currentOptions,
                    onChange: (item) => {
                        _emit(item.value);
                    }
                });
                
                // Sync arrow and focus state with dropdown's open class
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach((m) => {
                        if (m.attributeName === 'class') {
                            if (dropdown.menu.classList.contains('duck-dropdown-open')) {
                                arrow.style.transform = 'rotate(180deg)';
                                wrap.classList.add('focused');
                            } else {
                                arrow.style.transform = 'rotate(0deg)';
                                wrap.classList.remove('focused');
                            }
                        }
                    });
                });
                observer.observe(dropdown.menu, { attributes: true });
            }
            
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

            // Error label support
            let _errorLabel = null;
            const setError = (message) => {
                selectContainer.style.borderColor = 'var(--danger, #ef4444)';
                selectContainer.style.background = 'rgba(239, 68, 68, 0.05)';
                if (!_errorLabel) {
                    _errorLabel = document.createElement('div');
                    _errorLabel.className = 'field-error-label';
                    _errorLabel.style.cssText = 'font-size: 12px; color: var(--danger, #ef4444); margin-top: 4px; display: flex; align-items: center; gap: 6px; font-weight: 500;';
                    wrap.appendChild(_errorLabel);
                }
                _errorLabel.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;color:var(--danger,#ef4444)">error</span> ' + message;
                _errorLabel.style.display = 'flex';
            };
            const clearError = () => {
                selectContainer.style.borderColor = '';
                selectContainer.style.background = '';
                if (_errorLabel) _errorLabel.style.display = 'none';
            };

            return {
                element: wrap,
                getValue: () => currentValue,
                setValue: (val) => {
                    currentValue = val;
                    updateDisplay();
                    if (dropdown) dropdown.setSelectedValue(val);
                },
                setOptions: (opts) => {
                    originalOptions = opts || [];
                    currentOptions = [...originalOptions];
                    if (currentOptions.length === 0) {
                        currentOptions = [{ label: 'No records found', icon: 'inbox', disabled: true }];
                    }
                    updateDisplay();
                    if (dropdown) dropdown.setItems(currentOptions);
                },
                onChange: {
                    get: () => _handlers[0] || null,
                    set: (fn) => { if (fn) { _handlers = [fn]; } else { _handlers = []; } }
                },
                setError,
                clearError,
                destroy: () => {
                    if (dropdown) dropdown.destroy();
                }
            };
        }
    };
})();
