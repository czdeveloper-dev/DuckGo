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
        let browserTypeCombo = null;
        let versionCombo = null;
        let selectedBrowserType = '';
        let selectedVersion = '';

        this._modal = DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Set Browser Version',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ${count} selected profile(s)`,
            icon: 'manage_history',
            content: modalBody,
            size: 'md',
            closeOnOverlay: true,
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Update Version', icon: 'update', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    const browserType = selectedBrowserType || browserTypeCombo?.getValue?.() || '';
                    const version = selectedVersion || versionCombo?.getValue?.() || '';
                    if (!browserType || !version) {
                        window.DuckControls.Toast?.warning?.('Missing Selection', 'Please select both browser type and version');
                        return;
                    }
                    
                    modal.setLoading(true, 'Updating...');

                    try {
                        await DuckBridge.call('profile.bulkUpdateBrowserVersion', {
                            ids: idsArray,
                            browserType: browserType,
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

        const submitBtn = this._modal.container?.querySelector('.duck-btn-primary');
        if (submitBtn) submitBtn.disabled = true;

        // Get the browser type and version from the first selected profile
        let defaultBrowserType = 'chromium';
        let currentVersion = '';
        if (idsArray.length > 0 && window.ProfilesView?._profilesData) {
            const profile = window.ProfilesView._profilesData.find(p => p.id === idsArray[0]);
            if (profile) {
                if (profile.browserType) defaultBrowserType = profile.browserType.toLowerCase();
                if (profile.browserVersion) currentVersion = profile.browserVersion;
            }
        }

        DuckBridge.call('browser.listVersions').then(catalog => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);

            const browsers = catalog?.Browsers || [];
            
            // Build browser type options
            let browserOptions = browsers.map(b => ({
                label: b.BrowserType || b.browserType || 'Unknown',
                value: (b.BrowserType || b.browserType || '').toLowerCase()
            }));

            if (browserOptions.length === 0) {
                browserOptions = [{ label: 'No browsers found', value: '' }];
            }

            // Find default browser
            let preSelectedBrowser = browserOptions.find(o => o.value === defaultBrowserType)?.value;
            if (!preSelectedBrowser && browserOptions.length > 0) {
                preSelectedBrowser = browserOptions[0].value;
            }

            selectedBrowserType = preSelectedBrowser;

            // Version Selector
            const versionWrap = document.createElement('div');
            versionWrap.id = 'version-selector-wrap';
            versionWrap.style.cssText = 'background: var(--bg-subtle); padding: 16px; border-radius: 6px; border: 1px solid var(--border-light); display: flex; flex-direction: column; gap: 12px;';

            versionCombo = DuckControls.Select.create({
                icon: 'update',
                label: 'Select Version',
                options: [{ label: 'Loading...', value: '' }],
                value: '',
                width: '100%',
                onChange: (val) => {
                    selectedVersion = val;
                    if (submitBtn) submitBtn.disabled = !val;
                }
            });
            versionWrap.appendChild(versionCombo.element);

            const note = document.createElement('div');
            note.style.cssText = 'font-size: 12px; color: var(--text-secondary); line-height: 1.5;';
            note.innerHTML = `<span style="color: var(--accent); font-weight: 500;">Note:</span> This action will securely switch the browser version. It may trigger a download if not cached locally.`;
            versionWrap.appendChild(note);

            contentWrap.appendChild(versionWrap);

            // Checkbox for auto update UA
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

            // Initial load of versions for default browser
            this._updateVersionCombo(preSelectedBrowser, browsers, currentVersion);

        }).catch(err => {
            console.error('Failed to fetch browser versions:', err);
            loader.innerHTML = `<div style="color: var(--danger);">Failed to load versions. Please try again.</div>`;
        });
    },

    _updateVersionCombo(browserType, browsers, preSelectVersion) {
        const versionWrap = document.getElementById('version-selector-wrap');
        if (!versionWrap) return;

        const browserDef = browsers.find(b => (b.BrowserType || b.browserType || '').toLowerCase() === browserType);
        const versions = browserDef?.Versions || [];
        
        let options = versions.map(v => ({
            label: v.Version || v.version || '',
            value: v.Version || v.version || ''
        }));

        if (options.length === 0) {
            options = [{ label: 'No versions found', value: '' }];
        }

        // Try to pre-select current version or first option
        let selectedVal = preSelectVersion || '';
        if (!selectedVal || !options.find(o => o.value === selectedVal)) {
            selectedVal = options[0]?.value || '';
        }

        // Update combobox
        const selectEl = versionWrap.querySelector('.duck-select');
        if (selectEl) {
            selectEl.innerHTML = options.map(o => 
                `<option value="${o.value}" ${o.value === selectedVal ? 'selected' : ''}>${o.label}</option>`
            ).join('');
            
            const data = { value: selectedVal };
            selectEl.dispatchEvent(new Event('change', { bubbles: true, detail: data }));
        }
    }
};


