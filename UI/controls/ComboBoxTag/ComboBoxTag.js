// ComboBoxTag.js
(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    window.DuckControls.ComboBoxTag = {
        /**
         * @param {Object} options
         * - label: string
         * - placeholder: string
         * - options: Array<{label: string, value: string}> (predefined options)
         * - values: Array<string> (current values)
         * - onChange: function(values)
         * - allowCustom: boolean (default true)
         */
        create(options = {}) {
            let tags = Array.isArray(options.values) ? [...options.values] : [];
            let allOptions = options.options || [];

            // Use DuckControls.Input instead of native input to inherit styling and features
            const inputCtrl = window.DuckControls.Input.create({
                label: options.label,
                placeholder: options.placeholder || 'Type and press Enter'
            });

            const wrap = inputCtrl.element;
            const input = inputCtrl.input;
            const inputWrap = input.parentElement; // This is the .search-box
            
            // Adjust inputWrap to look like a flex tag container
            inputWrap.style.display = 'flex';
            inputWrap.style.flexWrap = 'wrap';
            inputWrap.style.gap = '4px';
            inputWrap.style.height = 'auto';
            inputWrap.style.minHeight = '32px';
            inputWrap.style.padding = '4px 8px';
            inputWrap.style.alignItems = 'center';
            inputWrap.style.cursor = 'text';
            inputWrap.style.lineHeight = 'normal';
            inputWrap.style.boxSizing = 'border-box';
            
            // Remove the default styling from input to fit nicely inside the flex container
            input.style.flex = '1';
            input.style.minWidth = '80px';
            input.style.border = 'none';
            input.style.padding = '0';
            input.style.background = 'transparent';
            input.style.outline = 'none';
            
            let dropdown = null;

            const renderTags = () => {
                // Remove existing badges from inputWrap
                const existingBadges = inputWrap.querySelectorAll('.duck-comboboxtag-badge');
                existingBadges.forEach(b => b.remove());

                tags.forEach((tag, index) => {
                    const badge = document.createElement('span');
                    badge.className = 'duck-comboboxtag-badge';
                    
                    // Display label if available
                    const opt = allOptions.find(o => String(o.value) === String(tag) || o.label === tag);
                    badge.textContent = opt ? opt.label : tag;

                    const removeBtn = document.createElement('span');
                    removeBtn.className = 'material-symbols-outlined duck-comboboxtag-remove';
                    removeBtn.textContent = 'close';
                    removeBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        tags.splice(index, 1);
                        renderTags();
                        if (options.onChange) options.onChange([...tags]);
                        if (dropdown) dropdown.close();
                    });

                    badge.appendChild(removeBtn);
                    inputWrap.insertBefore(badge, input);
                });
            };

            renderTags();

            inputWrap.addEventListener('click', (e) => {
                input.focus();
                updateDropdown();
                e.stopImmediatePropagation();
            });

            if (window.DuckControls.Dropdown) {
                dropdown = window.DuckControls.Dropdown.create(inputWrap, {
                    items: [], // updated dynamically based on input
                    matchTriggerWidth: true,
                    onChange: (item) => {
                        if (item.value && !tags.includes(String(item.value))) {
                            tags.push(String(item.value));
                            input.value = '';
                            renderTags();
                            if (options.onChange) options.onChange([...tags]);
                        }
                        input.focus();
                    }
                });
            }

            const updateDropdown = () => {
                if (!dropdown) return;
                const val = input.value.trim().toLowerCase();
                let filtered = allOptions;
                
                // Exclude already added tags
                filtered = filtered.filter(o => !tags.includes(String(o.value)) && !tags.includes(o.label));
                
                if (val) {
                    filtered = filtered.filter(o => o.label.toLowerCase().includes(val) || String(o.value).toLowerCase().includes(val));
                }
                
                if (filtered.length > 0) {
                    dropdown.setItems(filtered);
                    dropdown.open();
                } else {
                    dropdown.close();
                }
            };

            input.addEventListener('focus', () => {
                inputWrap.classList.add('focused');
                updateDropdown();
            });
            
            input.addEventListener('blur', (e) => {
                // Delay to allow clicking dropdown item
                setTimeout(() => {
                    if (document.activeElement !== input) {
                        inputWrap.classList.remove('focused');
                        // Optional: auto-add on blur if text is present and custom is allowed
                        const allowCustom = options.allowCustom !== false;
                        if (allowCustom && input.value.trim() !== '') {
                            const val = input.value.trim();
                            if (!tags.includes(val)) {
                                tags.push(val);
                                renderTags();
                                if (options.onChange) options.onChange([...tags]);
                            }
                            input.value = '';
                        }
                        if (dropdown) dropdown.close();
                    }
                }, 150);
            });

            input.addEventListener('input', () => {
                updateDropdown();
            });

            input.addEventListener('keydown', (e) => {
                const allowCustom = options.allowCustom !== false;
                
                if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    
                    const val = input.value.trim().replace(/,/g, '');
                    if (val) {
                        // Try to find exact match
                        const exact = allOptions.find(o => o.label.toLowerCase() === val.toLowerCase() || String(o.value).toLowerCase() === val.toLowerCase());
                        const finalVal = exact ? String(exact.value) : val;
                        
                        if ((exact || allowCustom) && !tags.includes(finalVal)) {
                            tags.push(finalVal);
                            input.value = '';
                            renderTags();
                            updateDropdown();
                            if (options.onChange) options.onChange([...tags]);
                        }
                    }
                } else if (e.key === 'Backspace' && input.value === '' && tags.length > 0) {
                    tags.pop();
                    renderTags();
                    updateDropdown();
                    if (options.onChange) options.onChange([...tags]);
                }
            });

            return {
                element: wrap,
                getValues: () => [...tags],
                setValues: (newTags) => {
                    tags = Array.isArray(newTags) ? [...newTags] : [];
                    renderTags();
                },
                setOptions: (newOpts) => {
                    allOptions = newOpts || [];
                    if (dropdown && dropdown.options) {
                        dropdown.close();
                        updateDropdown();
                    }
                },
                destroy: () => {
                    if (dropdown) dropdown.destroy();
                }
            };
        }
    };
})();
