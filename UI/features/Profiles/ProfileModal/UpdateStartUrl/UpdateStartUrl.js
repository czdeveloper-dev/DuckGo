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
        info.innerHTML = 'Enter the Start URL(s) for the selected profile(s). In bulk mode, use the format <code>ProfileName|URL</code> (one per line) to assign specific URLs.';
        modalBody.appendChild(info);

        // Toggle between single input and textarea
        const toggleWrap = document.createElement('div');
        toggleWrap.style.cssText = 'display:flex;align-items:center;gap:12px;';

        let useBulkMode = isBulkMode;
        let singleInput = null;
        let bulkTextarea = null;
        let inputContainer = document.createElement('div');
        let textareaContainer = document.createElement('div');

        const toggleCtrl = DuckControls.Checkbox.create(null, {
            label: 'Bulk Mode (Multiple URLs)',
            checked: useBulkMode,
            onChange: (e) => {
                useBulkMode = e.checked;
                if (useBulkMode) {
                    inputContainer.style.display = 'none';
                    textareaContainer.style.display = '';
                } else {
                    inputContainer.style.display = '';
                    textareaContainer.style.display = 'none';
                }
            }
        });
        toggleWrap.appendChild(toggleCtrl.element);
        modalBody.appendChild(toggleWrap);

        // Single input container
        inputContainer.style.display = isBulkMode ? 'none' : '';
        singleInput = DuckControls.Input.create({
            label: 'Start URL',
            placeholder: 'https://example.com',
            icon: 'link'
        });
        inputContainer.appendChild(singleInput.element);
        modalBody.appendChild(inputContainer);

        // Textarea container
        textareaContainer.style.display = isBulkMode ? '' : 'none';
        bulkTextarea = DuckControls.Textarea.create({
            icon: 'link',
            label: 'Start URLs (ProfileName|URL format)',
            placeholder: 'Profile1|https://example.com\nProfile2|https://google.com',
            rows: 6
        });
        textareaContainer.appendChild(bulkTextarea.element);
        modalBody.appendChild(textareaContainer);

        this._modal = DuckControls.Modal.create({
            defaultEnter: !isBulkMode,
            title: 'Update Start URL',
            subtitle: '<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ' + count + ' selected profile(s)',
            icon: 'link',
            content: modalBody,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Save Start URL', icon: 'save', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    const data = useBulkMode ? bulkTextarea.getValue() : singleInput.getValue();
                    if (!data || !data.trim()) {
                        if (useBulkMode) bulkTextarea.setError?.('Please enter at least one URL');
                        else singleInput.setError?.('Please enter a Start URL');
                        return;
                    }

                    modal.setLoading(true, 'Saving...');

                    try {
                        const idsArray = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];
                        let bulkMapping = {};
                        let isAllSameUrl = false;
                        let defaultBulkUrl = '';

                        if (useBulkMode) {
                            const lines = data.split('\n').map(l => l.trim()).filter(l => l);
                            const hasPipes = lines.some(l => l.includes('|'));
                            if (!hasPipes) {
                                // No pipes - same URL for all
                                isAllSameUrl = true;
                                defaultBulkUrl = data.trim();
                            } else {
                                // Parse ProfileName|URL format
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
                            if (useBulkMode) {
                                newUrl = isAllSameUrl ? defaultBulkUrl : bulkMapping[p.name || p.Name];
                            } else {
                                newUrl = data.trim();
                            }
                            if (newUrl === undefined) continue;

                            let profileData = {};
                            try { profileData = JSON.parse(p.profileData || p.ProfileData || '{}'); } catch(e){}
                            profileData.StartUrl = newUrl;

                            await DuckBridge.call('profile.update', {
                                id: p.id || p.Id,
                                name: p.name || p.Name,
                                groupId: p.groupId || p.GroupId || null,
                                tagIds: p.tagIds || p.TagIds || null,
                                proxyId: p.proxyId || p.ProxyId || null,
                                browserType: p.browserType || p.BrowserType || 'Chromium',
                                browserVersion: p.browserVersion || p.BrowserVersion || '138',
                                profileData: JSON.stringify(profileData),
                                notes: p.notes || p.Notes || '',
                                cookies: p.cookies || p.Cookies || null
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


