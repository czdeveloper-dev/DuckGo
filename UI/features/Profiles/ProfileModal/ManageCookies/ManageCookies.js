window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.ManageCookies = {
    _modal: null,
    _profileId: null,
    _cookies: [],

    async show(selectedIds) {
        if (this._modal) { this._modal.destroy(); this._modal = null; }

        const isSingle = selectedIds && selectedIds.length === 1;
        if (!isSingle) {
            window.DuckControls?.Toast?.warning?.('Select exactly one profile to manage cookies.');
            return;
        }

        this._profileId = selectedIds[0];

        // Load cookies from backend
        try {
            const profile = await DuckBridge.call('profile.get', { id: this._profileId });
            this._cookies = this._parseCookies(profile?.Cookies);
        } catch (e) {
            console.warn('[ManageCookies] Failed to load cookies', e);
            this._cookies = [];
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex;flex-direction:column;gap:16px;height:100%;';

        // â”€â”€ Cookie count badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const metaRow = document.createElement('div');
        metaRow.style.cssText = 'display:flex;align-items:center;gap:10px;';

        const countBadge = document.createElement('span');
        countBadge.id = '_cookieCount';
        this._countBadge = countBadge;

        const lastSaved = document.createElement('span');
        lastSaved.id = '_lastSaved';
        lastSaved.style.cssText = 'font-size:11px;color:var(--text-muted);margin-left:auto;';
        this._lastSavedEl = lastSaved;
        this._updateMeta();

        metaRow.appendChild(countBadge);
        metaRow.appendChild(lastSaved);
        modalBody.appendChild(metaRow);

        // â”€â”€ Table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const tableContainer = document.createElement('div');
        tableContainer.style.cssText = 'flex:1;overflow-y:auto;border:1px solid var(--border-default);border-radius:var(--r-md);background:var(--bg-elevated);';

        const table = document.createElement('table');
        table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;text-align:left;table-layout:fixed;';

        const thead = document.createElement('thead');
        thead.style.cssText = 'position:sticky;top:0;background:var(--bg-surface);box-shadow:0 1px 0 var(--border-default);z-index:10;';
        thead.innerHTML = `
            <tr>
                <th style="padding:8px 12px;font-weight:600;color:var(--text-secondary);width:22%;">Name</th>
                <th style="padding:8px 12px;font-weight:600;color:var(--text-secondary);width:22%;">Domain</th>
                <th style="padding:8px 12px;font-weight:600;color:var(--text-secondary);width:38%;">Value</th>
                <th style="padding:8px 12px;font-weight:600;color:var(--text-secondary);width:18%;">Expires</th>
            </tr>`;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.id = '_cookieBody';
        table.appendChild(tbody);
        // â”€â”€ Search / filter â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const searchRow = document.createElement('div');
        searchRow.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';

        const searchIn = window.DuckControls.Input.create({
                icon: 'cookie',
            placeholder: 'Filter cookies by name or domain...',
            icon: 'search',
            onInput: (e) => this._renderTable(e.target.value)
        });
        searchIn.element.style.flex = '1';
        this._searchInput = searchIn;
        searchRow.appendChild(searchIn.element);

        const addBtn = window.DuckControls.Button.create(null, {
            text: 'Add', icon: 'add', variant: 'surface',
            onClick: () => this._showAddCookieDialog()
        });
        searchRow.appendChild(addBtn.element);
        modalBody.appendChild(searchRow);

        tableContainer.appendChild(table);
        modalBody.appendChild(tableContainer);

        // â”€â”€ Pending changes indicator â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const dirtyBanner = document.createElement('div');
        dirtyBanner.id = '_dirtyBanner';
        dirtyBanner.style.cssText = 'display:none;align-items:center;gap:8px;padding:8px 12px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.4);border-radius:6px;font-size:12px;color:var(--warning,#f59e0b);';
        dirtyBanner.innerHTML = '<span class="material-symbols-outlined" style="font-size:14px">edit</span> Unsaved changes â€” click Save to persist.';
        this._dirtyBanner = dirtyBanner;
        modalBody.appendChild(dirtyBanner);

        this._renderTable();

        // â”€â”€ Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        const buttons = [
            {
                text: 'Import JSON', icon: 'upload', class: 'duck-btn-surface', position: 'left',
                onClick: () => this._importCookies()
            },
            {
                text: 'Export JSON', icon: 'download', class: 'duck-btn-surface', position: 'left',
                onClick: () => this._exportCookies()
            },
            {
                text: 'Clear All', icon: 'delete_sweep', class: 'duck-btn-danger',
                onClick: () => this._clearAll()
            },
            {
                text: 'Save', icon: 'save', class: 'duck-btn-primary',
                onClick: () => this._saveCookies()
            },
            { text: 'Close', class: 'duck-btn-secondary', onClick: () => this._modal?.close?.() }
        ];

        this._modal = window.DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Manage Cookies',
            subtitle: `Profile #${this._profileId} â€” view, add, or remove cookies`,
            icon: 'cookie',
            content: modalBody,
            size: 'xl',
            buttons,
            closeOnOverlay: false,
            onClose: () => { this._modal = null; this._profileId = null; }
        });

        this._modal.open();
    },

    _parseCookies(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        try { return JSON.parse(raw) || []; } catch { return []; }
    },

    _isDirty: false,

    _markDirty() {
        this._isDirty = true;
        if (this._dirtyBanner) this._dirtyBanner.style.display = 'flex';
    },

    _markClean() {
        this._isDirty = false;
        if (this._dirtyBanner) this._dirtyBanner.style.display = 'none';
    },

    _updateMeta() {
        if (!this._countBadge) return;
        const n = this._cookies.length;
        this._countBadge.textContent = `${n} cookie${n !== 1 ? 's' : ''} stored`;
        this._countBadge.style.cssText = 'font-size:12px;color:var(--text-secondary);';
    },

    _renderTable(filter = '') {
        const tbody = document.getElementById('_cookieBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const lower = filter.toLowerCase();
        const visible = this._cookies.filter(c =>
            !filter || (c.name || '').toLowerCase().includes(lower) || (c.domain || '').toLowerCase().includes(lower)
        );

        if (visible.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="4" style="padding:24px;text-align:center;color:var(--text-tertiary);">${filter ? 'No matching cookies' : 'No cookies stored yet'}</td>`;
            tbody.appendChild(tr);
            return;
        }

        visible.forEach((c, i) => {
            const tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom:1px solid var(--border-default);cursor:pointer;transition:background 0.1s;';
            tr.addEventListener('mouseenter', () => tr.style.background = 'var(--bg-hover, rgba(0,0,0,0.04))');
            tr.addEventListener('mouseleave', () => tr.style.background = '');
            tr.addEventListener('click', () => this._showCookieDetail(c, i));

            const exp = c.expires
                ? (new Date(c.expires)).toLocaleDateString()
                : 'Session';

            const escapeHtml = (s) => String(s || '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch] || ch));

            tr.innerHTML = `
                <td style="padding:8px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</td>
                <td style="padding:8px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(c.domain)}">${escapeHtml(c.domain)}</td>
                <td style="padding:8px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:monospace;font-size:11px;color:var(--text-secondary);" title="${escapeHtml(c.value)}">${escapeHtml(c.value)}</td>
                <td style="padding:8px 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;">${escapeHtml(exp)}</td>`;
            tbody.appendChild(tr);
        });
    },

    _showCookieDetail(c, index) {
        const modal = window.DuckControls.Modal.create({
            defaultEnter: false,
            title: 'Cookie Detail',
            icon: 'cookie',
            content: null,
            size: 'md',
            buttons: [
                {
                    text: 'Delete', icon: 'delete', class: 'duck-btn-danger',
                    onClick: () => {
                        this._cookies.splice(index, 1);
                        this._markDirty();
                        this._renderTable(this._searchInput?.getValue?.() || '');
                        this._updateMeta();
                        modal.close();
                    }
                },
                { text: 'Close', class: 'duck-btn-secondary', onClick: () => modal.close() }
            ]
        });

        const content = document.createElement('div');
        content.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

        const field = (label, value, mono = false) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
            const lbl = document.createElement('div');
            lbl.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;';
            lbl.textContent = label;
            const val = document.createElement('div');
            val.style.cssText = `font-size:13px;color:var(--text-primary);word-break:break-all;${mono ? 'font-family:monospace;background:var(--bg-subtle);padding:8px;border-radius:4px;' : ''}`;
            val.textContent = value || 'â€”';
            row.appendChild(lbl);
            row.appendChild(val);
            return row;
        };

        content.appendChild(field('Name', c.name));
        content.appendChild(field('Domain', c.domain));
        content.appendChild(field('Value', c.value, true));
        content.appendChild(field('Path', c.path));
        content.appendChild(field('Expires', c.expires ? new Date(c.expires).toLocaleString() : 'Session'));
        content.appendChild(field('HTTP Only', c.httpOnly ? 'Yes' : 'No'));
        content.appendChild(field('Secure', c.secure ? 'Yes' : 'No'));
        content.appendChild(field('SameSite', c.sameSite));

        modal._contentEl?.appendChild?.(content) || modal.container?.querySelector('.modal-content')?.appendChild(content);
        modal.open();
    },

    _showAddCookieDialog() {
        const fields = {
            name: window.DuckControls.Input.create({
                icon: 'cookie', label: 'Name *', placeholder: 'e.g. session_id' }),
            domain: window.DuckControls.Input.create({
                icon: 'cookie', label: 'Domain *', placeholder: 'e.g. .google.com' }),
            value: window.DuckControls.Input.create({
                icon: 'cookie', label: 'Value *', placeholder: 'Cookie value...', multiline: true }),
            path: window.DuckControls.Input.create({
                icon: 'cookie', label: 'Path', placeholder: '/', value: '/' }),
            expires: window.DuckControls.Input.create({
                icon: 'cookie', label: 'Expires (ISO 8601)', placeholder: '2026-12-31T23:59:59Z' }),
        };

        const content = document.createElement('div');
        content.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
        Object.values(fields).forEach(f => content.appendChild(f.element));

        const secureCheck = document.createElement('label');
        secureCheck.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;';
        secureCheck.innerHTML = '<input type="checkbox" id="_addSecure" style="width:auto;"> Secure';
        content.appendChild(secureCheck);

        const httpCheck = document.createElement('label');
        httpCheck.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;';
        httpCheck.innerHTML = '<input type="checkbox" id="_addHttpOnly" style="width:auto;"> HTTP Only';
        content.appendChild(httpCheck);

        const modal = window.DuckControls.Modal.create({
            defaultEnter: false,
            title: 'Add Cookie',
            icon: 'add_circle',
            content,
            size: 'md',
            buttons: [
                {
                    text: 'Add', icon: 'add', class: 'duck-btn-primary',
                    onClick: () => {
                        const name = fields.name.getValue?.()?.trim() || '';
                        const domain = fields.domain.getValue?.()?.trim() || '';
                        const value = fields.value.getValue?.()?.trim() || '';
                        if (!name || !domain || !value) {
                            if (!name) fields.name.setError?.('Name is required');
                            if (!domain) fields.domain.setError?.('Domain is required');
                            if (!value) fields.value.setError?.('Value is required');
                            return;
                        }
                        this._cookies.push({
                            name, domain, value,
                            path: fields.path.getValue?.()?.trim() || '/',
                            expires: document.getElementById('_addExpires')?.value || null,
                            secure: document.getElementById('_addSecure')?.checked || false,
                            httpOnly: document.getElementById('_addHttpOnly')?.checked || false,
                            sameSite: 'Lax'
                        });
                        this._markDirty();
                        this._renderTable(this._searchInput?.getValue?.() || '');
                        this._updateMeta();
                        modal.close();
                    }
                },
                { text: 'Cancel', class: 'duck-btn-secondary', onClick: () => modal.close() }
            ]
        });
        modal.open();
    },

    async _importCookies() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,.txt';
        fileInput.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            let parsed;
            try { parsed = JSON.parse(text); } catch { parsed = null; }

            if (Array.isArray(parsed)) {
                this._cookies = parsed;
            } else if (typeof text === 'string' && text.includes('\t')) {
                // Netscape format
                const lines = text.split('\n').filter(l => !l.startsWith('#') && l.trim());
                this._cookies = lines.map(line => {
                    const parts = line.split('\t');
                    return {
                        domain: parts[0] || '',
                        name: parts[5] || '',
                        value: parts[6] || '',
                        path: parts[2] || '/',
                        expires: parts[4] ? new Date(parseInt(parts[4]) * 1000).toISOString() : null,
                        secure: parts[3] === 'TRUE',
                        httpOnly: false,
                        sameSite: 'Lax'
                    };
                });
            } else {
                return;
            }

            this._markDirty();
            this._renderTable();
            this._updateMeta();
        };
        fileInput.click();
    },

    _exportCookies() {
        if (this._cookies.length === 0) {
            window.DuckControls?.Toast?.warning?.('No cookies to export.');
            return;
        }
        const out = JSON.stringify(this._cookies, null, 2);
        const blob = new Blob([out], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cookies-profile-${this._profileId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    _clearAll() {
        window.DuckControls?.Modal?.confirm?.('Clear all cookies?', 'This will remove all stored cookies for this profile.').then(confirmed => {
            if (confirmed) {
                this._cookies = [];
                this._markDirty();
                this._renderTable();
                this._updateMeta();
            }
        });
    },

    async _saveCookies() {
        if (!this._profileId) return;
        try {
            const profile = await DuckBridge.call('profile.get', { id: this._profileId });
            const cookiesJson = JSON.stringify(this._cookies);
            await DuckBridge.call('profile.update', {
                id: this._profileId,
                name: profile?.name || 'Unnamed Profile',
                groupId: profile?.groupId || null,
                tagIds: profile?.tagIds || null,
                proxyId: profile?.proxyId || null,
                browserType: profile?.browserType || 'Chromium',
                profileData: profile?.profileData || '{}',
                notes: profile?.notes || '',
                cookies: cookiesJson
            });
            this._markClean();
            this._lastSavedEl.textContent = `Saved ${new Date().toLocaleTimeString()}`;
        } catch (e) {
            console.error('[ManageCookies] Save failed', e);
            // toast handled by DuckBridge
        }
    }
};

