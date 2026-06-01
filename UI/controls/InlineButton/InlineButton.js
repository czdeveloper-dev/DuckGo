// InlineButton.js - Inline button for toolbar/toolbar-panel usage

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    /**
     * InlineButton Control
     * Options:
     *   - icon: string - Material icon name
     *   - text: string - Button text
     *   - onClick: function - Click callback
     *   - variant: 'default' | 'primary' | 'ghost' | 'dropdown' | 'split'
     *   - size: 'sm' | 'md'
     */
    window.DuckControls.InlineButton = {
        create(options = {}) {
            const btn = document.createElement('button');
            btn.className = 'duck-inline-btn';
            
            if (options.variant) {
                btn.classList.add(`duck-inline-btn-${options.variant}`);
            }
            
            if (options.icon) {
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined';
                icon.textContent = options.icon;
                btn.appendChild(icon);
            }
            
            if (options.text) {
                const text = document.createElement('span');
                text.className = 'duck-inline-btn-text';
                text.textContent = options.text;
                btn.appendChild(text);
            }
            
            if (options.onClick) {
                btn.addEventListener('click', options.onClick);
            }
            
            return {
                element: btn,
                click: () => btn.click(),
                setDisabled: (v) => btn.disabled = v
            };
        }
    };
})();
