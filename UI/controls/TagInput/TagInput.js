// TagInput.js

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    /**
     * TagInput
     * @param {Object} options
     * - label: string
     * - placeholder: string
     * - values: Array<string>
     * - onChange: function(values)
     */
    window.DuckControls.TagInput = {
        create(options = {}) {
            const wrap = document.createElement('div');
            wrap.className = 'duck-taginput-wrapper';

            if (options.label) {
                const label = document.createElement('label');
                label.className = 'duck-taginput-label';
                label.textContent = options.label;
                wrap.appendChild(label);
            }

            const container = document.createElement('div');
            container.className = 'duck-taginput-container';
            wrap.appendChild(container);

            let tags = Array.isArray(options.values) ? [...options.values] : [];
            
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'duck-taginput-input';
            input.placeholder = options.placeholder || 'Type and press Enter';

            const renderTags = () => {
                container.innerHTML = '';
                tags.forEach((tag, index) => {
                    const badge = document.createElement('span');
                    badge.className = 'duck-taginput-badge';
                    badge.textContent = tag;

                    const removeBtn = document.createElement('span');
                    removeBtn.className = 'material-symbols-outlined duck-taginput-remove';
                    removeBtn.textContent = 'close';
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        tags.splice(index, 1);
                        renderTags();
                        if (options.onChange) options.onChange([...tags]);
                    });

                    badge.appendChild(removeBtn);
                    container.appendChild(badge);
                });
                container.appendChild(input);
            };

            renderTags();

            let _errorLabel = null;

            container.addEventListener('click', () => {
                input.focus();
            });

            input.addEventListener('focus', () => container.classList.add('focused'));
            input.addEventListener('blur', () => {
                container.classList.remove('focused');
                // Optional: auto-add on blur if text is present
                if (input.value.trim() !== '') {
                    tags.push(input.value.trim());
                    input.value = '';
                    renderTags();
                    if (options.onChange) options.onChange([...tags]);
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const val = input.value.trim().replace(/,/g, '');
                    if (val && !tags.includes(val)) {
                        tags.push(val);
                        input.value = '';
                        renderTags();
                        input.focus();
                        if (options.onChange) options.onChange([...tags]);
                    }
                } else if (e.key === 'Backspace' && input.value === '' && tags.length > 0) {
                    tags.pop();
                    renderTags();
                    input.focus();
                    if (options.onChange) options.onChange([...tags]);
                } else if (e.key === '|') {
                    e.preventDefault(); // allow pipe as separator
                    const val = input.value.trim();
                    if (val && !tags.includes(val)) {
                        tags.push(val);
                        input.value = '';
                        renderTags();
                        input.focus();
                        if (options.onChange) options.onChange([...tags]);
                    }
                }
            });

            return {
                element: wrap,
                getValues: () => [...tags],
                setValues: (newTags) => {
                    tags = Array.isArray(newTags) ? [...newTags] : [];
                    renderTags();
                },
                setError: (message) => {
                    container.style.borderColor = 'var(--danger, var(--danger))';
                    container.style.background = 'rgba(239, 68, 68, 0.05)';
                    container.classList.add('is-error');

                    if (!_errorLabel) {
                        _errorLabel = document.createElement('div');
                        _errorLabel.className = 'field-error-label';
                        _errorLabel.style.cssText = 'font-size: 12px; color: var(--danger, var(--danger)); margin-bottom: 4px; display: flex; align-items: center; gap: 6px; font-weight: 500;';
                        wrap.prepend(_errorLabel);
                    }
                    _errorLabel.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px;color:var(--danger,var(--danger))">error</span> ' + message;
                    _errorLabel.style.display = 'flex';
                },
                clearError: () => {
                    container.style.borderColor = '';
                    container.style.background = '';
                    container.classList.remove('is-error');
                    if (_errorLabel) {
                        _errorLabel.style.display = 'none';
                    }
                }
            };
        }
    };
})();

