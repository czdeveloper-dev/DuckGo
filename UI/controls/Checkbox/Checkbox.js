// Checkbox.js - Custom Checkbox Control

(function() {
    'use strict';

    class Checkbox {
        constructor(element, options = {}) {
            if (!element) {
                element = document.createElement('label');
                element.className = 'duck-checkbox-wrap'; // just to make sure it's valid
            }
            this.element = element instanceof HTMLElement ? element : document.querySelector(element);
            this.options = {
                checked: options.checked || false,
                disabled: options.disabled || false,
                label: options.label || null,
                indeterminate: options.indeterminate || false,
                onChange: options.onChange || null,
                ...options
            };

            this._boundChange = this._handleChange.bind(this);
            this._init();
        }

        _init() {
            this.element.classList.add('duck-checkbox');
            this.element.innerHTML = `
                <span class="duck-checkbox-box">
                    <span class="duck-checkbox-check"></span>
                </span>
                ${this.options.label ? `<span class="duck-checkbox-label">${this.options.label}</span>` : ''}
            `;

            this._box = this.element.querySelector('.duck-checkbox-box');
            this._check = this.element.querySelector('.duck-checkbox-check');

            if (this.options.checked) {
                this._box.classList.add('is-checked');
            }
            if (this.options.indeterminate) {
                this._box.classList.add('is-indeterminate');
            }
            if (this.options.disabled) {
                this.element.classList.add('is-disabled');
            }

            this.element.addEventListener('click', this._boundChange);
        }

        _handleChange(e) {
            e.stopPropagation();
            if (this.options.disabled) return;

            this.toggle();
            
            if (this.options.onChange) {
                this.options.onChange({
                    target: this,
                    checked: this.isChecked(),
                    value: this.element.dataset.value
                });
            }
        }

        toggle() {
            if (this.options.disabled) return;
            
            if (this.options.indeterminate) {
                this.options.indeterminate = false;
                this._box.classList.remove('is-indeterminate');
                this.options.checked = false;
                this._box.classList.remove('is-checked');
            } else {
                this.options.checked = !this.options.checked;
                this._box.classList.toggle('is-checked', this.options.checked);
            }
            
            // Trigger native change event for accessibility
            this.element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        check() {
            if (this.options.disabled) return;
            this.options.checked = true;
            this.options.indeterminate = false;
            this._box.classList.add('is-checked');
            this._box.classList.remove('is-indeterminate');
            this.element.dispatchEvent(new Event('input', { bubbles: true }));
        }

        uncheck() {
            if (this.options.disabled) return;
            this.options.checked = false;
            this.options.indeterminate = false;
            this._box.classList.remove('is-checked');
            this._box.classList.remove('is-indeterminate');
            this.element.dispatchEvent(new Event('input', { bubbles: true }));
        }

        setIndeterminate(value) {
            this.options.indeterminate = value;
            this._box.classList.toggle('is-indeterminate', value);
            if (value) {
                this.options.checked = false;
                this._box.classList.remove('is-checked');
            }
        }

        isChecked() {
            return this.options.checked;
        }

        isIndeterminate() {
            return this.options.indeterminate;
        }

        setDisabled(disabled) {
            this.options.disabled = disabled;
            this.element.classList.toggle('is-disabled', disabled);
        }

        setValue(value) {
            this._actualValue = value;
            this.element.dataset.value = value;
        }

        getValue() {
            return this._actualValue !== undefined ? this._actualValue : this.element.dataset.value;
        }

        destroy() {
            this.element.removeEventListener('click', this._boundChange);
            this.element.classList.remove('duck-checkbox', 'is-disabled');
            this.element.innerHTML = '';
        }
    }

    // Checkbox API
    window.DuckControls = window.DuckControls || {};

    window.DuckControls.Checkbox = {
        create(element, options) {
            return new Checkbox(element, options);
        }
    };
})();
