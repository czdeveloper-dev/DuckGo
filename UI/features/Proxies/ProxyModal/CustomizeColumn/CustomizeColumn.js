// CustomizeColumn.js - Customize Proxy Columns Modal

(function() {
    'use strict';

    window.ProxyModals = window.ProxyModals || {};

    window.ProxyModals.CustomizeColumn = {
        _modal: null,
        
        show(currentVisibleSet, onUpdate, optionalCols, storageKey) {
            if (this._modal) {
                this._modal.destroy();
                this._modal = null;
            }

            const modalBody = document.createElement('div');
            modalBody.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
            
            const checkboxesEl = document.createElement('div');
            checkboxesEl.id = 'proxy-col-visibility-checkboxes';
            checkboxesEl.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
            modalBody.appendChild(checkboxesEl);

            const colsToRender = optionalCols || [
                { id: 'group', label: 'GROUP' },
                { id: 'tags', label: 'TAG' },
                { id: 'proxy_detail', label: 'PROXY' },
                { id: 'note', label: 'NOTE' },
                { id: 'created', label: 'CREATED TIME' }
            ];

            const keyToSave = storageKey || 'duck_proxy_visible_cols';

            // Create checkboxes
            colsToRender.forEach(col => {
                const isVisible = currentVisibleSet.has(col.id);
                const cbWrap = document.createElement('div');
                cbWrap.style.cssText = 'padding: 6px 4px;';

                window.DuckControls.Checkbox.create(cbWrap, {
                    label: col.label,
                    checked: isVisible,
                    onChange: (e) => {
                        if (e.checked) currentVisibleSet.add(col.id);
                        else currentVisibleSet.delete(col.id);
                        
                        // Save to localStorage immediately
                        localStorage.setItem(keyToSave, JSON.stringify(Array.from(currentVisibleSet)));
                        
                        // Notify parent to update table
                        if (onUpdate) onUpdate(currentVisibleSet);
                    }
                });

                checkboxesEl.appendChild(cbWrap);
            });

            this._modal = window.DuckControls.Modal.create({
                defaultEnter: true,
                title: 'Customize Columns',
                content: modalBody,
                size: 'sm',
                closeOnOverlay: true,
                onClose: () => {
                    this._modal = null;
                }
            });

            this._modal.open();
        }
    };
})();
