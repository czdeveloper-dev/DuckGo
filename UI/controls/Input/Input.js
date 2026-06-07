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
                label.innerHTML += ' <span style="color: var(--danger, #ef4444);">*</span>';
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
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined search-icon';
            icon.textContent = options.icon;
            inputWrap.appendChild(icon);
        }
        
        const input = document.createElement('input');
        input.type = 'text';
        if (options.placeholder) input.placeholder = options.placeholder;
        if (options.value) input.value = options.value;
        if (options.id) input.id = options.id;
        if (options.onInput) input.addEventListener('input', options.onInput);
        
        inputWrap.appendChild(input);
        wrap.appendChild(inputWrap);

        let _errorLabel = null;

        const setError = (message) => {
            inputWrap.style.borderColor = 'var(--danger, #ef4444)';
            inputWrap.style.background = 'rgba(239, 68, 68, 0.05)';
            inputWrap.classList.add('is-error');

            if (!_errorLabel) {
                _errorLabel = document.createElement('div');
                _errorLabel.className = 'field-error-label';
                _errorLabel.style.cssText = 'font-size: 12px; color: var(--danger, #ef4444); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; font-weight: 500;';
                // Insert BEFORE the inputWrap (at the top of the control)
                wrap.insertBefore(_errorLabel, inputWrap);
            }
            _errorLabel.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;color:var(--danger,#ef4444)">error</span> ' + message;
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
