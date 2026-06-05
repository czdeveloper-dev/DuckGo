// Dropdown.js - Dropdown control component

(function() {
    'use strict';

    class Dropdown {
        constructor(trigger, options = {}) {
            this.trigger = trigger;
            this.options = options;
            this.isOpen = false;
            this.menu = null;
            this.selectedValue = options.value || '';
            this.selectedValues = Array.isArray(options.values) ? [...options.values] : [];
            this._boundHandleClick = this._handleClick.bind(this);
            this._boundHandleKeydown = this._handleKeydown.bind(this);
            this._boundHandleOutsideClick = this._handleOutsideClick.bind(this);
            this._boundHandlePopupOpened = this._handlePopupOpened.bind(this);
            this._boundHandleScroll = this._handleScroll.bind(this);

            this._init();
        }

        _init() {
            // Create menu element
            this.menu = document.createElement('div');
            this.menu.className = 'duck-dropdown-menu';
            this.menu.style.display = 'none';
            this.menu.setAttribute('role', 'listbox');

            if (this.options.items && Array.isArray(this.options.items)) {
                this._renderItems();
            }

            // Position menu
            this._positionMenu();

            // Add to DOM
            document.body.appendChild(this.menu);

            // Event listeners
            this.trigger.addEventListener('click', this._boundHandleClick);
            this.trigger.addEventListener('keydown', this._boundHandleKeydown);
            document.addEventListener('click', this._boundHandleOutsideClick);

            // Close on escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            });

            // Mutual exclusion for popups
            window.addEventListener('duck-popup-opened', this._boundHandlePopupOpened);
            
            // Close on outside scroll
            window.addEventListener('scroll', this._boundHandleScroll, { capture: true });
        }
        
        _handleScroll(e) {
            if (this.isOpen) {
                // If the scroll target is the menu itself or inside the menu, do nothing
                if (this.menu && (e.target === this.menu || this.menu.contains(e.target))) {
                    return;
                }
                this.close();
            }
        }

        _renderItems() {
            this.menu.innerHTML = '';

            this.options.items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'duck-dropdown-item';
                el.setAttribute('role', 'option');

                if (item.disabled) {
                    el.classList.add('disabled');
                }

                if (!this.options.multi) {
                    if (item.value === this.selectedValue) {
                        el.classList.add('selected');
                    }
                }

                if (this.options.multi && window.DuckControls && window.DuckControls.Checkbox) {
                    const cbWrap = document.createElement('div');
                    cbWrap.style.cssText = 'width: 100%; display: flex; overflow: hidden;';
                    cbWrap.style.pointerEvents = 'none'; // let the row handle the click
                    window.DuckControls.Checkbox.create(cbWrap, { label: item.label, checked: this.selectedValues.includes(item.value) });
                    const lbl = cbWrap.querySelector('.duck-checkbox-label');
                    if (lbl) {
                        lbl.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;';
                    }
                    el.appendChild(cbWrap);
                } else {
                    if (item.icon) {
                        const icon = document.createElement('span');
                        icon.className = 'material-symbols-outlined duck-dropdown-icon';
                        icon.textContent = item.icon;
                        el.appendChild(icon);
                    }

                    if (item.label) {
                        const label = document.createElement('span');
                        label.className = 'duck-dropdown-label';
                        label.textContent = item.label;
                        label.style.cssText = 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;';
                        el.appendChild(label);
                    }

                    if (item.description) {
                        const desc = document.createElement('span');
                        desc.className = 'duck-dropdown-desc';
                        desc.textContent = item.description;
                        el.appendChild(desc);
                    }
                }

                if (item.actions && item.actions.length > 0) {
                    const acts = document.createElement('div');
                    acts.className = 'duck-dropdown-item-actions';
                    acts.style.cssText = 'display: flex; gap: 8px; margin-left: auto; align-items: center; padding-left: 8px; z-index: 2;';
                    
                    item.actions.forEach(act => {
                        const btn = document.createElement('span');
                        btn.className = `material-symbols-outlined duck-dropdown-item-action ${act.danger ? 'danger' : ''}`;
                        btn.style.cssText = 'font-size: 16px; cursor: pointer; color: var(--text-secondary); transition: color 0.2s;';
                        btn.textContent = act.icon;
                        
                        btn.addEventListener('click', (e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            if (act.onClick) act.onClick(e); 
                            this.close(); 
                        });
                        
                        btn.addEventListener('mouseenter', () => btn.style.color = act.danger ? 'var(--danger)' : 'var(--accent)');
                        btn.addEventListener('mouseleave', () => btn.style.color = 'var(--text-secondary)');
                        
                        acts.appendChild(btn);
                    });
                    el.appendChild(acts);
                }

                el.addEventListener('click', (e) => {
                    if (!item.disabled) {
                        if (this.options.multi) {
                            e.preventDefault();
                            e.stopPropagation();
                            const valIdx = this.selectedValues.indexOf(item.value);
                            if (valIdx > -1) {
                                this.selectedValues.splice(valIdx, 1);
                            } else {
                                this.selectedValues.push(item.value);
                            }
                            this._renderItems();
                            if (this.options.onChange) {
                                this.options.onChange(this.selectedValues);
                            }
                        } else {
                            this._selectItem(item);
                        }
                    }
                });

                this.menu.appendChild(el);
            });
        }

        _positionMenu() {
            const rect = this.trigger.getBoundingClientRect();
            let widthVal = 200;
            if (this.options.width === '100%') {
                widthVal = rect.width;
            } else if (this.options.width) {
                widthVal = parseInt(this.options.width) || 200;
            }

            let left = rect.left;
            if (left + widthVal > window.innerWidth) {
                left = window.innerWidth - widthVal - 8;
            }

            const spaceBelow = window.innerHeight - rect.bottom - 8;
            const spaceAbove = rect.top - 8;
            
            let isUp = false;
            let maxHeight = 300;

            if (spaceBelow < 250 && spaceAbove > spaceBelow) {
                isUp = true;
            }

            if (isUp) {
                this.menu.style.top = `${rect.top - 4}px`;
                this.menu.classList.add('duck-dropdown-up');
                maxHeight = Math.min(300, spaceAbove);
            } else {
                this.menu.style.top = `${rect.bottom + 4}px`;
                this.menu.classList.remove('duck-dropdown-up');
                maxHeight = Math.min(300, spaceBelow);
            }

            this.menu.style.maxHeight = `${maxHeight}px`;
            this.menu.style.left = `${left}px`;
            
            if (this.options.width === '100%' || this.options.matchTriggerWidth) {
                this.menu.style.width = `${rect.width}px`;
            } else {
                this.menu.style.minWidth = `${Math.max(rect.width, widthVal)}px`;
            }
        }

        _handleClick(e) {
            this.toggle();
        }

        _handleKeydown(e) {
            if (e.key === 'Enter' || (e.key === ' ' && this.trigger.tagName !== 'INPUT' && this.trigger.tagName !== 'TEXTAREA')) {
                e.preventDefault();
                this.toggle();
            }
        }

        _handleOutsideClick(e) {
            if (this.isOpen && !this.menu.contains(e.target) && (!this.trigger || !this.trigger.contains(e.target))) {
                this.close();
            }
        }

        _handlePopupOpened(e) {
            if (this.isOpen && e.detail && e.detail.source !== this) {
                this.close();
            }
        }

        toggle() {
            this.isOpen ? this.close() : this.open();
        }

        open() {
            if (this.isOpen || this.options.disabled) return;
            
            // Do not open if trigger is not visible (e.g., hidden tab or off-dom)
            if (this.trigger) {
                const rect = this.trigger.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return;
            }

            this.isOpen = true;
            this.menu.style.display = 'block';
            requestAnimationFrame(() => {
                this._positionMenu();
                this.menu.classList.add('duck-dropdown-open');
                this.trigger.classList.add('duck-dropdown-active');
            });
            window.dispatchEvent(new CustomEvent('duck-popup-opened', { detail: { source: this } }));
        }

        close() {
            this.isOpen = false;
            this.menu.classList.remove('duck-dropdown-open');
            this.trigger.classList.remove('duck-dropdown-active');
            setTimeout(() => {
                if (!this.isOpen && this.menu) {
                    this.menu.style.display = 'none';
                }
            }, 200);
        }

        _selectItem(item) {
            this.setSelectedValue(item.value);
            this.close();

            // Update trigger content
            if (this.options.onChange) {
                this.options.onChange(item);
            }
        }

        setSelectedValue(val) {
            this.selectedValue = val;
            this._renderItems();
        }

        setSelectedValues(vals) {
            this.selectedValues = Array.isArray(vals) ? [...vals] : [];
            this._renderItems();
        }

        setItems(items) {
            this.options.items = items;
            this._renderItems();
        }

        destroy() {
            this.trigger.removeEventListener('click', this._boundHandleClick);
            this.trigger.removeEventListener('keydown', this._boundHandleKeydown);
            document.removeEventListener('click', this._boundHandleOutsideClick);
            window.removeEventListener('duck-popup-opened', this._boundHandlePopupOpened);
            window.removeEventListener('scroll', this._boundHandleScroll, { capture: true });
            if (this.menu.parentNode) {
                this.menu.parentNode.removeChild(this.menu);
            }
        }
    }

    // Auto-initialize dropdowns
    window.DuckControls = window.DuckControls || {};

    window.DuckControls.Dropdown = {
        create(trigger, options) {
            return new Dropdown(trigger, options);
        },

        initAll() {
            document.querySelectorAll('[data-dropdown]').forEach(trigger => {
                if (!trigger._dropdown) {
                    const options = JSON.parse(trigger.dataset.dropdownOptions || '{}');
                    trigger._dropdown = new Dropdown(trigger, options);
                }
            });
        }
    };

    // Initialize on DOMContentLoaded
    window.addEventListener('DOMContentLoaded', () => {
        window.DuckControls.Dropdown.initAll();
    });
})();
