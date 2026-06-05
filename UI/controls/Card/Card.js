// Card.js - Reusable UI section component with standard header and body

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    /**
     * Card Control
     * A structural container for grouping settings or information.
     * Options:
     *   - title: string - Card title
     *   - icon: string - Material Symbols icon name
     *   - desc: string - Muted description below title
     *   - content: HTMLElement - Elements to put in the body
     *   - bodyPadding: string - CSS padding for body (default: '20px')
     *   - gap: string - CSS gap for body elements (default: '20px')
     */
    window.DuckControls.Card = {
        create(options = {}) {
            const card = document.createElement('div');
            card.className = 'duck-card';
            
            // Header
            if (options.title || options.icon || options.desc) {
                const header = document.createElement('div');
                header.className = 'duck-card-header';
                
                if (options.icon) {
                    const iconWrap = document.createElement('div');
                    iconWrap.className = 'duck-card-header-icon-wrap';
                    
                    const icon = document.createElement('span');
                    icon.className = 'material-symbols-outlined duck-card-header-icon';
                    icon.textContent = options.icon;
                    
                    iconWrap.appendChild(icon);
                    header.appendChild(iconWrap);
                }
                
                const textWrap = document.createElement('div');
                textWrap.className = 'duck-card-header-text';
                
                if (options.title) {
                    const title = document.createElement('div');
                    title.className = 'duck-card-title';
                    title.textContent = options.title;
                    textWrap.appendChild(title);
                }
                
                if (options.desc) {
                    const desc = document.createElement('div');
                    desc.className = 'duck-card-desc';
                    desc.textContent = options.desc;
                    textWrap.appendChild(desc);
                }
                
                header.appendChild(textWrap);
                card.appendChild(header);
            }
            
            // Body
            const body = document.createElement('div');
            body.className = 'duck-card-body';
            if (options.bodyPadding) body.style.padding = options.bodyPadding;
            if (options.gap) body.style.gap = options.gap;
            
            if (options.content) {
                body.appendChild(options.content);
            }
            
            card.appendChild(body);
            
            return {
                element: card,
                body: body,
                append(el) {
                    body.appendChild(el);
                }
            };
        }
    };
})();
