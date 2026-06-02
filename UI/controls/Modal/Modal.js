// Modal.js - Modal control component

(function() {
    'use strict';

    class Modal {
        constructor(options = {}) {
            this.options = options;
            this.isOpen = false;
            this.overlay = null;
            this.container = null;
            this.content = options.content || '';
            this._boundHandleKeydown = this._handleKeydown.bind(this);

            if (options.autoInit !== false) {
                this._init();
            }
        }

        _init() {
            // Create overlay
            this.overlay = document.createElement('div');
            this.overlay.className = 'duck-modal-overlay';

            // Create container
            this.container = document.createElement('div');
            this.container.className = 'duck-modal-container';
            if (this.options.size) {
                this.container.classList.add(`duck-modal-${this.options.size}`);
            }

            // Build modal structure
            this._buildStructure();

            // Add to DOM
            document.body.appendChild(this.overlay);
            this.overlay.appendChild(this.container);

            // Event listeners
            this._setupEventListeners();
        }

        _buildStructure() {
            // Header
            if (this.options.title) {
                const header = document.createElement('div');
                header.className = 'duck-modal-header';

                const titleWrap = document.createElement('div');
                titleWrap.className = 'duck-modal-title-wrap';
                titleWrap.style.cssText = 'display:flex;flex-direction:column;gap:2px;';

                const title = document.createElement('h2');
                title.className = 'duck-modal-title';
                
                if (this.options.icon) {
                    title.style.display = 'flex';
                    title.style.alignItems = 'center';
                    title.style.gap = '8px';
                    title.innerHTML = `<span class="material-symbols-outlined" style="font-size: 20px; color: var(--text-secondary);">${this.options.icon}</span> <span>${this.options.title}</span>`;
                } else {
                    title.textContent = this.options.title;
                }
                
                titleWrap.appendChild(title);
                
                if (this.options.subtitle) {
                    const subtitle = document.createElement('div');
                    subtitle.className = 'duck-modal-subtitle';
                    subtitle.style.cssText = 'font-size: 12px; color: var(--text-secondary); font-weight: 500; display:flex; align-items:center; gap:4px;';
                    subtitle.innerHTML = this.options.subtitle;
                    titleWrap.appendChild(subtitle);
                }
                
                header.appendChild(titleWrap);

                if (this.options.showClose !== false) {
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'duck-modal-close';
                    closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
                    closeBtn.addEventListener('click', () => this.close());
                    header.appendChild(closeBtn);
                }

                this.container.appendChild(header);
            }

            // Body
            const body = document.createElement('div');
            body.className = 'duck-modal-body';
            if (typeof this.content === 'string') {
                body.innerHTML = this.content;
            } else if (this.content instanceof HTMLElement) {
                body.appendChild(this.content);
            }
            this.container.appendChild(body);

            // Footer
            if (this.options.footer || (this.options.buttons && this.options.buttons.length > 0)) {
                const footer = document.createElement('div');
                footer.className = 'duck-modal-footer';
                
                if (this.options.footer) {
                    if (typeof this.options.footer === 'string') {
                        footer.innerHTML = this.options.footer;
                    } else if (this.options.footer instanceof HTMLElement) {
                        footer.appendChild(this.options.footer);
                    }
                }

                if (this.options.buttons && Array.isArray(this.options.buttons)) {
                    this.options.buttons.forEach(btnDef => {
                        const btn = document.createElement('button');
                        btn.className = `duck-btn ${btnDef.class || 'duck-btn-surface'}`;
                        btn.textContent = btnDef.text;
                        if (btnDef.onClick) {
                            btn.addEventListener('click', (e) => btnDef.onClick(e, this));
                        }
                        footer.appendChild(btn);
                    });
                }
                
                this.container.appendChild(footer);
            }
        }

        _setupEventListeners() {
            // Close on overlay click
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay && this.options.closeOnOverlay !== false) {
                    this.close();
                }
            });

            // Close on escape
            document.addEventListener('keydown', this._boundHandleKeydown);
        }

        _handleKeydown(e) {
            if (e.key === 'Escape' && this.isOpen) {
                if (this.options.closeOnEscape !== false) {
                    this.close();
                }
            }
        }

        open() {
            this.isOpen = true;
            this.overlay.classList.add('duck-modal-open');
            document.body.style.overflow = 'hidden';

            if (this.options.onOpen) {
                this.options.onOpen();
            }

            // Focus first focusable element
            setTimeout(() => {
                const focusable = this.container.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
                if (focusable) focusable.focus();
            }, 100);
        }

        close() {
            this.isOpen = false;
            this.overlay.classList.remove('duck-modal-open');
            document.body.style.overflow = '';

            if (this.options.onClose) {
                this.options.onClose();
            }
        }

        toggle() {
            this.isOpen ? this.close() : this.open();
        }

        setContent(content) {
            const body = this.container.querySelector('.duck-modal-body');
            if (body) {
                if (typeof content === 'string') {
                    body.innerHTML = content;
                } else if (content instanceof HTMLElement) {
                    body.innerHTML = '';
                    body.appendChild(content);
                }
            }
        }

        destroy() {
            document.removeEventListener('keydown', this._boundHandleKeydown);
            if (this.overlay.parentNode) {
                this.overlay.parentNode.removeChild(this.overlay);
            }
        }
    }

    // Modal API
    window.DuckControls = window.DuckControls || {};

    window.DuckControls.Modal = {
        create(options) {
            return new Modal(options);
        },

        alert(message, options = {}) {
            return new Promise((resolve) => {
                const modal = new Modal({
                    title: options.title || 'Alert',
                    content: `<p>${message}</p>`,
                    footer: `<button class="btn primary" id="modal-ok-btn">OK</button>`,
                    closeOnOverlay: false,
                    onOpen() {
                        const btn = document.getElementById('modal-ok-btn');
                        if (btn) {
                            btn.addEventListener('click', () => {
                                modal.close();
                                resolve();
                            });
                        }
                    },
                    onClose() {
                        modal.destroy();
                        resolve();
                    }
                });
                modal.open();
            });
        },

        confirm(message, options = {}) {
            return new Promise((resolve) => {
                const modal = new Modal({
                    title: options.title || 'Confirm',
                    content: `<p>${message}</p>`,
                    footer: `
                        <button class="btn ghost" id="modal-cancel-btn">Cancel</button>
                        <button class="btn primary" id="modal-confirm-btn">Confirm</button>
                    `,
                    closeOnOverlay: false,
                    onOpen() {
                        document.getElementById('modal-cancel-btn')?.addEventListener('click', () => {
                            modal.close();
                            resolve(false);
                        });
                        document.getElementById('modal-confirm-btn')?.addEventListener('click', () => {
                            modal.close();
                            resolve(true);
                        });
                    },
                    onClose() {
                        modal.destroy();
                    }
                });
                modal.open();
            });
        }
    };

    // Auto-initialize modals
    window.DuckControls.Modal.initTriggers = function() {
        document.querySelectorAll('[data-modal]').forEach(trigger => {
            if (trigger._modalTrigger) return;

            trigger._modalTrigger = true;
            trigger.addEventListener('click', () => {
                const modalId = trigger.dataset.modal;
                const modalEl = document.getElementById(modalId);
                if (modalEl && modalEl._duckModal) {
                    modalEl._duckModal.open();
                }
            });
        });
    };

    window.addEventListener('DOMContentLoaded', () => {
        window.DuckControls.Modal.initTriggers();
    });
})();
