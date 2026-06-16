window.DuckControls = window.DuckControls || {};
window.DuckControls.Select = {
    create(initialOptions) {
        const wrap = document.createElement('div');
        wrap.className = 'filter-stacked';
        if (initialOptions.width) {
            wrap.style.width = initialOptions.width;
            wrap.style.minWidth = initialOptions.width;
            wrap.style.maxWidth = initialOptions.width;
        }

        // ── Label + actions header ────────────────────────────────
        if (initialOptions.label) {
            const head = document.createElement('div');
            head.className = 'filter-stacked-head';
            const labelEl = document.createElement('span');
            labelEl.className = 'ui-label-sm';
            labelEl.textContent = initialOptions.label;
            if (initialOptions.required) {
                labelEl.innerHTML += ' <span style="color: var(--danger, #ef4444);">*</span>';
            }
            head.appendChild(labelEl);

            const actionsContainer = document.createElement('div');
            actionsContainer.style.cssText = 'display:flex;align-items:center;gap:12px;';

            const addAction = (act) => {
                const btn = document.createElement('span');
                btn.className = 'filter-stacked-create';
                if (act.icon) {
                    const icon = document.createElement('span');
                    icon.className = 'material-symbols-outlined';
                    icon.style.cssText = 'font-size:15px;vertical-align:middle;';
                    icon.textContent = act.icon;
                    if (window.DuckControls?.Tooltip) {
                        window.DuckControls.Tooltip.create(icon, { text: act.text, position: 'top' });
                    } else {
                        icon.title = act.text;
                    }
                    btn.appendChild(icon);
                } else {
                    btn.textContent = act.text;
                }
                if (act.color) btn.style.color = act.color;
                btn.addEventListener('click', act.onClick);
                actionsContainer.appendChild(btn);
            };

            if (initialOptions.actions) {
                initialOptions.actions.forEach(addAction);
            } else if (initialOptions.action) {
                addAction(initialOptions.action);
            }

            if (actionsContainer.children.length > 0) head.appendChild(actionsContainer);
            wrap.appendChild(head);
        }

        // ── State ────────────────────────────────────────────────
        let selectValue = initialOptions.value || '';
        let _optionsArr = Array.isArray(initialOptions.options)
            ? initialOptions.options.slice()
            : [];

        const getOptionsArr = () => _optionsArr;

        // ── Trigger button ──────────────────────────────────────
        const triggerBtn = document.createElement('button');
        triggerBtn.className = 'input-field-sm duck-custom-select';
        if (initialOptions.bgVariant === 'subtle') triggerBtn.classList.add('bg-subtle');
        triggerBtn.style.cssText = 'width:100%;display:flex;align-items:center;justify-content:space-between;';

        const textSpan = document.createElement('span');
        const selectedOpt = getOptionsArr().find(o => o.value === selectValue);
        textSpan.textContent = selectedOpt ? selectedOpt.label : (initialOptions.label || initialOptions.placeholder || 'Select...');
        textSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;text-align:left;font-size:13px;color:var(--text-primary);';

        const arrow = document.createElement('span');
        arrow.className = 'material-symbols-outlined duck-select-arrow-icon';
        arrow.textContent = 'expand_more';
        arrow.style.cssText = 'font-size:18px;color:var(--text-tertiary);transition:transform 0.2s;';

        triggerBtn.appendChild(textSpan);
        triggerBtn.appendChild(arrow);

        // ── Build context menu items from current _optionsArr ───────
        let _menuCtrl = null;
        let _itemButtons = [];

        const buildItems = () => {
            if (getOptionsArr().length === 0) {
                return [{ label: 'No records found', icon: 'inbox', disabled: true }];
            }
            return getOptionsArr().map(opt => ({
                label: opt.label,
                value: opt.value,
                icon: opt.icon,
                actions: opt.actions,
                disabled: !!opt.isPlaceholder
            }));
        };

        _menuCtrl = DuckControls.Dropdown.create(triggerBtn, {
            value: selectValue,
            items: buildItems(),
            matchTriggerWidth: true,
            onChange: (item) => {
                selectValue = item.value;
                textSpan.textContent = item.label;
                if (initialOptions.onChange) {
                    initialOptions.onChange({ target: { value: item.value } });
                }
            }
        });

        // Sync arrow rotation with menu open/close
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((m) => {
                if (m.attributeName === 'class') {
                    const isActive = _menuCtrl.menu.classList.contains('duck-dropdown-open');
                    arrow.style.transform = isActive ? 'rotate(180deg)' : 'rotate(0deg)';
                    if (isActive) {
                        triggerBtn.classList.add('focused');
                    } else {
                        triggerBtn.classList.remove('focused');
                    }
                }
            });
        });
        observer.observe(_menuCtrl.menu, { attributes: true });

        wrap.appendChild(triggerBtn);

        let _errorLabel = null;

        const setError = (message) => {
            triggerBtn.style.borderColor = 'var(--danger, #ef4444)';
            triggerBtn.style.background = 'rgba(239, 68, 68, 0.05)';
            triggerBtn.classList.add('is-error');

            if (!_errorLabel) {
                _errorLabel = document.createElement('div');
                _errorLabel.className = 'field-error-label';
                _errorLabel.style.cssText = 'font-size: 12px; color: var(--danger, #ef4444); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; font-weight: 500;';
                // Insert BEFORE the trigger button (at the top of the control)
                wrap.insertBefore(_errorLabel, triggerBtn);
            }
            _errorLabel.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;color:var(--danger,#ef4444)">error</span> ' + message;
            _errorLabel.style.display = 'flex';
        };

        const clearError = () => {
            triggerBtn.style.borderColor = '';
            triggerBtn.style.background = '';
            triggerBtn.classList.remove('is-error');
            if (_errorLabel) {
                _errorLabel.style.display = 'none';
            }
        };

        return {
            element: wrap,
            trigger: triggerBtn,

            getValue() { return selectValue; },

            setValue(val) {
                selectValue = val;
                const opt = getOptionsArr().find(o => o.value === val);
                // Show option label if found, otherwise show the value itself
                textSpan.textContent = opt ? opt.label : (val || initialOptions.placeholder || 'Select...');
                if (_menuCtrl) _menuCtrl.setSelectedValue(val);
                clearError();
            },

            /** Rebuild dropdown items when the options list changes (e.g. after CRUD) */
            setOptions(newOptions) {
                _optionsArr = Array.isArray(newOptions) ? newOptions.slice() : [];
                if (_menuCtrl) {
                    _menuCtrl.setItems(buildItems());
                }
                // Always sync display text to the currently selected value's label
                const opt = _optionsArr.find(o => o.value === selectValue);
                textSpan.textContent = opt ? opt.label : (initialOptions.placeholder || 'Select...');
            },

            getOptions() { return getOptionsArr(); },

            setError: setError,
            clearError: clearError
        };
    }
};
