// ProxyDeleteEntityModal.js

(function() {
    'use strict';

    window.ProxyModals = window.ProxyModals || {};

    window.ProxyModals.DeleteEntity = {
        _modal: null,

        /**
         * @param {string} type 'proxygroup' or 'proxytag'
         * @param {Array<{label: string, value: any}>} availableItems 
         * @param {function} onDelete callback with (selectedValues, deleteMode)
         */
        show(type, availableItems, onDelete) {
            if (this._modal) {
                this._modal.destroy();
                this._modal = null;
            }

            const isGroup = type === 'proxygroup';
            const entityName = isGroup ? 'Group' : 'Tag';

            const modalBody = document.createElement('div');
            modalBody.style.cssText = 'display:flex; flex-direction:column; gap:20px;';

            // Warning Banner
            const warningWrap = document.createElement('div');
            warningWrap.style.cssText = 'background: color-mix(in srgb, var(--danger, #f44336) 5%, transparent); border: 1px solid color-mix(in srgb, var(--danger, #f44336) 20%, transparent); border-radius: 8px; padding: 16px; display: flex; align-items: flex-start; gap: 12px;';
            
            const warningIcon = document.createElement('span');
            warningIcon.className = 'material-symbols-outlined';
            warningIcon.textContent = 'warning';
            warningIcon.style.cssText = 'color: var(--danger, #f44336); font-size: 22px;';
            
            const bannerContent = document.createElement('div');
            bannerContent.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
            
            const warningTitle = document.createElement('div');
            warningTitle.style.cssText = 'font-weight: 600; color: var(--danger, #f44336); font-size: 14px;';
            warningTitle.textContent = `Delete ${entityName}(s)`;
            
            const warningDesc = document.createElement('div');
            warningDesc.style.cssText = 'font-size: 13px; color: var(--text-secondary);';
            if (isGroup) {
                warningDesc.textContent = 'Deleting a group will affect all proxies currently assigned to it. Please select how you want to handle the proxies.';
            } else {
                warningDesc.textContent = 'Deleting a tag will only remove the tag from the system. It will NOT delete any proxies.';
            }
            
            bannerContent.appendChild(warningTitle);
            bannerContent.appendChild(warningDesc);
            warningWrap.appendChild(warningIcon);
            warningWrap.appendChild(bannerContent);
            modalBody.appendChild(warningWrap);

            // Select Dropdown
            const selectWrap = document.createElement('div');
            selectWrap.style.cssText = 'display:flex; flex-direction:column; gap:8px;';
            const selectLabel = document.createElement('label');
            selectLabel.className = 'ui-label';
            selectLabel.textContent = `Select ${entityName}(s) to delete:`;
            selectWrap.appendChild(selectLabel);

            const multiSelect = window.DuckControls.MultiSelectComboBox.create({
                options: availableItems,
                placeholder: `Select ${entityName}(s)...`
            });
            selectWrap.appendChild(multiSelect.element);
            modalBody.appendChild(selectWrap);

            // Group Options (Radio Buttons)
            let deleteMode = 'keep'; // 'keep' or 'deleteAll'
            if (isGroup) {
                const radioWrap = document.createElement('div');
                radioWrap.style.cssText = 'display:flex; flex-direction:column; gap:12px; margin-top: 8px;';
                
                const option1 = window.DuckControls.RadioGroup.create({
                    name: 'deleteProxyMode',
                    options: [
                        { label: 'Keep Proxies (Only delete the Group)', value: 'keep' },
                        { label: 'Delete Group AND all Proxies inside it', value: 'deleteAll' }
                    ],
                    value: 'keep',
                    onChange: (val) => {
                        deleteMode = val;
                    }
                });
                radioWrap.appendChild(option1.element);
                modalBody.appendChild(radioWrap);
            }

            this._modal = window.DuckControls.Modal.create({
                defaultEnter: true,
                title: `Delete ${entityName}s`,
                icon: 'delete',
                content: modalBody,
                size: 'md',
                closeOnOverlay: true,
                buttons: [
                    { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, m) => m.close() },
                    { text: 'Delete', icon: 'delete', class: 'duck-btn-danger', onClick: (e, m) => {
                        const vals = multiSelect.getValues();
                        if (vals.length === 0) return;
                        if (onDelete) onDelete(vals, isGroup ? deleteMode : null);
                        m.close();
                    }}
                ],
                onClose: () => { this._modal = null; }
            });

            this._modal.open();
        }
    };
})();
