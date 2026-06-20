window.ProxyModals = window.ProxyModals || {};

window.ProxyModals.Usage = {
    _modal: null,
    _proxyId: null,
    _proxyName: null,
    _findBtn: null,
    _tbody: null,
    _tableWrap: null,
    _emptyState: null,
    _loadingEl: null,

    show(proxyId, proxyName = null) {
        this._proxyId = proxyId;
        this._proxyName = proxyName;
        this._tbodyId = `proxy-usage-tbody-${Date.now()}`;
        this._findBtnId = `proxy-usage-find-btn-${Date.now()}`;
        if (this._modal) this._modal.destroy();

        const content = document.createElement('div');
        content.className = 'proxy-usage-modal';
        content.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;height:100%;';

        // Description
        const desc = document.createElement('div');
        desc.className = 'ui-label';
        desc.style.cssText = 'color:var(--text-secondary);font-size:13px;';
        desc.textContent = 'This list shows which profiles are using the selected proxy.';
        content.appendChild(desc);

        // Table container - takes remaining space
        this._tableWrap = document.createElement('div');
        this._tableWrap.className = 'card data-surface';
        this._tableWrap.style.cssText = 'flex:1;min-height:180px;overflow:auto;position:relative;';

        // Table header
        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed;';
        table.innerHTML = `
            <thead style="position:sticky;top:0;background:var(--surface-secondary);z-index:1;">
                <tr style="border-bottom:1px solid var(--border-default);">
                    <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;width:50px;">#</th>
                    <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;width:80px;">ID</th>
                    <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">PROFILE NAME</th>
                    <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">GROUP</th>
                    <th style="padding:10px 12px;text-align:left;color:var(--text-secondary);font-weight:600;">TAGS</th>
                </tr>
            </thead>
            <tbody id="${this._tbodyId}"></tbody>
        `;
        this._tableWrap.appendChild(table);
        content.appendChild(this._tableWrap);

        // Empty state - centered in table
        this._emptyState = document.createElement('div');
        this._emptyState.id = 'proxy-usage-empty';
        this._emptyState.style.cssText = 'display:none;position:absolute;top:0;left:0;right:0;bottom:0;display:none;flex-direction:column;align-items:center;justify-content:center;color:var(--text-tertiary);padding:40px;';
        this._emptyState.innerHTML = `
            <span class="material-symbols-outlined" style="font-size:48px;opacity:0.3;">search_off</span>
            <p style="margin-top:12px;font-size:14px;">No profiles are using this proxy</p>
        `;
        this._tableWrap.appendChild(this._emptyState);

        // Loading state
        this._loadingEl = document.createElement('div');
        this._loadingEl.id = 'proxy-usage-loading';
        this._loadingEl.style.cssText = 'display:none;position:absolute;top:0;left:0;right:0;bottom:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(var(--surface-primary-rgb, 30,30,35),0.8);';
        this._loadingEl.innerHTML = `
            <div class="spinner" style="width:24px;height:24px;border-width:2px;margin:0 auto 12px;"></div>
            <p style="color:var(--text-tertiary);font-size:13px;">Searching profiles...</p>
        `;
        this._tableWrap.appendChild(this._loadingEl);

        // Build subtitle
        const subtitle = proxyName 
            ? `Proxy: ${proxyName}` 
            : `Proxy ID: ${proxyId}`;

        this._modal = DuckControls.Modal.create({
            title: 'Proxy Usage',
            subtitle: subtitle,
            icon: 'account_tree',
            content: content,
            size: 'lg',
            height: 'auto',
            maxHeight: '70vh',
            closeOnOverlay: false,
            buttons: [
                { text: 'Close', class: 'duck-btn-surface', onClick: (e, m) => m.close() },
                { 
                    text: 'Find Profile', 
                    id: this._findBtnId,
                    icon: 'search', 
                    class: 'duck-btn-primary', 
                    disabled: true,
                    onClick: (e, m) => {
                        if (this._foundProfileIds && this._foundProfileIds.length > 0) {
                            m.close();
                            this._navigateToProfile(this._foundProfileIds.join(','));
                        }
                    }
                }
            ],
            onClose: () => { this._modal = null; }
        });

        this._modal.open();

        // Load data
        this._loadData();
    },

    async _loadData() {
        this._tbody = document.getElementById(this._tbodyId);
        if (!this._tbody || !this._emptyState || !this._loadingEl) return;

        // Show loading
        this._showLoading(true);
        this._emptyState.style.display = 'none';

        try {
            let profiles = [];

            // Always use backend API
            if (this._proxyId) {
                try {
                    const result = await DuckBridge.call('proxy.getUsage', { proxyId: this._proxyId });
                    if (result && Array.isArray(result)) {
                        profiles = result;
                    }
                } catch (e) {
                    console.warn('[ProxyUsage] Backend API failed, trying fallback:', e);
                }
            }

            // Fallback: filter from all profiles if backend API failed
            if (profiles.length === 0) {
                try {
                    const allProfiles = await DuckBridge.call('profile.list', {}) || [];
                    profiles = allProfiles.filter(p => {
                        const proxyIdField = p.ProxyId || p.proxyId;
                        return proxyIdField == this._proxyId;
                    });
                } catch (e) {
                    console.warn('[ProxyUsage] Profile list fallback failed:', e);
                }
            }

            // Hide loading
            this._showLoading(false);

            if (profiles.length === 0) {
                this._emptyState.style.display = 'flex';
                this._setFindButtonEnabled(false);
                this._foundProfileIds = [];
                return;
            }

            this._emptyState.style.display = 'none';
            this._foundProfileIds = profiles.map(p => p.id || p.Id || p.ID).filter(Boolean);
            this._setFindButtonEnabled(true);

            // Render rows
            profiles.forEach((profile, index) => {
                const row = document.createElement('tr');
                row.style.cssText = 'border-bottom:1px solid var(--border-muted);cursor:pointer;transition:background 0.15s;';
                row.addEventListener('mouseenter', () => row.style.background = 'var(--surface-hover)');
                row.addEventListener('mouseleave', () => row.style.background = '');

                const profileId = profile.id || profile.Id || profile.ID;
                const profileName = profile.name || profile.Name || profile.NAME || 'Unnamed';
                const groupName = profile.groupName || profile.GroupName || profile.Group || '-';
                const tagNames = profile.tagNames || profile.TagNames || profile.Tags || [];
                const tags = Array.isArray(tagNames) && tagNames.length > 0 
                    ? tagNames.map(t => `<span style="display:inline-block;padding:2px 6px;background:var(--surface-tertiary);border-radius:4px;font-size:11px;margin-right:4px;">${this._escapeHtml(String(t))}</span>`).join('')
                    : '<span style="color:var(--text-tertiary);">-</span>';

                row.innerHTML = `
                    <td style="padding:10px 12px;color:var(--text-tertiary);white-space:nowrap;">${index + 1}</td>
                    <td style="padding:10px 12px;color:var(--text-secondary);font-family:monospace;font-size:12px;white-space:nowrap;">${profileId}</td>
                    <td style="padding:10px 12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this._escapeHtml(profileName)}">${this._escapeHtml(profileName)}</td>
                    <td style="padding:10px 12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this._escapeHtml(groupName)}">${this._escapeHtml(groupName)}</td>
                    <td style="padding:10px 12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tags}</td>
                `;
                
                row.addEventListener('click', () => {
                    if (this._modal) this._modal.close();
                    this._navigateToProfile(profileId);
                });
                
                this._tbody.appendChild(row);
            });

        } catch (e) {
            console.error('[ProxyUsage] Load failed:', e);
            this._showLoading(false);
            this._emptyState.innerHTML = `
                <span class="material-symbols-outlined" style="font-size:48px;opacity:0.3;color:var(--danger);">error</span>
                <p style="margin-top:12px;color:var(--danger);font-size:14px;">Failed to load data</p>
                <p style="color:var(--text-tertiary);font-size:12px;margin-top:8px;">${this._escapeHtml(e.message || 'Unknown error')}</p>
            `;
            this._emptyState.style.display = 'flex';
            this._setFindButtonEnabled(false);
        }
    },

    _showLoading(show) {
        if (this._loadingEl) {
            this._loadingEl.style.display = show ? 'flex' : 'none';
        }
        if (this._tableWrap) {
            this._tableWrap.style.cursor = show ? 'wait' : '';
        }
    },

    _setFindButtonEnabled(enabled) {
        if (!this._modal || !this._modal._btnInstances) return;

        // The "Find Profile" button is the second button in the buttons array (index 1)
        // See DuckControls.Modal.create config in show()
        const findBtnInstance = this._modal._btnInstances[1];
        if (findBtnInstance && typeof findBtnInstance.setDisabled === 'function') {
            findBtnInstance.setDisabled(!enabled);
        }
    },

    _navigateToProfile(profileId) {
        if (window.DuckApp) {
            window.DuckApp.showView('profiles');
            setTimeout(() => {
                if (window.ProfilesView) {
                    if (window.ProfilesView._idCtrl) {
                        window.ProfilesView._idCtrl.setValue(String(profileId));
                    }
                    if (window.ProfilesView._filters) {
                        window.ProfilesView._filters.id = String(profileId);
                    }
                    window.ProfilesView.loadProfiles?.();
                }
            }, 150);
        }
    },

    _escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};
