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
                    const leftWrap = document.createElement('div');
                    leftWrap.style.cssText = 'display:flex; gap:8px; margin-right:auto;';
                    const rightWrap = document.createElement('div');
                    rightWrap.style.cssText = 'display:flex; gap:8px;';

                    this.options.buttons.forEach(btnDef => {
                        const btn = document.createElement('button');
                        btn.className = `duck-btn ${btnDef.class || 'duck-btn-surface'}`;
                        if (btnDef.icon) {
                            btn.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px; margin-right:4px;">${btnDef.icon}</span>${btnDef.text}`;
                        } else {
                            btn.textContent = btnDef.text;
                        }
                        if (btnDef.isDefault) {
                            btn.setAttribute('data-duck-default', 'true');
                        }
                        if (btnDef.disabled) {
                            btn.disabled = true;
                        }
                        if (btnDef.onClick) {
                            btn.addEventListener('click', (e) => btnDef.onClick(e, this));
                        }
                        
                        if (btnDef.position === 'left') {
                            leftWrap.appendChild(btn);
                        } else {
                            rightWrap.appendChild(btn);
                        }
                    });

                    if (leftWrap.children.length > 0) footer.appendChild(leftWrap);
                    if (rightWrap.children.length > 0) footer.appendChild(rightWrap);
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
            } else if (e.key === 'Enter' && this.isOpen) {
                if (!this.options.defaultEnter) return;

                const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
                if (activeTag === 'textarea' || activeTag === 'button') return;

                let defaultBtn = this.container.querySelector('[data-duck-default="true"]');
                if (!defaultBtn) {
                    defaultBtn = this.container.querySelector('.duck-btn-primary');
                }

                if (defaultBtn && !defaultBtn.disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    defaultBtn.click();
                }
            }
        }

        open() {
            this.isOpen = true;
            this.overlay.classList.add('duck-modal-open');
            document.body.style.overflow = 'hidden';
            window.dispatchEvent(new CustomEvent('duck-popup-opened', { detail: { source: this } }));

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

        setLoading(isLoading, content = 'Loading...') {
            if (isLoading) {
                if (!this._loaderOverlay) {
                    this._loaderOverlay = document.createElement('div');
                    this._loaderOverlay.className = 'duck-modal-blur-loader';
                    
                    this._loaderSpinner = document.createElement('div');
                    this._loaderSpinner.className = 'spinner';
                    
                    this._loaderText = document.createElement('div');
                    this._loaderText.className = 'duck-modal-blur-text';
                    
                    this._loaderOverlay.appendChild(this._loaderSpinner);
                    this._loaderOverlay.appendChild(this._loaderText);
                    this.container.appendChild(this._loaderOverlay);
                }
                
                if (typeof content === 'string') {
                    if (content.trim().startsWith('<')) {
                        this._loaderSpinner.style.display = 'none';
                        this._loaderText.innerHTML = content;
                    } else {
                        this._loaderSpinner.style.display = '';
                        this._loaderText.textContent = content;
                    }
                } else if (content instanceof HTMLElement) {
                    this._loaderSpinner.style.display = 'none';
                    this._loaderText.innerHTML = '';
                    this._loaderText.appendChild(content);
                }
                
                requestAnimationFrame(() => {
                    this._loaderOverlay.classList.add('active');
                });
            } else {
                if (this._loaderOverlay) {
                    this._loaderOverlay.classList.remove('active');
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
                    buttons: [
                        { text: 'OK', class: 'duck-btn-primary', isDefault: true, onClick: (e, m) => { m.close(); resolve(); } }
                    ],
                    closeOnOverlay: false,
                    defaultEnter: true,
                    onClose: () => resolve()
                });
                modal.open();
            });
        },

        confirm(message, options = {}) {
            return new Promise((resolve) => {
                const modal = new Modal({
                    title: options.title || 'Confirm',
                    content: `<p style="color: var(--text-primary); margin: 0;">${message}</p>`,
                    buttons: [
                        { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, m) => { m.close(); resolve(false); } },
                        { text: 'Confirm', class: 'duck-btn-danger', isDefault: true, onClick: (e, m) => { m.close(); resolve(true); } }
                    ],
                    closeOnOverlay: false,
                    defaultEnter: true,
                    onClose: () => resolve(false)
                });
                modal.open();
            });
        },

        prompt(message, defaultValue = '', options = {}) {
            return new Promise((resolve) => {
                const inputWrap = document.createElement('div');
                inputWrap.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-top:8px;';
                
                const label = document.createElement('div');
                label.style.cssText = 'font-size:13px; color:var(--text-primary);';
                label.textContent = message;
                
                const input = document.createElement('input');
                input.type = 'text';
                input.style.cssText = 'padding: 8px 12px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 13px; outline: none; background: var(--bg-base); color: var(--text-primary); transition: border-color 0.2s; width: 100%; box-sizing: border-box;';
                input.value = defaultValue;
                
                input.addEventListener('focus', () => input.style.borderColor = 'var(--accent)');
                input.addEventListener('blur', () => input.style.borderColor = 'var(--border-default)');
                
                inputWrap.appendChild(label);
                inputWrap.appendChild(input);

                let resolved = false;

                const modal = new Modal({
                    title: options.title || 'Prompt',
                    content: inputWrap,
                    buttons: [
                        { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, m) => { resolved = true; m.close(); resolve(null); } },
                        { text: 'Save', class: 'duck-btn-primary', isDefault: true, onClick: (e, m) => { resolved = true; m.close(); resolve(input.value); } }
                    ],
                    closeOnOverlay: false,
                    defaultEnter: true,
                    onOpen: () => {
                        // Focus on open
                        setTimeout(() => {
                            input.focus();
                            input.select();
                        }, 50);
                    },
                    onClose: () => {
                        if (!resolved) resolve(null);
                    }
                });
                
                // Allow enter key
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        resolved = true;
                        modal.close();
                        resolve(input.value);
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
