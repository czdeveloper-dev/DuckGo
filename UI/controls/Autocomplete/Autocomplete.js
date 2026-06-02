// Autocomplete.js - Searchable Input with floating dropdown

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    /**
     * Autocomplete Control
     * Options:
     *   - label: string
     *   - placeholder: string
     *   - icon: string (Material icon)
     *   - onSearch: async function(query) => [{label, value, ...data}]
     *   - onSelect: function(option)
     *   - debounce: number (ms, default 300)
     */
    window.DuckControls.Autocomplete = {
        create(container, options = {}) {
            // Group wrapper (label + input)
            const group = document.createElement('div');
            group.className = 'duck-autocomplete-group';

            if (options.label) {
                const label = document.createElement('label');
                label.className = 'duck-autocomplete-label';
                label.textContent = options.label;
                group.appendChild(label);
            }

            // Input wrapper
            const wrap = document.createElement('div');
            wrap.className = 'duck-autocomplete';

            if (options.icon) {
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined duck-autocomplete-icon';
                icon.textContent = options.icon;
                wrap.appendChild(icon);
            }

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'duck-autocomplete-input';
            if (options.placeholder) input.placeholder = options.placeholder;
            wrap.appendChild(input);

            group.appendChild(wrap);

            // Initialize Dropdown Control
            let dropdown = null;
            if (window.DuckControls && window.DuckControls.Dropdown) {
                dropdown = window.DuckControls.Dropdown.create(wrap, {
                    items: [], // empty initially
                    width: '100%' // let it stretch
                });
            }

            let timeoutId = null;

            const renderResults = (results) => {
                if (!dropdown) return;

                if (!results || results.length === 0) {
                    dropdown.setItems([{ label: 'No results found', disabled: true }]);
                    dropdown.open();
                    return;
                }

                const items = results.map(res => ({
                    label: res.label,
                    value: res.value,
                    onClick: () => {
                        input.value = res.label;
                        if (options.onSelect) options.onSelect(res);
                        dropdown.close();
                    }
                }));

                dropdown.setItems(items);
                dropdown.open();
            };

            input.addEventListener('input', (e) => {
                const query = e.target.value.trim();
                if (timeoutId) clearTimeout(timeoutId);

                if (!query) {
                    if (dropdown) dropdown.close();
                    return;
                }

                timeoutId = setTimeout(async () => {
                    if (dropdown) {
                        dropdown.setItems([{ label: 'Searching...', disabled: true }]);
                        dropdown.open();
                    }

                    try {
                        const results = await options.onSearch(query);
                        renderResults(results);
                    } catch (err) {
                        console.error('Autocomplete search error:', err);
                        renderResults([]);
                    }
                }, options.debounce || 300);
            });

            input.addEventListener('focus', () => {
                if (input.value.trim() && dropdown && dropdown.options.items.length > 0) {
                    dropdown.open();
                }
            });

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    if (dropdown) dropdown.close();
                }, 200);
            });

            if (container) container.appendChild(group);

            return {
                element: group,
                input,
                getValue: () => input.value,
                setValue: (val) => { input.value = val; },
                destroy: () => {
                    if (timeoutId) clearTimeout(timeoutId);
                    if (dropdown) dropdown.destroy();
                }
            };
        }
    };
})();
