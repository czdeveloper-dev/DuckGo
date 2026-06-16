window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.SetBrowserVersion = {
    _modal: null,

    show(selectedIds) {
        if (!selectedIds) selectedIds = new Set();
        // Handle array conversion
        const idSet = selectedIds instanceof Set ? selectedIds : new Set(selectedIds);
        const idsArray = Array.from(idSet);
        const count = idsArray.length;

        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'font-size: 13px; color: var(--text-primary); line-height: 1.5; min-height: 150px; position: relative;';

        const loader = document.createElement('div');
        loader.style.cssText = 'position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-base); z-index: 10; transition: opacity 0.3s;';
        loader.innerHTML = `
            <div class="duck-spinner-ring" style="width:28px;height:28px;margin-bottom:12px;"></div>
            <div style="color: var(--text-secondary);">Fetching available versions...</div>
        `;
        modalBody.appendChild(loader);

        const contentWrap = document.createElement('div');
        contentWrap.style.cssText = 'opacity: 0; transition: opacity 0.3s; display: flex; flex-direction: column; gap: 16px; pointer-events: none;';
        modalBody.appendChild(contentWrap);

        let autoUpdateUA = true;
        let versionCombo = null;
        let selectedVersion = '';

        this._modal = DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Set Browser Version',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ${count} selected profiles`,
            icon: 'manage_history',
            content: modalBody,
            size: 'md',
            closeOnOverlay: true,
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Update Version', icon: 'update', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    const version = versionCombo ? versionCombo.getValue() : '';
                    if (!version) return;
                    
                    modal.setLoading(true, 'Updating...');

                    try {
                        await DuckBridge.call('profile.bulkUpdateBrowserVersion', {
                            ids: idsArray,
                            version: version,
                            autoUpdateUA: autoUpdateUA
                        });
                        if (window.ProfilesView?.loadProfiles) await window.ProfilesView.loadProfiles();
                        modal.close();
                    } catch (err) {
                        modal.setLoading(false);
                        window.DuckControls.Toast?.error?.('Update Failed', err?.message || 'Failed to update browser version');
                    }
                }}
            ],
            onClose: () => {
                this._modal = null;
            }
        });

        this._modal.open();

        const submitBtn = this._modal.element.querySelector('.duck-btn-primary');
        if (submitBtn) submitBtn.disabled = true;

        // Get the browser type and version from the first selected profile
        let browserType = 'Chromium';
        let currentVersion = '';
        if (idsArray.length > 0 && window.ProfilesView?._profilesData) {
            const profile = window.ProfilesView._profilesData.find(p => p.id === idsArray[0]);
            if (profile) {
                if (profile.browserType) browserType = profile.browserType;
                if (profile.browserVersion) currentVersion = profile.browserVersion;
            }
        }

        DuckBridge.call('browser.listVersions').then(catalog => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);

            const browserDef = catalog?.Browsers?.find(b => b.BrowserType?.toLowerCase() === browserType.toLowerCase());
            const versions = browserDef?.Versions || [];
            
            let options = versions.map(v => ({
                label: `${browserDef?.BrowserType || browserType} ${v.Version} ${v.Description ? `(${v.Description})` : ''}`,
                value: v.Version
            }));

            if (options.length === 0) {
                options = [{ label: `No versions found for ${browserType}`, value: '' }];
            }

            // Fallback to first if current version not found in the catalog
            let preSelected = currentVersion;
            if (!preSelected || !options.find(o => o.value === preSelected)) {
                preSelected = options[0].value;
            }

            const versionWrap = document.createElement('div');
            versionWrap.style.cssText = 'background: var(--bg-subtle); padding: 16px; border-radius: 6px; border: 1px solid var(--border-light); display: flex; flex-direction: column; gap: 12px;';

            versionCombo = DuckControls.ComboBox.create({
                icon: 'update',
                label: `Select Target Version for ${browserType}`,
                options: options,
                value: preSelected,
                onChange: (val) => {
                    selectedVersion = val;
                }
            });
            versionWrap.appendChild(versionCombo.element);

            const note = document.createElement('div');
            note.style.cssText = 'font-size: 12px; color: var(--text-secondary); line-height: 1.5;';
            note.innerHTML = `<span style="color: var(--accent); font-weight: 500;">Note:</span> This action will securely switch the core browser version. It will trigger a download if the core is not already cached locally.`;
            versionWrap.appendChild(note);
            contentWrap.appendChild(versionWrap);

            const cbWrap = document.createElement('div');
            contentWrap.appendChild(cbWrap);

            DuckControls.Checkbox.create(cbWrap, {
                label: 'Automatically update User-Agent to match browser version (Recommended)',
                checked: true,
                onChange: (e) => {
                    autoUpdateUA = e.checked;
                }
            });

            contentWrap.style.opacity = '1';
            contentWrap.style.pointerEvents = 'auto';
            if (submitBtn && options[0].value) submitBtn.disabled = false;
        }).catch(err => {
            console.error('Failed to fetch browser versions:', err);
            loader.innerHTML = `<div style="color: var(--danger);">Failed to load versions. Please try again.</div>`;
        });
    }
};


