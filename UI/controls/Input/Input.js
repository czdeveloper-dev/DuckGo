window.DuckControls = window.DuckControls || {};
window.DuckControls.Input = {
    create(options) {
        const wrap = document.createElement('div');
        wrap.className = 'filter-stacked';
        if (options.fullWidth) wrap.classList.add('full-width');
        if (options.width) wrap.style.width = options.width;
        if (options.required) wrap.setAttribute('data-required', 'true');
        
        if (options.label) {
            const head = document.createElement('div');
            head.className = 'filter-stacked-head';
            const label = document.createElement('span');
            label.className = 'ui-label-sm';
            label.textContent = options.label;
            if (options.required) {
                label.innerHTML += ' <span style="color: var(--danger, var(--danger));">*</span>';
            }
            head.appendChild(label);
            wrap.appendChild(head);
        }
        
        const inputWrap = document.createElement('div');
        inputWrap.className = 'search-box search-compact';
        if (options.bgVariant === 'subtle') inputWrap.classList.add('bg-subtle');
        inputWrap.style.width = '100%';
        inputWrap.style.maxWidth = 'none';
        
        if (options.icon) {
            if (options.icon.includes('.') || options.icon.includes('/')) {
                const icon = document.createElement('img');
                icon.src = options.icon;
                icon.className = 'search-icon';
                icon.style.cssText = 'width: 16px; height: 16px; object-fit: contain; pointer-events: none;';
                inputWrap.appendChild(icon);
            } else {
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined search-icon';
                icon.textContent = options.icon;
                inputWrap.appendChild(icon);
            }
        }
        
        const input = document.createElement('input');
        input.type = 'text';
        if (options.placeholder) input.placeholder = options.placeholder;
        if (options.value) input.value = options.value;
        if (options.id) input.id = options.id;
        if (options.autofocus) input.autofocus = true;
        if (options.tabIndex !== undefined) input.tabIndex = options.tabIndex;
        if (options.onInput) input.addEventListener('input', options.onInput);
        
        inputWrap.appendChild(input);
        wrap.appendChild(inputWrap);

        let _errorLabel = null;

        const setError = (message) => {
            inputWrap.style.borderColor = 'var(--danger, var(--danger))';
            inputWrap.style.background = 'rgba(239, 68, 68, 0.05)';
            inputWrap.classList.add('is-error');

            if (!_errorLabel) {
                _errorLabel = document.createElement('div');
                _errorLabel.className = 'field-error-label';
                _errorLabel.style.cssText = 'font-size: 12px; color: var(--danger, var(--danger)); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; font-weight: 500;';
                // Insert at the top of the control
                wrap.prepend(_errorLabel);
            }
            _errorLabel.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;color:var(--danger,var(--danger))">error</span> ' + message;
            _errorLabel.style.display = 'flex';
        };

        const clearError = () => {
            inputWrap.style.borderColor = '';
            inputWrap.style.background = '';
            inputWrap.classList.remove('is-error');
            if (_errorLabel) {
                _errorLabel.style.display = 'none';
            }
        };

        input.addEventListener('input', clearError);
        input.addEventListener('change', clearError);
        
        return {
            element: wrap,
            input: input,
            getValue: () => input.value,
            setValue: (val) => { input.value = val; clearError(); },
            setError: setError,
            clearError: clearError
        };
    }
};

