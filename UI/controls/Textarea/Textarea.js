// Textarea.js - Multiline text input component

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    window.DuckControls.Textarea = {
        /**
         * options:
         * - label: string (optional)
         * - placeholder: string
         * - value: string
         * - rows: number
         * - onInput: function(e)
         * - required: boolean (optional)
         */
        create(options = {}) {
            const wrap = document.createElement('div');
            wrap.className = 'duck-textarea-wrap';

            let _required = options.required || false;
            let _errorLabel = null;

            if (options.label) {
                const label = document.createElement('div');
                label.className = 'duck-textarea-label';
                label.innerHTML = (options.label || '') + (_required ? ' <span style="color: var(--danger, var(--danger));">*</span>' : '');
                wrap.appendChild(label);
            }

            const inputContainer = document.createElement('div');
            inputContainer.style.position = 'relative';
            inputContainer.style.display = 'flex';
            if (options.fullHeight) {
                inputContainer.style.flex = '1';
                inputContainer.style.height = '100%';
            }

            if (options.icon) {
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined duck-textarea-icon';
                icon.textContent = options.icon;
                inputContainer.appendChild(icon);
            }

            const textarea = document.createElement('textarea');
            textarea.className = 'duck-textarea';
            if (options.icon) {
                textarea.style.paddingLeft = '36px';
            }

            if (options.placeholder) textarea.placeholder = options.placeholder;
            if (options.value) textarea.value = options.value;
            if (options.rows) textarea.rows = options.rows;
            else textarea.rows = 4; // Default to 4 rows

            if (options.fullHeight) {
                wrap.style.height = '100%'; wrap.style.display = 'flex'; wrap.style.flexDirection = 'column';
                textarea.style.flex = '1';
                textarea.style.resize = 'none';
            }

            inputContainer.appendChild(textarea);
            wrap.appendChild(inputContainer);

            const setError = (message) => {
                textarea.style.borderColor = 'var(--danger, var(--danger))';
                textarea.style.background = 'rgba(239, 68, 68, 0.05)';
                if (!_errorLabel) {
                    _errorLabel = document.createElement('div');
                    _errorLabel.className = 'field-error-label';
                    _errorLabel.style.cssText = 'font-size: 12px; color: var(--danger, var(--danger)); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; font-weight: 500;';
                    wrap.prepend(_errorLabel);
                }
                _errorLabel.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;color:var(--danger,var(--danger))">error</span> ' + message;
                _errorLabel.style.display = 'flex';
            };
            const clearError = () => {
                textarea.style.borderColor = '';
                textarea.style.background = '';
                if (_errorLabel) _errorLabel.style.display = 'none';
            };

            if (options.onInput) {
                textarea.addEventListener('input', (e) => {
                    clearError();
                    options.onInput(e);
                });
            } else {
                textarea.addEventListener('input', () => clearError());
            }

            return {
                element: wrap,
                textarea: textarea,
                getValue: () => textarea.value,
                setValue: (val) => { textarea.value = val; clearError(); },
                setError,
                clearError,
                isRequired: () => _required,
                validate: () => {
                    if (_required && !textarea.value.trim()) {
                        setError('This field is required');
                        return false;
                    }
                    return true;
                }
            };
        }
    };
})();


