// Tooltip.js - Custom Tooltip Control

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    class Tooltip {
        constructor(element, options = {}) {
            this.element = element instanceof HTMLElement ? element : document.querySelector(element);
            this.options = {
                text: options.text || '',
                position: options.position || 'top',
                offset: options.offset || 2,
                delay: options.delay || 200,
                ...options
            };

            this._tooltipEl = null;
            this._showTimer = null;
            this._boundShow = this.show.bind(this);
            this._boundHide = this.hide.bind(this);
            this._boundPosition = this._updatePosition.bind(this);

            this._init();
        }

        _init() {
            // Remove native title to prevent overlapping
            if (this.element.hasAttribute('title')) {
                if (!this.options.text) {
                    this.options.text = this.element.getAttribute('title');
                }
                this.element.removeAttribute('title');
            }

            this.element.addEventListener('mouseenter', () => {
                this._showTimer = setTimeout(this._boundShow, this.options.delay);
            });
            
            this.element.addEventListener('mouseleave', () => {
                clearTimeout(this._showTimer);
                this.hide();
            });
            
            this.element.addEventListener('mousedown', () => {
                // Usually tooltips hide when clicking the element
                clearTimeout(this._showTimer);
                this.hide();
            });
        }

        _createTooltipElement() {
            if (this._tooltipEl) return;
            this._tooltipEl = document.createElement('div');
            this._tooltipEl.className = 'duck-tooltip';
            this._tooltipEl.dataset.position = this.options.position;
            this._tooltipEl.textContent = this.options.text;
            document.body.appendChild(this._tooltipEl);
        }

        show() {
            if (!this.options.text) return;
            this._createTooltipElement();
            this._tooltipEl.textContent = this.options.text;
            
            // Need to make it visible to measure it, but keep opacity 0
            this._tooltipEl.style.display = 'block';
            this._updatePosition();
            
            // Trigger reflow
            void this._tooltipEl.offsetWidth;
            
            this._tooltipEl.classList.add('is-visible');
            window.addEventListener('scroll', this._boundPosition, true);
            window.addEventListener('resize', this._boundPosition);
        }

        hide() {
            if (!this._tooltipEl) return;
            this._tooltipEl.classList.remove('is-visible');
            
            window.removeEventListener('scroll', this._boundPosition, true);
            window.removeEventListener('resize', this._boundPosition);
            
            // Remove after transition
            setTimeout(() => {
                if (this._tooltipEl && !this._tooltipEl.classList.contains('is-visible')) {
                    if (this._tooltipEl.parentNode) {
                        this._tooltipEl.parentNode.removeChild(this._tooltipEl);
                    }
                    this._tooltipEl = null;
                }
            }, 200);
        }

        _updatePosition() {
            if (!this._tooltipEl) return;
            
            const targetRect = this.element.getBoundingClientRect();
            const tooltipRect = this._tooltipEl.getBoundingClientRect();
            
            let top = 0;
            let left = 0;
            
            switch (this.options.position) {
                case 'top':
                    top = targetRect.top - tooltipRect.height - this.options.offset;
                    left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'bottom':
                    top = targetRect.bottom + this.options.offset;
                    left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'left':
                    top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                    left = targetRect.left - tooltipRect.width - this.options.offset;
                    break;
                case 'right':
                    top = targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);
                    left = targetRect.right + this.options.offset;
                    break;
            }
            
            // Basic bounds checking
            if (left < 4) left = 4;
            if (top < 4) top = 4;
            if (left + tooltipRect.width > window.innerWidth - 4) {
                left = window.innerWidth - tooltipRect.width - 4;
            }
            if (top + tooltipRect.height > window.innerHeight - 4) {
                top = window.innerHeight - tooltipRect.height - 4;
            }

            this._tooltipEl.style.top = `${top}px`;
            this._tooltipEl.style.left = `${left}px`;
        }
        
        setText(text) {
            this.options.text = text;
            if (this._tooltipEl) {
                this._tooltipEl.textContent = text;
                if (this._tooltipEl.classList.contains('is-visible')) {
                    this._updatePosition();
                }
            }
        }
        
        destroy() {
            clearTimeout(this._showTimer);
            this.hide();
            this.element.removeEventListener('mouseenter', this._boundShow);
            this.element.removeEventListener('mouseleave', this._boundHide);
        }
    }

    window.DuckControls.Tooltip = {
        create(element, options) {
            return new Tooltip(element, options);
        }
    };

})();
