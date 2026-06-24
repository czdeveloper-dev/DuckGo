// TabControl.js

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    /**
     * TabControl
     * @param {Object} options
     * - tabs: Array<{id, name, content (HTMLElement), canDelete: boolean}>
     * - onAdd: function() => returns new tab object or null (if handled async)
     * - onDelete: function(tabId)
     * - onSelect: function(tabId)
     * - allowAdd: boolean
     */
    window.DuckControls.TabControl = {
        create(options = {}) {
            const wrap = document.createElement('div');
            wrap.className = 'duck-tabcontrol';
            wrap.style.background = 'var(--bg-surface)';
            if (options.variant === 'horizontal') {
                wrap.classList.add('duck-tabcontrol-horizontal');
            }

            const sidebar = document.createElement('div');
            sidebar.className = 'duck-tabcontrol-sidebar';

            const tabList = document.createElement('div');
            tabList.className = 'duck-tabcontrol-list';
            sidebar.appendChild(tabList);

            if (options.allowAdd) {
                const footer = document.createElement('div');
                footer.className = 'duck-tabcontrol-footer';
                const addBtn = document.createElement('button');
                addBtn.className = 'duck-tabcontrol-create-btn';
                addBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">add</span> Create Tab';
                addBtn.addEventListener('click', () => {
                    if (options.onAdd) options.onAdd();
                });
                footer.appendChild(addBtn);
                sidebar.appendChild(footer);
            }

            const contentArea = document.createElement('div');
            contentArea.className = 'duck-tabcontrol-content';
            contentArea.style.background = 'var(--bg-surface)';

            wrap.appendChild(sidebar);
            wrap.appendChild(contentArea);

            let currentTabs = [];
            let activeTabId = null;

            const renderTabs = () => {
                tabList.innerHTML = '';
                contentArea.innerHTML = '';

                currentTabs.forEach(tab => {
                    // Render Tab Item
                    const item = document.createElement('div');
                    item.className = 'duck-tabcontrol-item';
                    if (tab.id === activeTabId) item.classList.add('active');
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'duck-tabcontrol-item-name';
                    
                    if (tab.icon) {
                        const iconEl = document.createElement('span');
                        iconEl.style.cssText = 'display:flex;align-items:center;gap:6px;';
                        if (tab.icon.includes('/') || tab.icon.includes('.')) {
                            iconEl.innerHTML = `<img src="${tab.icon}" style="width:16px;height:16px;object-fit:contain;"> <span>${tab.name}</span>`;
                        } else {
                            iconEl.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">${tab.icon}</span> <span>${tab.name}</span>`;
                        }
                        nameSpan.appendChild(iconEl);
                    } else {
                        nameSpan.textContent = tab.name;
                    }
                    
                    item.appendChild(nameSpan);

                    if (tab.canDelete) {
                        const delBtn = document.createElement('span');
                        delBtn.className = 'material-symbols-outlined duck-tabcontrol-item-delete';
                        delBtn.textContent = 'delete';
                        delBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (options.onDelete) options.onDelete(tab.id);
                        });
                        item.appendChild(delBtn);
                    }

                    item.addEventListener('click', () => {
                        selectTab(tab.id);
                    });

                    tabList.appendChild(item);

                    // Render Pane
                    const pane = document.createElement('div');
                    pane.className = 'duck-tabcontrol-pane';
                    if (tab.id === activeTabId) pane.classList.add('active');
                    
                    if (tab.content) {
                        pane.appendChild(tab.content);
                    }
                    contentArea.appendChild(pane);
                });
            };

            const selectTab = (id) => {
                activeTabId = id;
                renderTabs();
                if (options.onSelect) options.onSelect(id);
            };

            const setTabs = (tabs) => {
                currentTabs = [...tabs];
                if (currentTabs.length > 0 && !currentTabs.find(t => t.id === activeTabId)) {
                    activeTabId = currentTabs[0].id;
                }
                renderTabs();
            };

            if (options.tabs) {
                setTabs(options.tabs);
            }

            return {
                element: wrap,
                setTabs,
                selectTab,
                getActiveTabId: () => activeTabId
            };
        }
    };
})();
