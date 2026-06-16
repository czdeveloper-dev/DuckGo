// CreateEntityModal.js

(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};

    window.ProfileModals.CreateEntity = {
        _modal: null,

        /**
         * @param {string} type 'group' or 'tag'
         * @param {function} onSave callback with the new name
         * @param {string} [initialValue] optional initial value for edit mode
         */
        show(type, onSave, initialValue = null) {
            if (this._modal) {
                this._modal.destroy();
                this._modal = null;
            }

            const isGroup = type === 'group' || type === 'proxygroup';
            const isProxy = type === 'proxygroup' || type === 'proxytag';
            const entityName = isGroup ? 'Group' : 'Tag';
            const isEdit = typeof initialValue === 'string';

            const modalBody = document.createElement('div');
            modalBody.style.cssText = 'display:flex; flex-direction:column; gap:20px;';

            const infoText = document.createElement('div');
            infoText.style.cssText = 'color: var(--text-secondary); font-size:13px;';
            infoText.textContent = isEdit 
                ? `Enter a new name for this ${entityName.toLowerCase()}.` 
                : `Enter a name for the new ${entityName.toLowerCase()}.`;
            modalBody.appendChild(infoText);

            const nameInput = window.DuckControls.Input.create({
                icon: isGroup ? 'folder' : 'label',
                label: `${entityName} Name`,
                placeholder: `e.g. ${isGroup ? 'Facebook Farm' : 'VIP'}`,
            });
            
            // Limit to 30 characters
            nameInput.input.maxLength = 30;
            
            if (isEdit) {
                nameInput.setValue(initialValue);
            }
            modalBody.appendChild(nameInput.element);

            const valMsg = document.createElement('div');
            valMsg.style.cssText = 'font-size: 12px; color: #eab308; display: none; align-items: center; gap: 6px; padding: 8px; background: rgba(234, 179, 8, 0.1); border-radius: 4px;';
            modalBody.appendChild(valMsg);

            const showValMsg = (msg) => {
                valMsg.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;">error</span> ${msg}`;
                valMsg.style.display = 'flex';
            };

            this._modal = window.DuckControls.Modal.create({
                defaultEnter: true,
                title: isEdit ? `Edit ${entityName}` : `Create New ${entityName}`,
                icon: isEdit ? 'edit' : (isGroup ? 'folder' : 'label'),
                content: modalBody,
                size: 'sm',
                closeOnOverlay: true,
                buttons: [
                    { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, m) => m.close() },
                    { text: isEdit ? 'Save' : 'Create', icon: isEdit ? 'save' : 'add_circle', class: 'duck-btn-primary', onClick: (e, m) => {
                        const val = nameInput.getValue().trim();
                        if (!val) {
                            return showValMsg(`${entityName} Name is required`);
                        }
                        valMsg.style.display = 'none';
                        if (onSave) onSave(val);
                        m.close();
                    }}
                ],
                onClose: () => { this._modal = null; }
            });

            this._modal.open();
            
            // Focus input after modal opens
            setTimeout(() => {
                nameInput.input.focus();
            }, 100);
        }
    };
})();

