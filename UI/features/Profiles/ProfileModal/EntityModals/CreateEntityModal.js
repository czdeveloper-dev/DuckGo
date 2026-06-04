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

            const isGroup = type === 'group';
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
                label: `${entityName} Name`,
                placeholder: `e.g. ${isGroup ? 'Facebook Farm' : 'VIP'}`,
                icon: isGroup ? 'folder' : 'label',
            });
            if (isEdit) {
                nameInput.setValue(initialValue);
            }
            modalBody.appendChild(nameInput.element);

            const footerWrap = document.createElement('div');
            footerWrap.style.cssText = 'display:flex; justify-content:flex-end; gap:12px; width:100%;';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'duck-btn duck-btn-surface';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => this._modal && this._modal.close());

            const createBtn = document.createElement('button');
            createBtn.className = 'duck-btn duck-btn-primary';
            createBtn.textContent = isEdit ? 'Save' : 'Create';
            createBtn.addEventListener('click', () => {
                const val = nameInput.getValue().trim();
                if (!val) {
                    if (window.DuckControls && DuckControls.Toast) DuckControls.Toast.error('Validation Error', `${entityName} name is required.`);
                    return;
                }
                if (onSave) onSave(val);
                if (this._modal) this._modal.close();
            });

            footerWrap.appendChild(cancelBtn);
            footerWrap.appendChild(createBtn);

            this._modal = window.DuckControls.Modal.create({
                title: isEdit ? `Edit ${entityName}` : `Create New ${entityName}`,
                icon: isEdit ? 'edit' : (isGroup ? 'folder' : 'label'),
                content: modalBody,
                footer: footerWrap,
                size: 'sm',
                closeOnOverlay: true,
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
