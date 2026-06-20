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
            
            // Generate initial state mapping (profile data uses Id, not id)
            this._computedNames = this._profiles.map(p => ({
                id: p.Id || p.id,
                oldName: p.Name || p.name,
                newName: p.Name || p.name
            }));

            if (this._modal) {
                this._modal.destroy();
            }

            const modalBody = document.createElement('div');
            modalBody.style.cssText = 'display:flex; flex-direction:column; gap:16px; height: 100%;';

            // 1. Top Banner
            const banner = document.createElement('div');
            banner.style.cssText = 'background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px; display: flex; align-items: flex-start; gap: 12px;';
            
            const bannerIcon = document.createElement('span');
            bannerIcon.className = 'material-symbols-outlined';
            bannerIcon.textContent = 'playlist_add_check';
            bannerIcon.style.cssText = 'color: var(--primary); transform: scaleX(-1); font-size: 22px;'; 
            
            const bannerContent = document.createElement('div');
            bannerContent.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
            const bannerTitle = document.createElement('div');
            bannerTitle.style.cssText = 'font-weight: 600; font-size: 14px; color: var(--text-primary);';
            bannerTitle.textContent = 'Batch Editor active';
            const bannerSub = document.createElement('div');
            bannerSub.style.cssText = 'font-size: 13px; color: var(--text-secondary);';
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
                pLabel.style.color = 'var(--text-secondary)';
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
                sLabel.style.color = 'var(--text-secondary)';
                sLabel.style.fontWeight = '600';
                sLabel.style.fontSize = '12px';
            }

            // Apply button will be created below after inputs
            const applyBtnWrap = document.createElement('div');
            
            controlsWrap.appendChild(prefixContainer);
            controlsWrap.appendChild(startContainer);
            controlsWrap.appendChild(applyBtnWrap);
            modalBody.appendChild(controlsWrap);

            // 3. Bottom Section (List of rows)
            const listWrap = document.createElement('div');
            listWrap.style.cssText = 'flex: 1; min-height: 0; border: 1px solid var(--border-default); background: var(--bg-surface); border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto;';
            
            const inputControls = []; // Store Input control refs to update later

            this._computedNames.forEach((item) => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; align-items: center; gap: 16px;';
                
                const oldNameDiv = document.createElement('div');
                oldNameDiv.style.cssText = 'flex: 1; font-size: 13px; color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 4px;';
                oldNameDiv.textContent = item.oldName || '-';
                oldNameDiv.title = item.oldName;
                
                const arrow = document.createElement('span');
                arrow.className = 'material-symbols-outlined';
                arrow.textContent = 'arrow_forward';
                arrow.style.cssText = 'font-size: 18px; color: var(--text-muted, #94a3b8);';
                
                const newNameContainer = document.createElement('div');
                newNameContainer.style.cssText = 'flex: 1;';
                
                // Use DuckControls Input instead of native input
                const inputCtrl = window.DuckControls.Input.create({
                    icon: 'edit_document',
                    placeholder: 'New name...',
                    value: item.newName
                });
                inputCtrl.element.style.flex = '1';
                
                // Listen for input changes
                const inputEl = inputCtrl.input;
                inputEl.addEventListener('input', (e) => {
                    item.newName = e.target.value;
                });
                inputEl.addEventListener('blur', () => {
                    item.newName = inputCtrl.getValue();
                });
                
                inputControls.push({ ctrl: inputCtrl, data: item });
                
                newNameContainer.appendChild(inputCtrl.element);
                row.appendChild(oldNameDiv);
                row.appendChild(arrow);
                row.appendChild(newNameContainer);
                listWrap.appendChild(row);
            });

            modalBody.appendChild(listWrap);

            // Add apply button to the controls wrap
            const applyBtnContainer = document.createElement('button');
            DuckControls.Button.create(applyBtnContainer, {
                text: 'Apply',
                variant: 'secondary',
                icon: 'auto_fix_high',
                onClick: () => {
                    const prefix = prefixCtrl.getValue();
                    const startStr = startCtrl.getValue() || '1';
                    let startNum = parseInt(startStr, 10);
                    if (isNaN(startNum)) startNum = 1;
                    
                    inputControls.forEach((el, index) => {
                        const newName = `${prefix}${startNum + index}`;
                        el.ctrl.setValue(newName);
                        el.data.newName = newName;
                    });
                }
            });
            applyBtnWrap.appendChild(applyBtnContainer);

            this._modal = window.DuckControls.Modal.create({
                defaultEnter: true,
                title: 'Bulk Rename Editor',
                subtitle: 'Rename multiple profiles using a pattern or prefix.',
                icon: 'edit_note',
                content: modalBody,
                width: '600px',
                height: '70vh',
                buttons: [
                    { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                    { text: 'Submit Changes', icon: 'save', class: 'duck-btn-primary', onClick: async (e, modal) => {
                        modal.setLoading(true, 'Saving changes...');
                        try {
                            const updates = inputControls
                                .filter(item => item.data.newName && item.data.newName.trim() !== '')
                                .map(item => ({
                                    id: item.data.id,
                                    name: item.data.newName.trim()
                                }));
                            
                            if (updates.length > 0) {
                                for (const update of updates) {
                                    // Fetch current profile to preserve other fields
                                    const profile = await DuckBridge.call('profile.get', { id: update.id });
                                    if (profile) {
                                        await DuckBridge.call('profile.update', {
                                            id: update.id,
                                            name: update.name,
                                            groupId: profile.groupId,
                                            tagIds: profile.tagIds,
                                            proxyId: profile.proxyId,
                                            browserType: profile.browserType,
                                            browserVersion: profile.browserVersion,
                                            profileData: profile.profileData,
                                            notes: profile.notes,
                                            cookies: profile.cookies
                                        });
                                    }
                                }
                            }
                            
                            modal.close();
                            if (window.DuckApp && window.DuckApp.Profiles) {
                                window.DuckApp.Profiles.refresh();
                            }
                            window.DuckControls.Toast?.success?.('Success', `Updated ${updates.length} profiles successfully.`);
                        } catch (err) {
                            modal.setLoading(false);
                            console.error(err);
                            window.DuckControls.Toast?.error?.('Update Failed', err?.message || 'An error occurred while saving.');
                        }
                    }}
                ],
                onClose: () => {
                    this._modal = null;
                }
            });

            this._modal.open();
        }
    };
})();
