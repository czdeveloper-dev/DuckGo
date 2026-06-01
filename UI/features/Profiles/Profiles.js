// Profiles View - Profile list with filters, bulk actions

(function() {
    'use strict';

    const VIEW = {
        _initialized: false,
        _selectedIds: new Set(),
        _filters: { search: '', groupId: null, browserType: null },
        _sortCol: 'createdAt',
        _sortDir: 'desc',
        _tableControl: null,

        async onShow() {
            if (!this._initialized) {
                this.initUI();
                this._initialized = true;
            }
            await this.loadProfiles();
        },

        initUI() {
            // ── TOP PANEL CONTROLS ─────────────────────────────
            
            // Input: Search
            const searchInput = DuckControls.Input.create({
                label: 'SEARCH',
                placeholder: 'Search by Name...',
                icon: 'search',
                bgVariant: 'subtle',
                value: this._filters.search,
                onInput: DuckUtils.debounce((e) => {
                    this._filters.search = e.target.value;
                    this.loadProfiles();
                }, 300)
            });
            document.getElementById('ph-search')?.appendChild(searchInput.element);
            
            // Input: ID
            const idInput = DuckControls.Input.create({
                label: 'ID',
                placeholder: '1,2,3 or 1-5',
                width: '140px',
                icon: 'tag',
                bgVariant: 'subtle'
            });
            document.getElementById('ph-id')?.appendChild(idInput.element);
            
            // Select: Group
            const groupSelect = DuckControls.Select.create({
                label: 'GROUP',
                placeholder: 'All Groups',
                action: { text: '+ CREATE', onClick: () => alert('Create Group') },
                options: (DuckStore.get('groups') || []).map(g => ({ 
                    value: g.id, 
                    label: g.name,
                    actions: [
                        { icon: 'edit', onClick: () => alert('Edit ' + g.name) },
                        { icon: 'delete', danger: true, onClick: () => alert('Delete ' + g.name) }
                    ]
                })),
                value: this._filters.groupId || '',
                width: '180px',
                bgVariant: 'subtle',
                onChange: (e) => {
                    this._filters.groupId = e.target.value ? parseInt(e.target.value) : null;
                    this.loadProfiles();
                }
            });
            document.getElementById('ph-group')?.appendChild(groupSelect.element);
            
            // Select: Tag
            const tagSelect = DuckControls.Select.create({
                label: 'TAG',
                placeholder: 'All Tags',
                action: { text: '+ CREATE', onClick: () => alert('Create Tag') },
                options: (DuckStore.get('tags') || []).map(t => ({
                    value: t.id,
                    label: t.name,
                    actions: [
                        { icon: 'edit', onClick: () => alert('Edit ' + t.name) },
                        { icon: 'delete', danger: true, onClick: () => alert('Delete ' + t.name) }
                    ]
                })),
                width: '180px',
                bgVariant: 'subtle',
                onChange: (e) => {
                    this._filters.tagId = e.target.value ? parseInt(e.target.value) : null;
                    this.loadProfiles();
                }
            });
            this._filters = {
                search: '',
                groupId: null,
                tagId: null,
                status: null
            };
            this._visibleCols = new Set(['#', 'NAME', 'RESOURCE', 'GROUP', 'TAG', 'PROXY', 'NOTE', 'STATUS', 'MESSAGE', 'CREATED PROFILE TIME', 'LAST OPENED', 'CONTROL']);
            document.getElementById('ph-tag')?.appendChild(tagSelect.element);
            
            // Select: Status
            const statusSelect = DuckControls.Select.create({
                label: 'STATUS',
                options: [
                    { value: '', label: 'All' },
                    { value: 'ready', label: 'Ready'},
                    { value: 'running', label: 'Running' },
                    { value: 'stopped', label: 'Stopped' }
                ],
                width: '110px',
                bgVariant: 'subtle'
            });
            document.getElementById('ph-status')?.appendChild(statusSelect.element);
            
            // Right Side Buttons
            const btnRefresh = document.getElementById('btn-refresh');
            if (btnRefresh) {
                this._btnRefreshCtrl = DuckControls.Button.create(btnRefresh, {
                    variant: 'surface',
                    icon: 'refresh',
                    onClick: () => this.loadProfiles()
                });
            }

            const btnCols = document.getElementById('btn-cols');
            if (btnCols) {
                DuckControls.Button.create(btnCols, {
                    variant: 'surface',
                    icon: 'view_column',
                    onClick: () => {
                        const modal = document.getElementById('modal-col-visibility');
                        if (modal) modal.style.display = 'flex';
                    }
                });
            }

            const btnCreate = document.getElementById('btn-create');
            if (btnCreate) {
                DuckControls.Button.create(btnCreate, {
                    variant: 'primary',
                    icon: 'add',
                    text: 'Create Profile',
                    onClick: () => this._openModal(null)
                });
            }
            
            // Total profiles badge
            const badgeEl = document.getElementById('stat-total-profiles');
            if (badgeEl) {
                this._totalBadge = DuckControls.Badge.create(badgeEl);
            }
            
            // Tier 2: Action Chips
            const chipsContainer = document.getElementById('ph-action-chips');
            if (chipsContainer) {
                const createChip = (text, iconStr, hasDropdown = false) => {
                    const btnEl = document.createElement('button');
                    chipsContainer.appendChild(btnEl);
                    const btn = DuckControls.Button.create(btnEl, {
                        variant: 'chip',
                        icon: iconStr,
                        text: text,
                        dropdownArrow: hasDropdown
                    });
                    
                    return btn;
                };
                
                createChip('Automation', 'account_tree');
                const proxyBtn = createChip('Proxy', 'dns', true);
                DuckControls.ContextMenu.create(proxyBtn.element, {
                    items: [
                        { label: 'Check Proxy', icon: 'wifi_tethering' },
                        { label: 'Import Proxy', icon: 'upload' },
                        { label: 'Copy Proxy', icon: 'content_copy' },
                        'divider',
                        { label: 'Remove Proxy', icon: 'link_off', danger: true }
                    ]
                });
                
                createChip('Sync Actions', 'sync');
                
                const actionsBtn = createChip('Actions', 'bolt', true);
                DuckControls.ContextMenu.create(actionsBtn.element, {
                    items: [
                        { label: 'Import Profiles', icon: 'upload_file' },
                        { label: 'Export Profiles', icon: 'download' },
                        { label: 'Compare Profiles', icon: 'compare_arrows' }
                    ]
                });
                
                const browserConfigBtn = createChip('Browser Config', 'build', true);
                DuckControls.ContextMenu.create(browserConfigBtn.element, {
                    items: [
                        { label: 'Settings', icon: 'settings' },
                        { label: 'Extensions', icon: 'extension' }
                    ]
                });
                
                createChip('Arrange', 'grid_view');
            }
            
            // ── TABLE PANEL ─────────────────────────────────────
            this._buildTable();
            this._buildColVisibilityCheckboxes();
            
            // Modal placeholder
            const modalPlaceholder = document.createElement('div');
            modalPlaceholder.id = 'profile-modal-placeholder';
            document.getElementById('view-profiles')?.appendChild(modalPlaceholder);
        },

        _buildTable() {
            const updateBulkActions = () => {
                const bulkBar = document.getElementById('bulk-actions');
                const bulkCount = document.getElementById('bulk-count');
                if (bulkBar && bulkCount) {
                    if (this._selectedIds.size > 0) {
                        bulkBar.style.display = 'flex';
                        bulkCount.textContent = `${this._selectedIds.size} selected`;
                    } else {
                        bulkBar.style.display = 'none';
                    }
                }
            };
            
            const allCols = [
                { id: 'select', type: 'checkbox', onCheckAll: (e) => {
                    this._selectedIds.clear();
                    const checked = e.target.checked;
                    document.querySelectorAll('.row-check').forEach(cb => {
                        cb.checked = checked;
                        if (checked) this._selectedIds.add(parseInt(cb.value));
                    });
                    updateBulkActions();
                }},
                { id: 'seq', label: '#', field: 'seq' },
                { id: 'name', label: 'NAME', render: (row) => `
                    <div style="display:flex;align-items:center;gap:8px">
                        <span class="status-dot ${row.status || 'stopped'}"></span>
                        <span style="font-weight:600">${DuckUtils.escapeHtml(row.name)}</span>
                    </div>
                ` },
                { id: 'resource', label: 'RESOURCE', render: (row) => row.browserType || 'Chromium' },
                { id: 'group', label: 'GROUP', field: 'groupName' },
                { id: 'tags', label: 'TAG', render: (row) => {
                    const tags = row.tagNames || row.tags || [];
                    return tags.map(t => `<span class="duck-badge" style="height:24px; padding:0 8px; font-size:10px;">${DuckUtils.escapeHtml(t)}</span>`).join(' ');
                }},
                { id: 'proxy', label: 'PROXY', render: (row) => {
                    const pName = row.proxyName || row.proxy || 'Direct';
                    return `<div style="display:flex;align-items:center;gap:4px;"><span class="material-symbols-outlined" style="font-size:14px;">${pName === 'Direct' ? 'public' : 'lan'}</span>${pName}</div>`;
                }},
                { id: 'note', label: 'NOTE', render: (row) => `<span style="color:var(--text-tertiary)">${DuckUtils.escapeHtml(row.notes || '-')}</span>` },
                { id: 'status', label: 'STATUS', render: (row) => {
                    let cls = 'duck-badge', text = row.status || 'stopped';
                    switch (row.status) {
                        case 'running': cls = 'status-badge success'; text = 'Running'; break;
                        case 'stopped': cls = 'status-badge danger'; text = 'Stopped'; break;
                    }
                    return `<span class="${cls}">${text}</span>`;
                }},
                { id: 'message', label: 'MESSAGE', render: (row) => `<span style="color:var(--text-tertiary)">${DuckUtils.escapeHtml(row.message)}</span>` },
                { id: 'created', label: 'CREATED PROFILE TIME', render: (row) => DuckUtils.formatRelative(row.createdAt) },
                { id: 'lastopened', label: 'LAST OPENED', field: 'lastOpened' },
                { id: 'action', label: 'CONTROL', align: 'right', resizable: false, render: (row) => {
                    const div = document.createElement('div');
                    div.style.display = 'flex';
                    div.style.gap = '4px';
                    
                    if (row.status !== 'running') {
                        const btnStart = document.createElement('button');
                        div.appendChild(btnStart);
                        DuckControls.Button.create(btnStart, { variant: 'ghost', size: 'sm', icon: 'play_arrow', onClick: () => this._startProfile(row.id) }).element.title = 'Start';
                    } else {
                        const btnStop = document.createElement('button');
                        div.appendChild(btnStop);
                        DuckControls.Button.create(btnStop, { variant: 'ghost', size: 'sm', icon: 'stop', onClick: () => this._stopProfile(row.id) }).element.title = 'Stop';
                    }
                    
                    const btnEdit = document.createElement('button');
                    div.appendChild(btnEdit);
                    DuckControls.Button.create(btnEdit, { variant: 'ghost', size: 'sm', icon: 'edit', onClick: () => this._openModal(row.id) }).element.title = 'Edit';
                    
                    const btnDel = document.createElement('button');
                    div.appendChild(btnDel);
                    DuckControls.Button.create(btnDel, { variant: 'ghost', size: 'sm', icon: 'delete', onClick: () => this._deleteProfile(row.id), style: { color: 'var(--danger)' } }).element.title = 'Delete';
                    
                    return div;
                }}
            ];
            
            const colsToRender = allCols.filter(c => c.type === 'checkbox' || this._visibleCols.has(c.label));
            
            this._tableControl = DuckControls.Table.create({
                emptyText: 'No profiles found.',
                columns: colsToRender,
                onCheckRow: (e, row) => {
                    if (e.target.checked) this._selectedIds.add(row.id);
                    else this._selectedIds.delete(row.id);
                    updateBulkActions();
                },
                onRowContextMenu: (e, row, index) => {
                    if (!this._rowContextMenu) {
                        this._rowContextMenu = DuckControls.ContextMenu.create(null, {
                            items: [
                                { label: 'Check Proxy', icon: 'wifi_tethering' },
                                { label: 'Import Proxy', icon: 'upload' },
                                { label: 'Copy Proxy', icon: 'content_copy' },
                                'divider',
                                { label: 'Remove Proxy', icon: 'link_off', danger: true },
                                'divider',
                                { label: 'Import Profiles', icon: 'upload_file' },
                                { label: 'Export Profiles', icon: 'download' },
                                { label: 'Compare Profiles', icon: 'compare_arrows' },
                                'divider',
                                { label: 'Delete Selected', icon: 'delete_sweep', danger: true }
                            ]
                        });
                    }
                    this._rowContextMenu.showAt(e.clientX, e.clientY);
                }
            });
            
            // Initialize bulk action buttons
            const initBulkBtn = (id, icon, text) => {
                const el = document.getElementById(id);
                if (el && !el._duckButton) {
                    const btn = DuckControls.Button.create(el, { variant: 'secondary', size: 'sm', icon: icon });
                    btn.element.textContent = text;
                    btn.setIcon(icon, 'left');
                    el._duckButton = true;
                }
            };
            initBulkBtn('btn-bulk-launch', 'play_arrow', 'Run Profile');
            initBulkBtn('btn-bulk-stop', 'stop_circle', 'Stop Profile');
            initBulkBtn('btn-bulk-rename', 'drive_file_rename_outline', 'Bulk Rename');
            initBulkBtn('btn-bulk-health', 'health_and_safety', 'Check Health');
            
            const btnDelEl = document.getElementById('btn-bulk-delete');
            if (btnDelEl && !btnDelEl._duckButton) {
                const bDel = DuckControls.Button.create(btnDelEl, { variant: 'danger', size: 'sm', icon: 'delete' });
                bDel.element.textContent = 'Delete Profile';
                bDel.setIcon('delete', 'left');
                btnDelEl._duckButton = true;
            }
            
            const tableContainer = document.getElementById('profile-table-container');
            if (tableContainer) {
                tableContainer.innerHTML = '';
                tableContainer.appendChild(this._tableControl.element);
            }
            
            if (this._profilesData) {
                this._tableControl.renderData(this._profilesData);
            }
        },
        
        _buildColVisibilityCheckboxes() {
            const container = document.getElementById('col-visibility-checkboxes');
            if (!container) return;
            container.innerHTML = '';
            
            const allCols = ['#', 'NAME', 'RESOURCE', 'GROUP', 'TAG', 'PROXY', 'NOTE', 'STATUS', 'MESSAGE', 'CREATED PROFILE TIME', 'LAST OPENED', 'CONTROL'];
            const lockedCols = new Set(['#', 'NAME', 'STATUS', 'CONTROL']);
            
            allCols.forEach(col => {
                const isLocked = lockedCols.has(col);
                const isVisible = this._visibleCols.has(col);
                
                const lbl = document.createElement('label');
                lbl.style.display = 'flex';
                lbl.style.alignItems = 'center';
                lbl.style.gap = '8px';
                lbl.style.fontSize = '13px';
                if (isLocked) lbl.style.opacity = '0.6';
                
                const chk = document.createElement('input');
                chk.type = 'checkbox';
                chk.checked = isVisible;
                if (isLocked) chk.disabled = true;
                
                chk.addEventListener('change', (e) => {
                    if (e.target.checked) this._visibleCols.add(col);
                    else this._visibleCols.delete(col);
                    this._buildTable();
                });
                
                lbl.appendChild(chk);
                lbl.appendChild(document.createTextNode(` ${col} ${isLocked ? '(Required)' : ''}`));
                container.appendChild(lbl);
            });
        },

        async loadProfiles() {
            if (this._btnRefreshCtrl) this._btnRefreshCtrl.setSpinning(true);
            try {
                await new Promise(resolve => setTimeout(resolve, 400)); // Artificial delay for spin animation visibility
                const resp = await _duckBridge.call('profile.list', this._filters);
                if (resp && resp.success !== false) {
                    let items = resp.items || resp.data || [];
                    items = items.map((p, idx) => ({
                        ...p,
                        id: p.Id ?? p.id ?? 0,
                        seq: idx + 1,
                        name: p.Name ?? p.name ?? 'Unknown',
                        groupName: p.GroupName ?? p.Group?.Name ?? p.group ?? '',
                        tags: p.TagNames ?? p.tagNames ?? (p.Tags ? p.Tags.split(',').map(t => t.trim()).filter(Boolean) : []),
                        proxyName: p.ProxyId ?? p.proxyId ?? p.proxy ?? 'Direct',
                        notes: p.Notes ?? p.notes ?? '',
                        status: p.Status ?? p.status ?? 'stopped',
                        message: p.Message ?? p.message ?? p.LastCheckMessage ?? p.lastCheckMessage ?? '-',
                        createdAt: p.CreatedAt ?? p.createdAt,
                        lastOpened: p.LastOpened ?? p.lastOpened,
                        browserType: p.BrowserType ?? p.browserType ?? 'chromium'
                    }));
                    DuckStore.set('profiles', items);
                    this.renderTable();
                }
            } catch (err) {
                console.error('Failed to load profiles:', err);
                if (window.DuckUtils && DuckUtils.Toast) {
                    DuckUtils.Toast.error('Failed to load profiles');
                }
            } finally {
                if (this._btnRefreshCtrl) this._btnRefreshCtrl.setSpinning(false);
            }
        },

        renderTable() {
            const profiles = DuckStore.get('profiles') || [];
            this._profilesData = profiles; // save for re-renders
            
            // Update total badge
            if (this._totalBadge) {
                this._totalBadge.setText(profiles.length.toString());
            }
            
            // Render table data
            if (this._tableControl) {
                this._tableControl.renderData(profiles);
            }
        },

        async _startProfile(id) {
            try {
                await _duckBridge.call('profile.start', { id });
                await this.loadProfiles();
                DuckUtils.toast('Profile started', 'success');
            } catch (e) {
                DuckUtils.toast('Failed to start profile: ' + e.message, 'error');
            }
        },

        async _stopProfile(id) {
            try {
                await _duckBridge.call('profile.stop', { id });
                await this.loadProfiles();
                DuckUtils.toast('Profile stopped', 'success');
            } catch (e) {
                DuckUtils.toast('Failed to stop profile: ' + e.message, 'error');
            }
        },

        async _deleteProfile(id) {
            if (!confirm('Delete this profile?')) return;
            try {
                await _duckBridge.call('profile.delete', { id });
                this._selectedIds.delete(id);
                await this.loadProfiles();
                DuckUtils.toast('Profile deleted', 'success');
            } catch (e) {
                DuckUtils.toast('Failed to delete: ' + e.message, 'error');
            }
        },

        async _openModal(profileId) {
            console.log('[Profiles] Open modal for profile:', profileId);
            if (profileId) {
                DuckUtils.toast('Edit profile #' + profileId + ' - modal coming soon', 'info');
            } else {
                DuckUtils.toast('Create profile - modal coming soon', 'info');
            }
        }
    };

    // Register view
    window.DuckApp?.registerView('profiles', VIEW);
    window.ProfilesView = VIEW;
})();
