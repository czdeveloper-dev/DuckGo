// Panel.js - Panel control component with label header

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    /**
     * Panel Control
     * Creates a labeled container with header and content area
     * Options:
     *   - label: string - Panel header label
     *   - headerActions: array - [{text, onClick}] buttons in header
     *   - content: HTMLElement - Content element
     *   - layout: 'horizontal' | 'vertical' - Header layout (default: vertical)
     */
    window.DuckControls.Panel = {
        create(options = {}) {
            const panel = document.createElement('div');
            panel.className = 'duck-panel';
            
            // Header
            if (options.label || options.headerActions?.length) {
                const header = document.createElement('div');
                header.className = 'duck-panel-header';
                
                if (options.label) {
                    const label = document.createElement('label');
                    label.className = 'duck-panel-label';
                    label.textContent = options.label;
                    header.appendChild(label);
                }
                
                if (options.headerActions?.length) {
                    const actions = document.createElement('div');
                    actions.className = 'duck-panel-actions';
                    options.headerActions.forEach(action => {
                        const btn = document.createElement('button');
                        btn.className = 'duck-panel-action-btn';
                        btn.textContent = action.text;
                        btn.addEventListener('click', action.onClick);
                        actions.appendChild(btn);
                    });
                    header.appendChild(actions);
                }
                
                panel.appendChild(header);
            }
            
            // Content
            const content = document.createElement('div');
            content.className = 'duck-panel-content';
            if (options.content) {
                content.appendChild(options.content);
            }
            panel.appendChild(content);
            
            return {
                element: panel,
                header: panel.querySelector('.duck-panel-header'),
                content: content,
                appendChild: (el) => content.appendChild(el)
            };
        }
    };
})();
