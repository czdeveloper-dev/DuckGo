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
            this._boundHandleClick = this._handleClick.bind(this);
            this._boundHandleKeydown = this._handleKeydown.bind(this);
            this._boundHandleOutsideClick = this._handleOutsideClick.bind(this);

            this._init();
        }

        _init() {
            // Create menu element
            this.menu = document.createElement('div');
            this.menu.className = 'duck-dropdown-menu';
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

                if (item.value === this.selectedValue) {
                    el.classList.add('selected');
                }

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
                    el.appendChild(label);
                }

                if (item.description) {
                    const desc = document.createElement('span');
                    desc.className = 'duck-dropdown-desc';
                    desc.textContent = item.description;
                    el.appendChild(desc);
                }

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!item.disabled) {
                        this._selectItem(item);
                    }
                });

                this.menu.appendChild(el);
            });
        }

        _positionMenu() {
            const rect = this.trigger.getBoundingClientRect();
            const menuWidth = this.options.width || 200;

            let top = rect.bottom + 4;
            let left = rect.left;

            // Check if menu would go off screen
            if (left + menuWidth > window.innerWidth) {
                left = window.innerWidth - menuWidth - 8;
            }

            if (top + 200 > window.innerHeight) {
                top = rect.top - 4;
                this.menu.classList.add('duck-dropdown-up');
            } else {
                this.menu.classList.remove('duck-dropdown-up');
            }

            this.menu.style.top = `${top}px`;
            this.menu.style.left = `${left}px`;
            this.menu.style.minWidth = `${Math.max(rect.width, menuWidth)}px`;
        }

        _handleClick(e) {
            e.stopPropagation();
            this.toggle();
        }

        _handleKeydown(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            }
        }

        _handleOutsideClick(e) {
            if (this.isOpen && !this.menu.contains(e.target) && e.target !== this.trigger) {
                this.close();
            }
        }

        toggle() {
            this.isOpen ? this.close() : this.open();
        }

        open() {
            this.isOpen = true;
            this._positionMenu();
            this.menu.classList.add('duck-dropdown-open');
            this.trigger.classList.add('duck-dropdown-active');
        }

        close() {
            this.isOpen = false;
            this.menu.classList.remove('duck-dropdown-open');
            this.trigger.classList.remove('duck-dropdown-active');
        }

        _selectItem(item) {
            this.selectedValue = item.value;
            this.close();

            // Update trigger content
            if (this.options.onChange) {
                this.options.onChange(item);
            }
        }

        setItems(items) {
            this.options.items = items;
            this._renderItems();
        }

        destroy() {
            this.trigger.removeEventListener('click', this._boundHandleClick);
            this.trigger.removeEventListener('keydown', this._boundHandleKeydown);
            document.removeEventListener('click', this._boundHandleOutsideClick);
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
