window.DuckControls = window.DuckControls || {};
window.DuckControls.ContextMenu = {
    create(triggerElement, options) {
        const menu = document.createElement('div');
        menu.className = 'duck-context-menu';
        const itemButtons = [];
        
        options.items.forEach(item => {
            if (item === 'divider') {
                const divider = document.createElement('div');
                divider.className = 'duck-context-divider';
                menu.appendChild(divider);
                return;
            }
            
            if (item.type === 'label') {
                const label = document.createElement('div');
                label.className = 'duck-context-label';
                label.textContent = item.label;
                menu.appendChild(label);
                return;
            }
            
            const btn = document.createElement('button');
            btn.className = `duck-context-item ${item.danger ? 'danger' : ''} ${item.selected ? 'selected' : ''} ${item.disabled ? 'disabled' : ''}`;
            
            const leftWrap = document.createElement('div');
            leftWrap.style.display = 'flex';
            leftWrap.style.alignItems = 'center';
            leftWrap.style.gap = '8px';
            
            if (item.icon) {
                const icon = document.createElement('span');
                icon.className = 'material-symbols-outlined';
                icon.textContent = item.icon;
                leftWrap.appendChild(icon);
            }
            
            const text = document.createElement('span');
            text.textContent = item.label;
            leftWrap.appendChild(text);
            btn.appendChild(leftWrap);
            
            if (item.actions && item.actions.length > 0) {
                const actionsWrap = document.createElement('div');
                actionsWrap.className = 'duck-context-item-actions';
                actionsWrap.style.display = 'flex';
                actionsWrap.style.alignItems = 'center';
                actionsWrap.style.gap = '4px';
                
                item.actions.forEach(action => {
                    const actBtn = document.createElement('span');
                    actBtn.className = `material-symbols-outlined duck-context-action-btn ${action.danger ? 'danger' : ''}`;
                    actBtn.textContent = action.icon;
                    actBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (action.onClick) action.onClick(e);
                        menu.classList.remove('active');
                    });
                    actionsWrap.appendChild(actBtn);
                });
                
                btn.appendChild(actionsWrap);
                btn.style.display = 'flex';
                btn.style.justifyContent = 'space-between';
                btn.style.alignItems = 'center';
            }
            
            if (!item.disabled) {
                btn.addEventListener('click', (e) => {
                    menu.classList.remove('active');
                    if (item.onClick) item.onClick(e);
                });
            }
            
            itemButtons.push({ item, btn });
            menu.appendChild(btn);
        });
        
        document.body.appendChild(menu);
        
        const closeMenu = (e) => {
            if (!menu.contains(e.target) && (!triggerElement || !triggerElement.contains(e.target))) {
                menu.classList.remove('active');
            }
        };
        
        if (triggerElement) {
            triggerElement.addEventListener('click', (e) => {
                if (menu.classList.contains('active')) {
                    menu.classList.remove('active');
                } else {
                    document.querySelectorAll('.duck-context-menu.active').forEach(m => m.classList.remove('active'));
                    
                    // Add active class first so we can measure the menu's dimensions
                    menu.classList.add('active');
                    
                    const rect = triggerElement.getBoundingClientRect();
                    const menuRect = menu.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    
                    let left = rect.left;
                    let top = rect.bottom + 4;
                    
                    // Adjust horizontal position if it overflows the right edge
                    if (left + menuRect.width > viewportWidth) {
                        left = rect.right - menuRect.width;
                        if (left < 4) left = 4; // Add a small padding from edge
                    }
                    
                    // Adjust vertical position if it overflows the bottom edge
                    if (top + menuRect.height > viewportHeight) {
                        top = rect.top - menuRect.height - 4;
                        if (top < 4) top = 4;
                    }
                    
                    menu.style.left = `${left}px`;
                    menu.style.top = `${top}px`;
                    // Removed minWidth = rect.width because context menu usually doesn't need to match button width
                }
            });
        }
        
        document.addEventListener('click', closeMenu);
        
        return {
            element: menu,
            itemButtons: itemButtons,
            showAt(x, y) {
                document.querySelectorAll('.duck-context-menu.active').forEach(m => m.classList.remove('active'));
                menu.style.left = `${x}px`;
                menu.style.top = `${y}px`;
                menu.classList.add('active');
            },
            hide() {
                menu.classList.remove('active');
            },
            destroy() {
                document.removeEventListener('click', closeMenu);
                menu.remove();
            }
        };
    }
};
