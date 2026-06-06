// BulkRename.js - Bulk Rename Profiles

(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};

    window.ProfileModals.BulkRename = {
        _modal: null,
        _profiles: [],
        _computedNames: [],

        show(selectedProfiles) {
            this._profiles = selectedProfiles;
            if (this._profiles.length === 0) return;
            
            // Generate initial state mapping
            this._computedNames = this._profiles.map(p => ({
                id: p.id,
                oldName: p.name,
                newName: p.name
            }));

            if (this._modal) {
                this._modal.destroy();
            }

            const modalBody = document.createElement('div');
            modalBody.style.cssText = 'display:flex; flex-direction:column; gap:16px; height: 100%;';

            // 1. Top Banner
            const banner = document.createElement('div');
            banner.style.cssText = 'background: #f4f6fc; border: 1px solid #d4ddf1; border-radius: 8px; padding: 16px; display: flex; align-items: flex-start; gap: 12px;';
            
            const bannerIcon = document.createElement('span');
            bannerIcon.className = 'material-symbols-outlined';
            bannerIcon.textContent = 'playlist_add_check';
            bannerIcon.style.cssText = 'color: #5a73d8; transform: scaleX(-1); font-size: 22px;'; // Flip icon horizontally to match screenshot
            
            const bannerContent = document.createElement('div');
            bannerContent.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
            const bannerTitle = document.createElement('div');
            bannerTitle.style.cssText = 'font-weight: 600; font-size: 14px; color: #1e293b;';
            bannerTitle.textContent = 'Batch Editor active';
            const bannerSub = document.createElement('div');
            bannerSub.style.cssText = 'font-size: 13px; color: #64748b;';
            bannerSub.textContent = 'Only rows with a valid non-empty name will be submitted to the database.';
            
            bannerContent.appendChild(bannerTitle);
            bannerContent.appendChild(bannerSub);
            banner.appendChild(bannerIcon);
            banner.appendChild(bannerContent);
            modalBody.appendChild(banner);

            // 2. Middle Section (Dashed Border)
            const controlsWrap = document.createElement('div');
            controlsWrap.style.cssText = 'border: 1px dashed var(--border-default); border-radius: 8px; padding: 16px; display: flex; align-items: flex-end; gap: 16px;';
            
            const prefixContainer = document.createElement('div');
            prefixContainer.style.flex = '1';
            const prefixCtrl = window.DuckControls.Input.create({
                label: 'PATTERN / PREFIX',
                placeholder: 'e.g., ACCOUNT_',
                icon: 'text_format'
            });
            prefixContainer.appendChild(prefixCtrl.element);
            
            // Adjust label style
            const pLabel = prefixCtrl.element.querySelector('.ui-label');
            if(pLabel) {
                pLabel.style.color = '#8e9eab';
                pLabel.style.fontWeight = '600';
                pLabel.style.fontSize = '11px';
            }

            const startContainer = document.createElement('div');
            startContainer.style.width = '140px';
            const startCtrl = window.DuckControls.Input.create({
                label: 'START NO.',
                placeholder: '1',
                icon: 'numbers'
            });
            startCtrl.setValue('1');
            startContainer.appendChild(startCtrl.element);
            
            const sLabel = startCtrl.element.querySelector('.ui-label');
            if(sLabel) {
                sLabel.style.color = '#8e9eab';
                sLabel.style.fontWeight = '600';
                sLabel.style.fontSize = '12px';
            }

            const applyBtnWrap = document.createElement('div');
            const applyBtn = document.createElement('button');
            applyBtn.className = 'duck-btn duck-btn-surface';
            applyBtn.textContent = 'Apply';
            applyBtn.style.height = '36px'; // align with input height
            applyBtn.style.padding = '0 16px';
            applyBtn.style.fontWeight = '500';
            applyBtnWrap.appendChild(applyBtn);

            controlsWrap.appendChild(prefixContainer);
            controlsWrap.appendChild(startContainer);
            controlsWrap.appendChild(applyBtnWrap);
            modalBody.appendChild(controlsWrap);

            // 3. Bottom Section (List of rows)
            const listWrap = document.createElement('div');
            listWrap.style.cssText = 'flex: 1; min-height: 0; border: 1px solid var(--border-default); background: var(--bg-subtle, #f8fafc); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto;';
            
            const inputElements = []; // Store input refs to update later

            this._computedNames.forEach((item) => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; align-items: center; gap: 16px;';
                
                const oldNameDiv = document.createElement('div');
                oldNameDiv.style.cssText = 'flex: 1; font-size: 13px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 4px;';
                oldNameDiv.textContent = item.oldName;
                oldNameDiv.title = item.oldName;
                
                const arrow = document.createElement('span');
                arrow.className = 'material-symbols-outlined';
                arrow.textContent = 'arrow_forward';
                arrow.style.cssText = 'font-size: 18px; color: #94a3b8;';
                
                const newNameContainer = document.createElement('div');
                newNameContainer.style.cssText = 'flex: 1;';
                
                // Native input styled beautifully
                const newNameInput = document.createElement('input');
                newNameInput.type = 'text';
                newNameInput.style.cssText = 'width: 100%; box-sizing: border-box; height: 32px; padding: 0 10px; border: 1px solid var(--border-default); border-radius: 6px; font-size: 13px; color: var(--text-primary); outline: none; background: var(--bg-base); box-shadow: 0 1px 2px rgba(0,0,0,0.02); transition: border-color 0.2s;';
                newNameInput.value = item.newName;
                
                newNameInput.addEventListener('focus', () => {
                    newNameInput.style.borderColor = 'var(--accent)';
                });
                newNameInput.addEventListener('blur', () => {
                    newNameInput.style.borderColor = 'var(--border-default)';
                });
                newNameInput.addEventListener('input', (e) => {
                    item.newName = e.target.value;
                });
                
                inputElements.push({ input: newNameInput, data: item });
                
                newNameContainer.appendChild(newNameInput);
                row.appendChild(oldNameDiv);
                row.appendChild(arrow);
                row.appendChild(newNameContainer);
                listWrap.appendChild(row);
            });

            modalBody.appendChild(listWrap);

            // Apply logic
            applyBtn.addEventListener('click', () => {
                const prefix = prefixCtrl.getValue();
                const startStr = startCtrl.getValue() || '1';
                let startNum = parseInt(startStr, 10);
                if (isNaN(startNum)) startNum = 1;
                
                inputElements.forEach((el, index) => {
                    const newName = `${prefix}${startNum + index}`;
                    el.input.value = newName;
                    el.data.newName = newName;
                });
            });

            this._modal = window.DuckControls.Modal.create({
            defaultEnter: true,
                title: 'Bulk Rename Editor',
                subtitle: 'Rename multiple profiles using a pattern or prefix.',
                icon: 'edit_note',
                content: modalBody,
                size: 'lg',
                buttons: [
                    { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, m) => m.close() },
                    { text: 'Submit to database', icon: 'save', class: 'duck-btn-primary', onClick: () => {
                        const validData = this._computedNames.filter(c => c.newName && c.newName.trim() !== '');
                        if (validData.length === 0) {
                            return;
                        }
                        this._applyRename();
                    }}
                ],
                closeOnOverlay: false,
                onClose: () => { this._modal = null; }
            });

            this._modal.container.style.height = '75vh';
            this._modal.open();
        },

        async _applyRename() {
            if (!this._computedNames || this._computedNames.length === 0) return;
            
            // Filter only valid non-empty names as per the banner warning
            const changes = this._computedNames
                .filter(x => x.newName !== x.oldName && x.newName.trim() !== '')
                .map(x => ({
                    id: x.id,
                    name: x.newName.trim()
                }));
            
            if (changes.length === 0) {
                return;
            }
            
            try {
                const promises = changes.map(c => window._duckBridge.call('profile.update', { id: c.id, changes: { Name: c.name } }));
                await Promise.all(promises);
                
                if (this._modal) this._modal.close();
                
                if (window.app && typeof window.app.loadProfiles === 'function') {
                    window.app.loadProfiles();
                } else {
                    const event = new CustomEvent('profiles-updated');
                    window.dispatchEvent(event);
                }
            } catch (err) {
                console.error('Bulk Rename Error:', err);
                // toast handled by DuckBridge
            }
        }
    };
})();
