window.DuckControls = window.DuckControls || {};
window.DuckControls.ContextMenu = {
    create(triggerElement, options) {
        const activeMenus = [];
        const itemButtons = [];
        let closeTimeout = null;

        const closeAllMenus = () => {
            activeMenus.forEach(m => m.classList.remove('active'));
        };

        const renderMenu = (items, depth = 0) => {
            const menu = document.createElement('div');
            menu.className = 'duck-context-menu';
            menu.style.zIndex = 10050 + depth;
            
            items.forEach(item => {
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
                leftWrap.style.flex = '1';
                leftWrap.style.minWidth = '0';
                
                if (item.icon) {
                    const icon = document.createElement('span');
                    icon.className = 'material-symbols-outlined';
                    icon.textContent = item.icon;
                    icon.style.flexShrink = '0';
                    leftWrap.appendChild(icon);
                }
                
                const text = document.createElement('span');
                text.textContent = item.label;
                text.style.overflow = 'hidden';
                text.style.textOverflow = 'ellipsis';
                text.style.whiteSpace = 'nowrap';
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
                            closeAllMenus();
                        });
                        actionsWrap.appendChild(actBtn);
                    });
                    
                    btn.appendChild(actionsWrap);
                    btn.style.display = 'flex';
                    btn.style.justifyContent = 'space-between';
                    btn.style.alignItems = 'center';
                }
                
                if (item.children && item.children.length > 0) {
                    btn.classList.add('has-submenu');
                    btn.style.justifyContent = 'space-between';
                    
                    const arrowIcon = document.createElement('span');
                    arrowIcon.className = 'material-symbols-outlined submenu-icon';
                    arrowIcon.textContent = 'chevron_right';
                    arrowIcon.style.marginLeft = 'auto';
                    btn.appendChild(arrowIcon);

                    const submenu = renderMenu(item.children, depth + 1);
                    
                    let hoverTimeout;
                    
                    btn.addEventListener('mouseenter', () => {
                        clearTimeout(hoverTimeout);
                        // Hide other submenus at the same level
                        Array.from(menu.children).forEach(c => {
                            if (c !== btn && c._submenu) {
                                c._submenu.classList.remove('active');
                            }
                        });
                        
                        submenu.classList.add('active');
                        
                        // Position submenu with a gap to create a floating effect
                        const btnRect = btn.getBoundingClientRect();
                        const submenuRect = submenu.getBoundingClientRect();
                        
                        let left = btnRect.right + 8; // 8px gap to the right
                        let top = btnRect.top - 4; // Align with parent item
                        
                        if (left + submenuRect.width > window.innerWidth) {
                            left = btnRect.left - submenuRect.width - 8; // flip to left side with 8px gap
                        }
                        if (top + submenuRect.height > window.innerHeight) {
                            top = window.innerHeight - submenuRect.height - 4;
                        }
                        
                        submenu.style.left = `${left}px`;
                        submenu.style.top = `${top}px`;
                    });
                    
                    btn.addEventListener('mouseleave', () => {
                        hoverTimeout = setTimeout(() => {
                            if (!submenu.matches(':hover')) {
                                submenu.classList.remove('active');
                            }
                        }, 150);
                    });
                    
                    submenu.addEventListener('mouseleave', () => {
                        hoverTimeout = setTimeout(() => {
                            submenu.classList.remove('active');
                        }, 150);
                    });
                    
                    submenu.addEventListener('mouseenter', () => {
                        clearTimeout(hoverTimeout);
                    });
                    
                    btn._submenu = submenu;
                } else {
                    btn.addEventListener('mouseenter', () => {
                        // Hide other submenus when hovering a normal item
                        Array.from(menu.children).forEach(c => {
                            if (c !== btn && c._submenu) {
                                c._submenu.classList.remove('active');
                            }
                        });
                    });
                    
                    if (!item.disabled) {
                        btn.addEventListener('click', (e) => {
                            closeAllMenus();
                            if (item.onClick) item.onClick(e);
                        });
                    }
                }
                
                itemButtons.push({ item, btn });
                menu.appendChild(btn);
            });
            
            document.body.appendChild(menu);
            activeMenus.push(menu);
            return menu;
        };
        
        const rootMenu = renderMenu(options.items, 0);
        
        const closeMenu = (e) => {
            // Check if click is inside any active menu
            const clickedInsideMenu = activeMenus.some(m => m.contains(e.target));
            const clickedTrigger = triggerElement && triggerElement.contains(e.target);
            
            if (!clickedInsideMenu && !clickedTrigger) {
                closeAllMenus();
            }
        };
        
        if (triggerElement) {
            triggerElement.addEventListener('click', (e) => {
                if (rootMenu.classList.contains('active')) {
                    closeAllMenus();
                } else {
                    closeAllMenus();
                    
                    rootMenu.classList.add('active');
                    window.dispatchEvent(new CustomEvent('duck-popup-opened', { detail: { source: rootMenu } }));
                    
                    const rect = triggerElement.getBoundingClientRect();
                    
                    if (options.matchTriggerWidth) {
                        rootMenu.style.width = `${rect.width}px`;
                    }
                    
                    const menuRect = rootMenu.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    
                    let left = rect.left;
                    let top = rect.bottom + 8;
                    
                    if (left + menuRect.width > viewportWidth) {
                        left = rect.right - menuRect.width;
                        if (left < 8) left = 8; 
                    }
                    if (top + menuRect.height > viewportHeight) {
                        top = rect.top - menuRect.height - 8;
                        if (top < 8) top = 8;
                    }
                    
                    rootMenu.style.left = `${left}px`;
                    rootMenu.style.top = `${top}px`;
                }
            });
        }
        document.addEventListener('click', closeMenu);
        
        const handlePopupOpened = (e) => {
            if (e.detail && e.detail.source !== rootMenu && e.detail.source !== 'contextmenu') {
                closeAllMenus();
            }
        };
        window.addEventListener('duck-popup-opened', handlePopupOpened);
        
        const handleScroll = (e) => {
            if (rootMenu.classList.contains('active')) {
                // Ignore scrolls inside any active menu
                if (activeMenus.some(m => m.contains(e.target)) || (triggerElement && triggerElement.contains(e.target))) {
                    return;
                }
                closeAllMenus();
            }
        };
        window.addEventListener('scroll', handleScroll, { capture: true });
        
        return {
            element: rootMenu,
            itemButtons: itemButtons,
            showAt(x, y) {
                // Optionally close other instances if we want global singularity
                document.querySelectorAll('.duck-context-menu.active').forEach(m => m.classList.remove('active'));
                
                rootMenu.classList.add('active');
                window.dispatchEvent(new CustomEvent('duck-popup-opened', { detail: { source: 'contextmenu' } }));
                
                const menuRect = rootMenu.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                
                let left = x;
                let top = y;
                
                if (left + menuRect.width > viewportWidth) left = viewportWidth - menuRect.width - 4;
                if (top + menuRect.height > viewportHeight) top = viewportHeight - menuRect.height - 4;
                
                if (left < 4) left = 4;
                if (top < 4) top = 4;
                
                rootMenu.style.left = `${left}px`;
                rootMenu.style.top = `${top}px`;
            },
            hide() {
                closeAllMenus();
            },
            destroy() {
                closeAllMenus();
                document.removeEventListener('click', closeMenu);
                window.removeEventListener('duck-popup-opened', handlePopupOpened);
                window.removeEventListener('scroll', handleScroll, { capture: true });
                activeMenus.forEach(m => m.remove());
                activeMenus.length = 0;
            },

            /** Replace menu items with a new array (used by Select.setOptions). */
            setItems(newItems) {
                itemButtons.length = 0;
                while (rootMenu.firstChild) {
                    rootMenu.removeChild(rootMenu.firstChild);
                }
                const depth = parseInt(rootMenu.style.zIndex) - 10050 || 0;
                const rendered = renderMenu(newItems, depth);
                while (rendered.firstChild) {
                    rootMenu.appendChild(rendered.firstChild);
                }
            }
        };
    }
};
