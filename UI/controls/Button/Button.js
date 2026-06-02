// Button.js - Button control component

(function() {
    'use strict';

    class Button {
        constructor(element, options = {}) {
            this.element = element instanceof HTMLElement ? element : document.querySelector(element);
            this.options = {
                variant: options.variant || 'secondary',
                size: options.size || 'md',
                disabled: options.disabled || false,
                loading: options.loading || false,
                spinning: options.spinning || false,
                icon: options.icon || null,
                text: options.text || null,
                iconPosition: options.iconPosition || 'left',
                dropdownArrow: options.dropdownArrow || false,
                fontWeight: options.fontWeight || null,
                fontStyle: options.fontStyle || null,
                style: options.style || null,
                onClick: options.onClick || null,
                ...options
            };

            this._boundClick = this._handleClick.bind(this);
            this._init();
        }

        _init() {
            // Add base class
            this.element.classList.add('duck-btn');

            // Set variant
            this.setVariant(this.options.variant);

            // Set size
            this.setSize(this.options.size);

            // Set icon
            if (this.options.icon) {
                this.setIcon(this.options.icon, this.options.iconPosition);
                // Auto-detect icon-only: no text → make it a proper square icon button
                if (!this.options.text) {
                    this.element.classList.add('duck-btn-icon-only');
                }
            }

            // Set loading
            if (this.options.loading) {
                this.setLoading(true);
            }

            // Set text
            if (this.options.text) {
                this.setText(this.options.text);
            }

            // Set dropdown arrow
            if (this.options.dropdownArrow) {
                this.setDropdownArrow(true);
            }

            // Set spinning
            if (this.options.spinning) {
                this.setSpinning(true);
            }

            // Set disabled
            if (this.options.disabled) {
                this.setDisabled(true);
            }

            // Set custom styles if provided
            if (this.options.fontWeight) {
                this.element.style.fontWeight = this.options.fontWeight;
            }
            if (this.options.fontStyle) {
                this.element.style.fontStyle = this.options.fontStyle;
            }
            if (this.options.style) {
                Object.assign(this.element.style, this.options.style);
            }

            // Click handler
            this.element.addEventListener('click', this._boundClick);
        }

        _handleClick(e) {
            if (this.options.disabled || this.options.loading) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }

            if (this.options.onClick) {
                this.options.onClick(e);
            }
        }

        setVariant(variant) {
            this.element.classList.remove('duck-btn-primary', 'duck-btn-secondary', 'duck-btn-ghost', 'duck-btn-danger', 'duck-btn-success', 'duck-btn-chip', 'duck-btn-subtle', 'duck-btn-surface');
            this.element.classList.add(`duck-btn-${variant}`);
            this.options.variant = variant;
        }

        setSize(size) {
            this.element.classList.remove('duck-btn-sm', 'duck-btn-md', 'duck-btn-lg');
            this.element.classList.add(`duck-btn-${size}`);
            this.options.size = size;
        }

        setIcon(icon, position = 'left') {
            // Remove existing icon
            const existingIcon = this.element.querySelector('.duck-btn-icon');
            if (existingIcon) existingIcon.remove();

            const iconEl = document.createElement('span');
            iconEl.className = 'material-symbols-outlined duck-btn-icon';
            iconEl.textContent = icon;

            if (position === 'left') {
                this.element.prepend(iconEl);
            } else {
                this.element.append(iconEl);
            }

            this.options.icon = icon;
            this.options.iconPosition = position;
        }

        setText(text) {
            this.options.text = text;
            let textNode = Array.from(this.element.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
            if (!textNode) {
                textNode = document.createTextNode(text);
                const dropdownArrow = this.element.querySelector('.duck-btn-dropdown-arrow');
                if (dropdownArrow) {
                    this.element.insertBefore(textNode, dropdownArrow);
                } else {
                    this.element.appendChild(textNode);
                }
            } else {
                textNode.textContent = text;
            }
        }

        setDropdownArrow(show) {
            const existingArrow = this.element.querySelector('.duck-btn-dropdown-arrow');
            if (show) {
                if (!existingArrow) {
                    const arrowEl = document.createElement('span');
                    arrowEl.className = 'material-symbols-outlined duck-btn-dropdown-arrow';
                    arrowEl.textContent = 'expand_more';
                    arrowEl.style.fontSize = '16px';
                    arrowEl.style.marginLeft = '2px';
                    this.element.appendChild(arrowEl);
                }
            } else if (existingArrow) {
                existingArrow.remove();
            }
        }

        setLoading(loading) {
            this.options.loading = loading;
            this.element.classList.toggle('duck-btn-loading', loading);
            if (loading) {
                this.element.setAttribute('disabled', 'disabled');
            } else if (!this.options.disabled) {
                this.element.removeAttribute('disabled');
            }
        }

        setSpinning(spinning) {
            this.options.spinning = spinning;
            this.element.classList.toggle('duck-btn-spin', spinning);
        }

        setDisabled(disabled) {
            this.options.disabled = disabled;
            this.element.classList.toggle('duck-btn-disabled', disabled);
            this.element.disabled = disabled;
        }

        destroy() {
            this.element.removeEventListener('click', this._boundClick);
            this.element.classList.remove('duck-btn', 'duck-btn-primary', 'duck-btn-secondary', 'duck-btn-ghost', 'duck-btn-danger', 'duck-btn-success', 'duck-btn-sm', 'duck-btn-md', 'duck-btn-lg', 'duck-btn-loading', 'duck-btn-disabled');
        }
    }

    // Button API
    window.DuckControls = window.DuckControls || {};

    window.DuckControls.Button = {
        create(element, options) {
            return new Button(element, options);
        },

        initAll() {
            document.querySelectorAll('[data-btn]').forEach(el => {
                if (el._duckButton) return;

                const options = JSON.parse(el.dataset.btnOptions || '{}');
                el._duckButton = new Button(el, options);
            });
        }
    };

    // Auto-initialize on DOMContentLoaded
    window.addEventListener('DOMContentLoaded', () => {
        window.DuckControls.Button.initAll();
    });
})();
