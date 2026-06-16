window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.UpdateStartUrl = {
    _modal: null,

    show(selectedIds) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);
        const isBulkMode = count > 1;

        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

        const info = document.createElement('div');
        info.style.cssText = 'font-size: 13px; color: var(--text-secondary); line-height: 1.5;';
        info.innerHTML = isBulkMode 
            ? 'Enter Start URLs for multiple profiles. You can enter one URL for all, or use the format <code>ProfileName|URL</code> (one per line) to assign specific URLs.'
            : 'Enter the Start URL for this profile. Leave empty to use the default new tab page.';
        modalBody.appendChild(info);

        let singleInput = null;
        let bulkTextarea = null;

        if (isBulkMode) {
            bulkTextarea = DuckControls.Textarea.create({
                icon: 'link',
                label: 'Start URLs',
                placeholder: 'https://example.com\nOR\nProfile1|https://example.com\nProfile2|https://google.com',
                rows: 6
            });
            modalBody.appendChild(bulkTextarea.element);
        } else {
            singleInput = DuckControls.Input.create({
                label: 'Start URL',
                placeholder: 'https://example.com',
                icon: 'link'
            });
            modalBody.appendChild(singleInput.element);
        }

        this._modal = DuckControls.Modal.create({
            defaultEnter: !isBulkMode,
            title: 'Update Start URL',
            subtitle: '<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ' + count + ' selected profiles',
            icon: 'link',
            content: modalBody,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Save Start URL', icon: 'save', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    const data = isBulkMode ? bulkTextarea.getValue() : singleInput.getValue();
                    if (!data) {
                        if (isBulkMode) bulkTextarea.setError?.('Please enter at least one ProfileName|URL entry');
                        else singleInput.setError?.('Please enter a Start URL');
                        return;
                    }

                    modal.setLoading(true, 'Saving...');

                    try {
                        const idsArray = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];
                        let bulkMapping = {};
                        let isAllSameUrl = false;
                        let defaultBulkUrl = '';
                        if (isBulkMode) {
                            const lines = data.split('\n').map(l => l.trim()).filter(l => l);
                            const hasPipes = lines.some(l => l.includes('|'));
                            if (!hasPipes) {
                                isAllSameUrl = true;
                                defaultBulkUrl = data.trim();
                            } else {
                                for (let line of lines) {
                                    const parts = line.split('|');
                                    if (parts.length >= 2) {
                                        bulkMapping[parts[0].trim()] = parts.slice(1).join('|').trim();
                                    }
                                }
                            }
                        }

                        for (let id of idsArray) {
                            let p = await DuckBridge.call('profile.get', { id });
                            if (!p) continue;

                            let newUrl;
                            if (isBulkMode) {
                                newUrl = isAllSameUrl ? defaultBulkUrl : bulkMapping[p.name || p.Name];
                            } else {
                                newUrl = data;
                            }
                            if (newUrl === undefined) continue;

                            let profileData = {};
                            try { profileData = JSON.parse(p.profileData || p.ProfileData || '{}'); } catch(e){}
                            profileData.StartUrl = newUrl;

                            await DuckBridge.call('profile.update', {
                                id: p.id ?? p.Id,
                                name: p.name ?? p.Name,
                                groupId: p.groupId ?? p.GroupId,
                                tagIds: p.tagIds ?? p.TagIds,
                                proxyId: p.proxyId ?? p.ProxyId,
                                browserType: p.browserType ?? p.BrowserType,
                                browserVersion: p.browserVersion ?? p.BrowserVersion,
                                profileData: JSON.stringify(profileData),
                                notes: p.notes ?? p.Notes,
                                cookies: p.cookies ?? p.Cookies
                            });
                        }

                        if (window.ProfilesView?.loadProfiles) window.ProfilesView.loadProfiles();
                        
                        modal.close();
                    } catch (err) {
                        modal.setLoading(false);
                        window.DuckControls.Toast?.error?.('Update Failed', err?.message || 'Failed to update Start URL');
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


