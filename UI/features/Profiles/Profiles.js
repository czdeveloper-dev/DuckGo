/**
 * Profiles View — wired to DuckBridge (unified JS ↔ C# protocol)
 *
 * Data flow:
 *   onShow() → loadGroups() + loadTags() + loadProfiles()
 *              → _updateGroupSelect() / _updateTagSelect()   (live dropdowns)
 *
 * Group CRUD:  + Create   →  group.create
 *              Edit       →  group.update
 *              Delete     →  group.delete
 *
 * Tag CRUD:    + Create   →  tag.create
 *              Edit       →  (local, tags have no update endpoint)
 *              Delete     →  tag.delete
 */
(function () {
    'use strict';

    const VIEW = {
        _initialized: false,
        _selectedIds: new Set(),
        _filters: { search: '', id: '', group: '', tag: '', status: '' },
        _profilesData: [],
        _groups: [],
        _tags: [],
        _visibleCols: new Set(['seq', 'name', 'resource', 'group', 'tags', 'proxy', 'note', 'status', 'message', 'created', 'lastopened', 'action']),

        // ── View entry ──────────────────────────────────────────────────
        async onShow() {
            if (!this._initialized) {
                this._loadColPreferences();
                this.initUI();
                this._initialized = true;
            }
            await this.loadGroups();
            await this.loadTags();
            await this.loadProfiles();
        },

        // ── Data loaders ────────────────────────────────────────────────
        async loadGroups() {
            try {
                this._groups = await DuckBridge.call('group.list') || [];
                this._groups.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                this._updateGroupSelect();
            } catch (e) { console.error('[Profiles] loadGroups failed:', e); }
        },

        async loadTags() {
            try {
                this._tags = await DuckBridge.call('tag.list') || [];
                this._tags.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                this._updateTagSelect();
            } catch (e) { console.error('[Profiles] loadTags failed:', e); }
        },

        async loadProfiles() {
            if (this._table && this._table.setLoading) this._table.setLoading(true);
            let items = [];
            try {
                const filters = {};
                if (this._filters.search)  filters.search     = this._filters.search;
                if (this._filters.id)       filters.id        = this._filters.id;
                if (this._filters.group)    filters.groupId   = parseInt(this._filters.group);
                if (this._filters.tag)      filters.tagIds    = this._filters.tag.split(',').map(v => parseInt(v)).filter(v => !isNaN(v));
                if (this._filters.status)   filters.browserType = this._filters.status;
                
                const minTimePromise = new Promise(resolve => setTimeout(resolve, 300));
                const [resp] = await Promise.all([
                    DuckBridge.call('profile.list', filters),
                    minTimePromise
                ]);
                
                items = resp?.Items || resp || [];
            } catch (err) {
                console.warn('[Profiles] Bridge unavailable, using mock:', err);
            } finally {
                if (this._table && this._table.setLoading) this._table.setLoading(false);
            }

            if (!Array.isArray(items) || items.length === 0) {
                items = [];
            }

            items = items.map((p, idx) => ({
                ...p,
                id:         p.Id ?? p.id ?? 0,
                seq:        idx + 1,
                name:       p.Name ?? p.name ?? 'Unknown',
                groupName:  p.GroupName ?? this._getGroupName(p.GroupId ?? p.groupId),
                tags:       p.TagNames ?? p.tagNames ?? [],
                proxy:      p.ProxyName ?? p.proxy ?? 'Direct',
                notes:      p.Notes ?? p.notes ?? '',
                status:    p.Status ?? p.status ?? 'ready',
                message:   p.Message ?? p.message ?? '-',
                createdAt: p.CreatedAt ?? p.createdAt,
                lastOpened: p.LastOpened ?? p.lastOpened,
                browserType: p.BrowserType ?? p.browserType ?? 'Chromium'
            }));

            this._profilesData = items;
            const currentIds = new Set(items.map(p => p.id));
            for (const id of this._selectedIds) { if (!currentIds.has(id)) this._selectedIds.delete(id); }
            this._updateBulkActions();
            this._loadTableData(items);
            this._updateStats(items);
        },

        _getGroupName(groupId) {
            if (!groupId) return '';
            const g = this._groups.find(x => (x.Id ?? x.id) === groupId);
            return g ? (g.Name ?? g.name) : '';
        },

        // ── Select builders ────────────────────────────────────────────
        _buildGroupOptions() {
            return [
                { label: 'All Groups', value: '' },
                ...this._groups.map(g => ({
                    label: g.Name || g.name || '',
                    value: String(g.Id ?? g.id),
                    actions: [
                        { icon: 'edit', onClick: (e) => this._editGroup(g) }
                    ]
                }))
            ];
        },

        _buildTagOptions() {
            return [
                ...this._tags.map(t => ({
                    label: t.Name || t.name || '',
                    value: String(t.Id ?? t.id),
                    actions: [
                        { icon: 'edit', onClick: (e) => this._editTag(t) }
                    ]
                }))
            ];
        },

        _updateGroupSelect() {
            if (this._groupCtrl) this._groupCtrl.setOptions(this._buildGroupOptions());
        },

        _updateTagSelect() {
            if (this._tagCtrl) this._tagCtrl.setOptions(this._buildTagOptions());
        },

        // ── Group CRUD ─────────────────────────────────────────────────
        _buildGroupDeleteItems() {
            return this._groups.map(g => ({ label: g.Name || g.name || '', value: String(g.Id ?? g.id) }));
        },

        async _createGroup() {
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('group', async (name) => {
                try {
                    const result = await DuckBridge.call('group.create', { name });
                    // result = { Id, Name, CreatedAt } from backend
                    this._groups.push(result);
                    this._groups.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                    this._updateGroupSelect();
                } catch (e) {
                    // toast handled by DuckBridge
                }
            });
        },

        async _editGroup(groupObj) {
            let group = groupObj;
            if (!group) {
                const selectedValue = this._groupCtrl?.getValue() || '';
                if (!selectedValue) {
                    return;
                }
                group = this._groups.find(g => String(g.Id ?? g.id) === selectedValue);
            }
            if (!group) return;
            const currentName = group.Name || group.name || '';
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('group', async (newName) => {
                if (!newName || newName === currentName) return;
                try {
                    await DuckBridge.call('group.update', { id: group.Id ?? group.id, name: newName });
                    if (group.Name !== undefined) group.Name = newName;
                    else group.name = newName;
                    this._groups.sort((a, b) => ((a.Name || a.name) || '').localeCompare((b.Name || b.name) || ''));
                    this._updateGroupSelect();
                    await this.loadProfiles();
                } catch (e) {
                    // toast handled by DuckBridge
                }
            }, currentName);
        },

        async _deleteGroup() {
            const items = this._buildGroupDeleteItems();
            if (items.length === 0) { return; }
            if (!window.ProfileModals?.DeleteEntity) return;
            window.ProfileModals.DeleteEntity.show('group', items, async (selectedValues) => {
                try {
                    for (const val of selectedValues) { await DuckBridge.call('group.delete', { id: parseInt(val) }); }
                    this._groups = this._groups.filter(g => !selectedValues.includes(String(g.Id ?? g.id)));
                    this._updateGroupSelect();
                    this._filters.group = '';
                    await this.loadProfiles();
                } catch (e) {
                    // toast handled by DuckBridge
                }
            });
        },

        // ── Tag CRUD ──────────────────────────────────────────────────
        _buildTagDeleteItems() {
            return this._tags.map(t => ({ label: t.Name || t.name || '', value: String(t.Id ?? t.id) }));
        },

        async _createTag() {
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('tag', async (name) => {
                try {
                    const result = await DuckBridge.call('tag.create', { name });
                    // result = { Id, Name, CreatedAt } from backend
                    this._tags.push(result);
                    this._tags.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                    this._updateTagSelect();
                } catch (e) {
                    // toast handled by DuckBridge
                }
            });
        },

        async _editTag(tagObj) {
            let tag = tagObj;
            if (!tag) {
                const selectedValues = this._tagCtrl?.getValues() || [];
                if (selectedValues.length === 0) {
                    return;
                }
                const tagId = parseInt(selectedValues[0]);
                tag = this._tags.find(t => (t.Id ?? t.id) === tagId);
            }
            if (!tag) return;
            const currentName = tag.Name || tag.name || '';
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('tag', async (newName) => {
                if (!newName || newName === currentName) return;
                try {
                    await DuckBridge.call('tag.update', { id: tag.Id ?? tag.id, name: newName });
                    if (tag.Name !== undefined) tag.Name = newName;
                    else tag.name = newName;
                    this._tags.sort((a, b) => ((a.Name || a.name) || '').localeCompare((b.Name || b.name) || ''));
                    this._updateTagSelect();
                } catch (e) {
                    // toast handled by DuckBridge
                }
            }, currentName);
        },

        async _deleteTag() {
            const items = this._buildTagDeleteItems();
            if (items.length === 0) { return; }
            if (!window.ProfileModals?.DeleteEntity) return;
            window.ProfileModals.DeleteEntity.show('tag', items, async (selectedValues) => {
                try {
                    for (const val of selectedValues) { await DuckBridge.call('tag.delete', { id: parseInt(val) }); }
                    this._tags = this._tags.filter(t => !selectedValues.includes(String(t.Id ?? t.id)));
                    this._updateTagSelect();
                    await this.loadProfiles();
                } catch (e) {
                    // toast handled by DuckBridge
                }
            });
        },

        // ── Init UI ──────────────────────────────────────────────────
        initUI() {
            const refreshEl = document.getElementById('ctrl-refresh');
            if (refreshEl) {
                this._refreshBtn = DuckControls.Button.create(refreshEl, {
                    variant: 'surface', icon: 'refresh',
                    onClick: () => {
                        return Promise.all([this.loadGroups(), this.loadTags(), this.loadProfiles()]);
                    }
                });
            }

            // Reload table when profiles are created (single or bulk)
            window.addEventListener('profile-created', async () => {
                await Promise.all([this.loadGroups(), this.loadTags(), this.loadProfiles()]);
            });

            // Listen for profile status updates from backend
            window.addEventListener('profile-status-update', (e) => {
                const { profileId, status, message } = e.detail || {};
                if (!profileId) return;
                
                // Update the specific profile in our data
                const profile = this._profilesData.find(p => p.id === profileId);
                if (profile) {
                    if (status) profile.status = status;
                    if (message !== undefined) profile.message = message;
                    // Update table row without full reload
                    this._table?.updateRow?.(profileId, profile);
                }
            });

            // Listen for profile message updates from backend
            window.addEventListener('profile-message-update', (e) => {
                const { profileId, message } = e.detail || {};
                if (!profileId) return;
                
                // Update the specific profile in our data
                const profile = this._profilesData.find(p => p.id === profileId);
                if (profile && message !== undefined) {
                    profile.message = message;
                    // Update table row without full reload
                    this._table?.updateRow?.(profileId, profile);
                }
            });

            const colsEl = document.getElementById('ctrl-cols');
            if (colsEl) {
                this._colsBtn = DuckControls.Button.create(colsEl, {
                    variant: 'surface', icon: 'view_column',
                    onClick: () => {
                        if (window.ProfileModals?.CustomizeColumn) {
                            window.ProfileModals.CustomizeColumn.show(this._visibleCols, () => {
                                if (this._table) this._table.updateColumnVisibility(this._visibleCols);
                            });
                        }
                    }
                });
            }

            const createEl = document.getElementById('ctrl-create');
            if (createEl) {
                this._createBtn = DuckControls.Button.create(createEl, {
                    variant: 'primary', icon: 'add', text: 'Create Profile',
                    onClick: () => { window.ProfileModals?.CreateProfile?.show(); }
                });
            }

            this._initSearchControls();
            this._initSelectControls();
            this._initActionChips();
            this._initBulkActions();
            this._buildTable();
        },

        _initSearchControls() {
            const searchContainer = document.getElementById('ctrl-search');
            if (searchContainer) {
                this._searchCtrl = DuckControls.Input.create({
                    label: 'SEARCH', placeholder: 'Search by Name...', icon: 'search',
                    width: '200px', bgVariant: 'subtle',
                    onInput: (e) => { this._filters.search = e.target.value; this.loadProfiles(); }
                });
                searchContainer.appendChild(this._searchCtrl.element);
            }

            const idContainer = document.getElementById('ctrl-id');
            if (idContainer) {
                this._idCtrl = DuckControls.Input.create({
                    label: 'ID', placeholder: '1,2,3 or 1-5', icon: 'tag',
                    width: '140px', bgVariant: 'subtle',
                    onInput: (e) => { this._filters.id = e.target.value; this.loadProfiles(); }
                });
                idContainer.appendChild(this._idCtrl.element);
            }
        },

        _initSelectControls() {
            const groupContainer = document.getElementById('ctrl-group');
            if (groupContainer) {
                const defaultGroup = this._groups.find(g => (g.Name || g.name) === 'Default');
                if (defaultGroup && !this._filters.group) {
                    this._filters.group = String(defaultGroup.Id ?? defaultGroup.id);
                }
                
                this._groupCtrl = DuckControls.Select.create({
                    label: 'GROUP', placeholder: 'All Groups', width: '180px', bgVariant: 'subtle',
                    value: this._filters.group,
                    actions: [
                        { text: 'Delete', icon: 'delete', color: 'var(--danger)', onClick: () => this._deleteGroup() },
                        { text: '+ Create', icon: 'add', onClick: () => this._createGroup() }
                    ],
                    options: this._buildGroupOptions(),
                    onChange: (e) => { this._filters.group = e.target.value; this.loadProfiles(); }
                });
                groupContainer.appendChild(this._groupCtrl.element);
            }

            const tagContainer = document.getElementById('ctrl-tag');
            if (tagContainer) {
                this._tagCtrl = DuckControls.MultiSelectComboBox.create({
                    label: 'TAG', placeholder: 'All Tags', width: '180px', bgVariant: 'subtle',
                    actions: [
                        { text: 'Delete', icon: 'delete', color: 'var(--danger)', onClick: () => this._deleteTag() },
                        { text: '+ Create', icon: 'add', onClick: () => this._createTag() }
                    ],
                    options: this._buildTagOptions(),
                    onChange: (selectedValues) => { this._filters.tag = selectedValues.join(','); this.loadProfiles(); }
                });
                tagContainer.appendChild(this._tagCtrl.element);
            }

            const statusContainer = document.getElementById('ctrl-status');
            if (statusContainer) {
                this._statusCtrl = DuckControls.Select.create({
                    label: 'STATUS', placeholder: 'All', width: '120px', bgVariant: 'subtle',
                    options: [
                        { label: 'All', value: '' },
                        { label: 'Ready', value: 'ready' },
                        { label: 'Running', value: 'running' },
                        { label: 'Stopped', value: 'stopped' }
                    ],
                    onChange: (e) => { this._filters.status = e.target.value; this.loadProfiles(); }
                });
                statusContainer.appendChild(this._statusCtrl.element);
            }

            const statContainer = document.getElementById('ctrl-stat');
            if (statContainer) {
                const wrap = document.createElement('div');
                wrap.className = 'filter-stacked';
                const head = document.createElement('div');
                head.className = 'filter-stacked-head';
                const lbl = document.createElement('span');
                lbl.className = 'ui-label-sm';
                lbl.textContent = 'TOTAL PROFILES';
                head.appendChild(lbl);
                wrap.appendChild(head);
                this._statEl = document.createElement('div');
                this._statEl.id = 'stat-total-profiles';
                this._statEl.className = 'input-field-sm bg-subtle';
                this._statEl.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;min-width:80px;';
                this._statEl.textContent = '0';
                wrap.appendChild(this._statEl);
                statContainer.appendChild(wrap);
            }
        },

        _initActionChips() {
            const chipsContainer = document.getElementById('ctrl-chips');
            if (!chipsContainer) return;

            const mk = (el, cfg) => DuckControls.Button.create(el, cfg);

            const autoEl = document.createElement('button');
            chipsContainer.appendChild(autoEl);
            mk(autoEl, { variant: 'chip', icon: 'account_tree', text: 'Automation', onClick: () => {} });

            const proxyEl = document.createElement('button');
            chipsContainer.appendChild(proxyEl);
            mk(proxyEl, { variant: 'chip', icon: 'dns', text: 'Proxy', dropdownArrow: true, onClick: () => {} });
            DuckControls.ContextMenu.create(proxyEl, {
                items: [
                    { label: 'Check Proxy', icon: 'wifi_tethering', onClick: () => { if (this._selectedIds.size > 0) this._bulkCheckProxy(); } },
                    { label: 'Import Proxy', icon: 'upload', onClick: () => { window.ProfileModals?.ImportProxy?.show(); } },
                    { label: 'Copy Proxy', icon: 'content_copy', onClick: () => this._bulkCopyProxy() },
                    'divider',
                    { label: 'Remove Proxy', icon: 'link_off', danger: true, onClick: () => { if (this._selectedIds.size > 0) this._bulkRemoveProxy(); } }
                ]
            });

            const syncEl = document.createElement('button');
            chipsContainer.appendChild(syncEl);
            mk(syncEl, { variant: 'chip', icon: 'sync', text: 'Sync Actions', onClick: () => { window.ProfileModals?.SyncActions?.show(this._profilesData, this._selectedIds); } });

            const actionsEl = document.createElement('button');
            chipsContainer.appendChild(actionsEl);
            mk(actionsEl, { variant: 'chip', icon: 'bolt', text: 'Actions', dropdownArrow: true, onClick: () => {} });
            DuckControls.ContextMenu.create(actionsEl, {
                items: [
                    { label: 'Import Profiles', icon: 'publish', onClick: () => { window.ProfileModals?.ImportProfiles?.show([...this._selectedIds]); } },
                    { label: 'Export Profiles', icon: 'download', onClick: () => { if (this._selectedIds.size > 0) window.ProfileModals?.ExportProfiles?.show([...this._selectedIds]); } },
                    { label: 'Compare Profiles', icon: 'compare_arrows', onClick: () => { if (this._selectedIds.size > 0) window.ProfileModals?.CompareProfiles?.show(this._profilesData, this._selectedIds); } },
                    'divider',
                    { label: 'Delete Selected', icon: 'delete_sweep', danger: true, onClick: () => { if (this._selectedIds.size > 0) this._bulkDelete(); } }
                ]
            });

            const browserEl = document.createElement('button');
            chipsContainer.appendChild(browserEl);
            mk(browserEl, { variant: 'chip', icon: 'build', text: 'Browser Config', dropdownArrow: true, onClick: () => {} });
            DuckControls.ContextMenu.create(browserEl, {
                items: [
                    { type: 'label', label: 'Bulk Operations' },
                    { label: 'Clear Cache', icon: 'cleaning_services', onClick: () => { if (this._selectedIds.size > 0) window.ProfileModals?.ClearCache?.show([...this._selectedIds]); } },
                    { label: 'Set Browser Version', icon: 'manage_history', onClick: () => { if (this._selectedIds.size > 0) window.ProfileModals?.SetBrowserVersion?.show([...this._selectedIds]); } },
                    { label: 'New Fingerprint', icon: 'casino', onClick: () => { if (this._selectedIds.size > 0) window.ProfileModals?.NewFingerprint?.show([...this._selectedIds]); } },
                    { label: 'Change Location', icon: 'my_location', onClick: () => { if (this._selectedIds.size > 0) window.ProfileModals?.ChangeLocation?.show([...this._selectedIds]); } },
                    { label: 'Change Bookmarks', icon: 'bookmark_add', onClick: () => { if (this._selectedIds.size > 0) window.ProfileModals?.ChangeBookmark?.show([...this._selectedIds]); } },
                    { label: 'Update Start URL', icon: 'link', onClick: () => { if (this._selectedIds.size > 0) window.ProfileModals?.UpdateStartUrl?.show([...this._selectedIds]); } }
                ]
            });

            const arrangeEl = document.createElement('button');
            chipsContainer.appendChild(arrangeEl);
            mk(arrangeEl, { variant: 'chip', icon: 'grid_view', text: 'Arrange Windows', onClick: () => { window.ProfileModals?.Arrange?.show([...this._selectedIds]); } });
        },

        _initBulkActions() {
            const mkBtn = (id, cfg) => {
                const el = document.getElementById(id);
                if (el) DuckControls.Button.create(el, cfg);
            };
            mkBtn('ctrl-bulk-launch', { variant: 'secondary', size: 'sm', icon: 'play_arrow', text: 'Run Profile', onClick: () => this._bulkLaunch() });
            mkBtn('ctrl-bulk-stop',    { variant: 'secondary', size: 'sm', icon: 'stop_circle', text: 'Stop Profile', onClick: () => this._bulkStop() });
            mkBtn('ctrl-bulk-rename',  { variant: 'secondary', size: 'sm', icon: 'drive_file_rename_outline', text: 'Bulk Rename', onClick: () => this._bulkRename() });
            mkBtn('ctrl-bulk-delete',  { variant: 'danger',    size: 'sm', icon: 'delete', text: 'Delete Profile', onClick: () => this._bulkDelete() });
            mkBtn('ctrl-bulk-close',   { variant: 'ghost',     size: 'sm', icon: 'close', onClick: () => { this._table?.clearChecked?.(); this._selectedIds.clear(); this._updateBulkActions(); } });
        },

        _buildTable() {
            if (this._table?.destroy) this._table.destroy();
            const card = document.querySelector('.table-card--profiles');
            card?.querySelector('.data-table-wrap')?.remove();
            const _this = this;
            const cols = [
                { id: 'select', type: 'checkbox', title: 'Select all', locked: true, lockedPosition: 'left', resizable: false, width: '52px', onCheckAll: (e) => this._handleCheckAll(e) },
                { id: 'seq', label: '#', width: '1ch', minWidth: '1ch', locked: true, lockedPosition: 'left', resizable: false, autoSize: true, align: 'center', render: (r) => { const el = document.createElement('span'); el.textContent = r.seq; return el; } },
                { id: 'name', label: 'NAME', width: '40ch', maxWidth: '40ch', locked: true, lockedPosition: 'left', resizable: false, render: (r) => _this._renderNameCell(r) },
                { id: 'resource', label: 'RESOURCE', width: '8ch', minWidth: '8ch', resizable: false, autoSize: true, field: 'browserType', render: (r) => _this._renderResourceCell(r) },
                { id: 'group', label: 'GROUP', width: '20ch', minWidth: '20ch', maxWidth: '30ch', render: (r) => _this._renderGroupCell(r) },
                { id: 'tags', label: 'TAGS', width: '20ch', minWidth: '20ch', maxWidth: '30ch', render: (r) => _this._renderTagsCell(r) },
                { id: 'proxy', label: 'PROXY', width: '25ch', minWidth: '25ch', maxWidth: '30ch', render: (r) => _this._renderProxyCell(r) },
                { id: 'status', label: 'STATUS', width: '15ch', minWidth: '15ch', resizable: false, autoSize: true, render: (r) => _this._renderStatusBadge(r) },
                { id: 'message', label: 'MESSAGE', width: '30ch', minWidth: '30ch', maxWidth: '50ch', render: (r) => _this._renderMessageCell(r) },
                { id: 'note', label: 'NOTE', width: '30ch', minWidth: '30ch', maxWidth: '40ch', resizable: true, render: (r) => _this._renderNoteCell(r) },
                { id: 'created', label: 'CREATED TIME', width: '25ch', minWidth: '25ch', resizable: false, autoSize: true, render: (r) => _this._renderDateCell(r.createdAt) },
                { id: 'lastopened', label: 'LAST OPENED', width: '25ch', minWidth: '25ch', resizable: false, autoSize: true, render: (r) => _this._renderDateCell(r.lastOpened) },
                { id: 'action', label: 'CONTROL', width: '170px', locked: true, lockedPosition: 'right', resizable: false, render: (r) => _this._renderActionCell(r) }
            ];

            const tableContainer = document.getElementById('table-profiles-container');
            this._table = DuckControls.Table.create({
                container: tableContainer, id: 'duck-table-profiles', emptyText: 'No profiles found', fillSpace: true,
                onCheckRow: (e, row) => { e.checked ? this._selectedIds.add(row.id) : this._selectedIds.delete(row.id); this._updateBulkActions(); },
                onRowContextMenu: (e, row) => this._showRowContextMenu(e, row),
                columns: cols
            });
            if (card) { card.style.cssText = 'flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;'; card.appendChild(this._table.element); }
            this._table.updateColumnVisibility(this._visibleCols);
        },

        _loadTableData(profiles) { this._table?.renderData(profiles); },
        _updateStats(profiles)   { if (this._statEl) this._statEl.textContent = `${profiles.length}`; },

        // ── Bulk / row actions ───────────────────────────────────────
        async _startProfile(id) {
            try { await DuckBridge.call('browser.start', { id }); await this.loadProfiles(); }
            catch (e) { console.error('Failed to start profile:', e); }
        },
        async _stopProfile(id) {
            try { await DuckBridge.call('browser.stop', { id }); await this.loadProfiles(); }
            catch (e) { console.error('Failed to stop profile:', e); }
        },
        async _deleteProfile(id) {
            if (window.ProfileModals?.DeleteProfiles) {
                window.ProfileModals.DeleteProfiles.show(new Set([id]), async (ids) => {
                    try { await DuckBridge.call('profile.delete', { id: ids[0] }); this._selectedIds.delete(ids[0]); this._updateBulkActions(); await this.loadProfiles(); window.ProfileModals?.CreateProfile?._refreshEntityData?.(); }
                    catch (e) { console.error('Delete failed:', e); }
                });
            } else {
                if (!confirm('Delete this profile?')) return;
                try { await DuckBridge.call('profile.delete', { id }); this._selectedIds.delete(id); this._updateBulkActions(); await this.loadProfiles(); window.ProfileModals?.CreateProfile?._refreshEntityData?.(); }
                catch (e) { console.error('Delete failed:', e); }
            }
        },
        async _bulkLaunch() {
            if (this._selectedIds.size === 0) return;
            const ids = [...this._selectedIds];
            try {
                await DuckBridge.call('browser.bulkStart', ids);
                await this.loadProfiles();
            } catch (e) { console.error('Bulk launch failed:', e); }
        },
        async _bulkStop() {
            if (this._selectedIds.size === 0) return;
            const ids = [...this._selectedIds];
            try {
                await DuckBridge.call('browser.bulkStop', ids);
                await this.loadProfiles();
            } catch (e) { console.error('Bulk stop failed:', e); }
        },
        _bulkHealth()  { },
        _bulkRename()  { if (this._selectedIds.size > 0) window.ProfileModals?.BulkRename?.show([...this._selectedIds].map(id => this._profilesData.find(p => p.id === id)).filter(Boolean)); },
        async _bulkDelete() {
            if (this._selectedIds.size === 0) return;
            window.ProfileModals?.DeleteProfiles.show(this._selectedIds, async (ids) => {
                try {
                    await DuckBridge.call('profile.bulkDelete', ids);
                } catch (e) { /* toast handled by DuckBridge */ }
                this._selectedIds.clear(); this._updateBulkActions(); await this.loadProfiles();
                window.ProfileModals?.CreateProfile?._refreshEntityData?.();
            });
        },
        _bulkRemoveProxy() { if (this._selectedIds.size > 0) window.ProfileModals?.RemoveProxy?.show(this._selectedIds, async (ids) => { await this.loadProfiles(); }); },
        _bulkCopyProxy() {
            if (this._selectedIds.size === 0) return;
            const proxies = [...this._selectedIds].map(id => this._profilesData.find(p => p.id === id)?.proxy).filter(p => p && p !== 'Direct');
            if (!proxies.length) return;
            this._copyToClipboard(proxies.join('\n'));
        },
        async _bulkCheckProxy() {
            if (this._selectedIds.size === 0) return;
            const idsWithProxy = [...this._selectedIds].filter(id => {
                const r = this._profilesData.find(p => p.id === id);
                return r?.proxy && r.proxy !== 'Direct';
            });
            if (!idsWithProxy.length) return;

            for (const id of idsWithProxy) {
                const r = this._profilesData.find(p => p.id === id);
                if (r) { r.status = 'running'; r.message = 'Checking proxy...'; }
            }
            this._table?.updateData(this._profilesData);

            for (const id of idsWithProxy) {
                const r = this._profilesData.find(p => p.id === id);
                if (!r) continue;
                const proxyId = r.proxyId || r.proxyid;
                if (!proxyId) { r.status = 'ready'; r.message = 'No proxy'; continue; }
                try {
                    const result = await DuckBridge.call('proxy.check', { id: proxyId });
                    r.status = 'ready';
                    r.message = result?.Status === 'alive'
                        ? `Proxy alive - ${result.LatencyMs}ms`
                        : 'Proxy dead';
                } catch {
                    r.status = 'ready';
                    r.message = 'Proxy check failed';
                }
            }
            this._table?.updateData(this._profilesData);
        },
        async _openModal(profileId) {
            if (!window.ProfileModals?.CreateProfile) {
                console.warn('[Profiles] CreateProfile modal not found');
                return;
            }
            window.ProfileModals.CreateProfile.show(profileId);
        },

        async _checkSingleProxy(row) {
            const proxyId = row.proxyId || row.proxyid;
            if (!proxyId) {
                window.DuckControls.Toast?.info?.('No Proxy', 'This profile has no proxy configured');
                return;
            }
            try {
                const result = await DuckBridge.call('proxy.check', { id: proxyId });
                if (result?.Status === 'alive') {
                    window.DuckControls.Toast?.success?.('Proxy Alive', `${result.LatencyMs}ms response time`);
                } else {
                    window.DuckControls.Toast?.error?.('Proxy Dead', 'Proxy is not responding');
                }
            } catch (e) {
                window.DuckControls.Toast?.error?.('Proxy Check Failed', e?.message || 'Unknown error');
            }
        },

        async _detectScreen(row) {
            try {
                const info = await DuckBridge.call('profile.detectScreen');
                const msg = `Screen: ${info.width}×${info.height}\nWork area: ${info.workAreaWidth}×${info.workAreaHeight}\nVirtual: ${info.virtualScreenWidth}×${info.virtualScreenHeight}`;
                window.DuckControls.Toast?.info?.('Screen Info', msg);
            } catch (e) {
                window.DuckControls.Toast?.error?.('Detect Failed', e?.message || 'Unknown error');
            }
        },

        async _duplicateProfile(row) {
            try {
                const newProfile = await DuckBridge.call('profile.duplicate', { id: row.id, name: `${row.name} (Copy)` });
                window.DuckControls.Toast?.success?.('Duplicated', `Profile "${row.name}" has been duplicated`);
                if (window.ProfilesView?.loadProfiles) window.ProfilesView.loadProfiles();
            } catch (e) {
                window.DuckControls.Toast?.error?.('Duplicate Failed', e?.message || 'Unknown error');
            }
        },

        _handleCheckAll(e) { e.checked ? this._profilesData.forEach(p => this._selectedIds.add(p.id)) : this._selectedIds.clear(); this._updateBulkActions(); },
        _updateBulkActions() {
            const has = this._selectedIds.size > 0;
            const bar = document.getElementById('bulk-actions');
            const cnt = document.getElementById('bulk-count');
            if (bar) { bar.classList.toggle('visible', has); if (cnt) cnt.textContent = `${this._selectedIds.size} selected`; }
        },

        // ── Cell renderers ───────────────────────────────────────────
        _renderNameCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;';
            const nc = document.createElement('div');
            nc.style.cssText = 'display:flex;align-items:center;width:100%;';
            const badge = document.createElement('span');
            const bt = (row.browserType || '').toLowerCase();
            badge.style.cssText = 'font-size:10px;font-weight:700;background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);border-radius:4px;padding:2px 4px;margin-right:8px;flex-shrink:0;width:56px;text-align:center;box-sizing:border-box;';
            badge.textContent = bt.includes('mac') ? 'MacOS' : bt.includes('lin') ? 'Linux' : 'Windows';
            const cw = document.createElement('div');
            cw.style.cssText = 'flex:1;min-width:0;display:flex;align-items:center;';
            const lbl = document.createElement('span');
            lbl.style.cssText = 'font-weight:500;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text;display:block;flex:1;';
            lbl.textContent = (row.name && row.name.trim()) ? this._escapeHtml(row.name) : '-';
            
            // Create Input control for inline editing
            const inputCtrl = DuckControls.Input.create({
                placeholder: 'Enter name...',
                value: row.name || ''
            });
            inputCtrl.element.style.display = 'none';
            inputCtrl.element.style.flex = '1';
            
            lbl.addEventListener('dblclick', () => {
                lbl.style.display = 'none';
                inputCtrl.element.style.display = 'flex';
                inputCtrl.input.focus();
                inputCtrl.input.select();
            });
            
            const done = async () => {
                inputCtrl.element.style.display = 'none';
                lbl.style.display = 'block';
                const newName = inputCtrl.getValue();
                if (newName !== row.name) {
                    row.name = newName;
                    lbl.textContent = this._escapeHtml(row.name || '-');
                    // Persist to database using camelCase (backend uses JsonNamingPolicy.CamelCase)
                    try {
                        // Fetch profile first to preserve existing data
                        const profile = await DuckBridge.call('profile.get', { id: row.id });
                        await DuckBridge.call('profile.update', {
                            id: row.id,
                            name: newName,
                            groupId: profile?.groupId ?? row.groupId ?? null,
                            tagIds: profile?.tagIds ?? row.tagIds ?? null,
                            proxyId: profile?.proxyId ?? row.proxyId ?? null,
                            browserType: profile?.browserType ?? row.browserType ?? 'Chromium',
                            browserVersion: profile?.browserVersion ?? '138',
                            profileData: profile?.profileData ?? '{}',
                            notes: profile?.notes ?? row.notes ?? '',
                            cookies: profile?.cookies ?? null
                        });
                        // Refresh groups and tags in case name is used for grouping
                        if (this.loadGroups) this.loadGroups();
                        if (this.loadTags) this.loadTags();
                    } catch (e) {
                        console.error('Failed to update profile name:', e);
                        window.DuckControls.Toast?.error?.('Update Failed', e?.message || 'Unknown error');
                    }
                }
            };
            
            inputCtrl.input.addEventListener('blur', done);
            inputCtrl.input.addEventListener('keydown', (e) => { 
                if (e.key === 'Enter') done(); 
                if (e.key === 'Escape') { 
                    inputCtrl.setValue(row.name || ''); 
                    done(); 
                } 
            });
            
            cw.appendChild(lbl);
            cw.appendChild(inputCtrl.element);
            nc.appendChild(badge);
            nc.appendChild(cw);
            nc.addEventListener('click', (e) => e.stopPropagation());
            wrap.appendChild(nc);
            return wrap;
        },

        _renderResourceCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;';
            const btn = document.createElement('button');
            DuckControls.Button.create(btn, { text: 'Data', icon: 'category', variant: 'secondary', size: 'sm', onClick: (e) => { e.stopPropagation(); window.ProfileModals?.ManageData?.show(row.id); } });
            wrap.appendChild(btn);
            return wrap;
        },

        _renderGroupCell(row) {
            const el = document.createElement('span');
            el.style.cssText = 'color:var(--text-primary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;width:100%;';
            el.textContent = row.groupName || '-';
            return el;
        },

        _renderTagsCell(row) {
            const tags = Array.isArray(row.tags) ? row.tags : [];
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-wrap:nowrap;gap:4px;overflow:hidden;align-items:center;width:100%;';
            if (!tags.length) { const e = document.createElement('span'); e.style.cssText = 'color:var(--text-primary);font-size:12px;'; e.textContent = '-'; wrap.appendChild(e); return wrap; }
            tags.slice(0, 3).forEach(t => { const e = document.createElement('span'); DuckControls.Badge.create(e, { text: this._escapeHtml(String(t)) }); e.classList.add('duck-badge-info'); wrap.appendChild(e); });
            if (tags.length > 3) { const e = document.createElement('span'); e.style.cssText = 'color:var(--text-tertiary);font-weight:700;font-size:12px;'; e.textContent = '...'; wrap.appendChild(e); }
            return wrap;
        },

        _renderProxyCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;';
            const ps = row.proxy || 'Direct';
            if (ps === 'Direct') { wrap.textContent = '-'; return wrap; }
            const hiddenText = '********';
            const fullText = ps.length > 30 ? ps.substring(0, 30) + '...' : ps;
            const panel = document.createElement('div');
            panel.style.cssText = 'flex:1;min-width:0;display:flex;align-items:center;background:var(--bg-surface);border:1px solid var(--border-default);border-radius:6px;padding:4px 8px;cursor:pointer;';
            const te = document.createElement('span');
            te.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--text-primary);width:100%;display:block;max-width:25ch;';
            te.textContent = hiddenText;
            panel.appendChild(te);
            panel.addEventListener('click', (e) => { e.stopPropagation(); this._copyToClipboard(ps).then(() => { const orig = te.textContent; te.textContent = 'Copied'; te.style.color = 'var(--success)'; setTimeout(() => { te.textContent = orig; te.style.color = ''; }, 1000); }); });
            wrap.appendChild(panel);
            let hidden = true;
            const eyeBtn = document.createElement('button');
            DuckControls.Button.create(eyeBtn, { icon: 'visibility', variant: 'secondary', size: 'sm' });
            eyeBtn.style.cssText = 'flex-shrink:0;border-radius:6px;';
            eyeBtn.onclick = (e) => { e.stopPropagation(); hidden = !hidden; te.textContent = hidden ? hiddenText : fullText; te.style.maxWidth = hidden ? '25ch' : '30ch'; eyeBtn.innerHTML = `<span class="material-symbols-outlined duck-btn-icon">${hidden ? 'visibility' : 'visibility_off'}</span>`; };
            wrap.appendChild(eyeBtn);
            return wrap;
        },

        _renderNoteCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;display:flex;align-items:center;position:relative;';

            const lbl = document.createElement('span');
            lbl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;color:var(--text-secondary);font-size:12px;cursor:text;display:block;';
            lbl.textContent = row.notes || '-';

            // Create Input control for inline editing
            const inputCtrl = window.DuckControls.Input.create({
                placeholder: 'Enter note...',
                value: row.notes || ''
            });
            inputCtrl.element.style.display = 'none';
            inputCtrl.element.style.flex = '1';

            lbl.addEventListener('dblclick', () => {
                lbl.style.display = 'none';
                inputCtrl.element.style.display = 'flex';
                inputCtrl.input.focus();
                inputCtrl.input.select();
            });

            const done = async () => {
                inputCtrl.element.style.display = 'none';
                lbl.style.display = 'block';
                const newVal = inputCtrl.getValue();
                if (newVal !== row.notes) {
                    row.notes = newVal;
                    lbl.textContent = newVal || '-';
                    // Persist to database
                    try {
                        const profile = await DuckBridge.call('profile.get', { id: row.id });
                        await DuckBridge.call('profile.update', {
                            id: row.id,
                            name: profile?.name ?? row.name ?? '',
                            groupId: profile?.groupId ?? row.groupId ?? null,
                            tagIds: profile?.tagIds ?? row.tagIds ?? null,
                            proxyId: profile?.proxyId ?? row.proxyId ?? null,
                            browserType: profile?.browserType ?? row.browserType ?? 'Chromium',
                            browserVersion: profile?.browserVersion ?? '138',
                            profileData: profile?.profileData ?? '{}',
                            notes: newVal,
                            cookies: profile?.cookies ?? null
                        });
                    } catch (e) {
                        console.error('Failed to update note:', e);
                        window.DuckControls.Toast?.error?.('Update Failed', e?.message || 'Unknown error');
                    }
                }
            };

            inputCtrl.input.addEventListener('blur', done);
            inputCtrl.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') done();
                if (e.key === 'Escape') {
                    inputCtrl.setValue(row.notes || '');
                    done();
                }
            });

            wrap.appendChild(lbl);
            wrap.appendChild(inputCtrl.element);
            return wrap;
        },

        _renderMessageCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;display:flex;align-items:center;gap:4px;';
            const msg = row.message && row.message !== '-' ? row.message : '';
            if (msg) {
                const cp = document.createElement('button');
                cp.style.cssText = 'flex-shrink:0;background:none;border:none;cursor:pointer;padding:0 2px;color:var(--text-muted);display:flex;align-items:center;';
                cp.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;">content_copy</span>';
                cp.onclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(msg); };
                wrap.appendChild(cp);
            }
            const lbl = document.createElement('span');
            lbl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;color:var(--text-tertiary);font-size:12px;';
            lbl.textContent = this._escapeHtml(msg || '-');
            wrap.appendChild(lbl);
            return wrap;
        },

        _renderStatusBadge(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;';
            const st = (row.status || 'stopped').toLowerCase();
            const pill = document.createElement('span');
            pill.style.cssText = `display:inline-block;width:14px;height:6px;border-radius:3px;margin-right:6px;background:${st === 'running' ? '#eab308' : st === 'ready' ? '#3b82f6' : '#ef4444'};`;
            const txt = document.createElement('span');
            txt.style.cssText = 'font-size:12px;font-weight:500;';
            txt.textContent = st.charAt(0).toUpperCase() + st.slice(1);
            wrap.appendChild(pill); wrap.appendChild(txt);
            return wrap;
        },

        _renderDateCell(value) {
            const el = document.createElement('span');
            el.style.cssText = 'font-size:12px;';
            el.textContent = this._formatDate(value);
            return el;
        },

        _renderActionCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:2px;justify-content:flex-end;';
            const running = row.status === 'running';
            const mk = (el, cfg) => DuckControls.Button.create(el, cfg);

            const playBtn = document.createElement('button');
            mk(playBtn, { icon: running ? 'stop' : 'play_arrow', text: running ? 'Stop' : 'Run', variant: running ? 'danger' : 'success', size: 'sm' });
            playBtn.style.cssText = 'width:70px;justify-content:center;';
            playBtn.onclick = (e) => { e.stopPropagation(); running ? this._stopProfile(row.id) : this._startProfile(row.id); };

            const gearBtn = document.createElement('button');
            mk(gearBtn, { icon: 'settings', variant: 'ghost', size: 'sm' });
            gearBtn.classList.add('duck-btn-icon-only');
            gearBtn.onclick = (e) => { e.stopPropagation(); this._openModal(row.id); };

            const moreBtn = document.createElement('button');
            mk(moreBtn, { icon: 'more_vert', variant: 'ghost', size: 'sm' });
            moreBtn.classList.add('duck-btn-icon-only');
            moreBtn.onclick = (e) => e.stopPropagation();

            if (window.DuckControls?.ContextMenu) {
                window.DuckControls.ContextMenu.create(moreBtn, {
                    items: [
                        { type: 'label', label: 'Profile Actions' },
                        { label: 'Start Profile', icon: 'play_arrow', onClick: () => this._startProfile(row.id) },
                        { label: 'Stop Profile', icon: 'stop_circle', onClick: () => this._stopProfile(row.id) },
                        'divider',
                        { label: 'Check Proxy', icon: 'dns', onClick: () => this._checkSingleProxy(row) },
                        { label: 'Manage Cookies', icon: 'cookie', onClick: () => window.ProfileModals?.ManageCookies?.show([row.id]) },
                        { label: 'Set Browser Version', icon: 'laptop', onClick: () => window.ProfileModals?.SetBrowserVersion?.show([row.id]) },
                        'divider',
                        { label: 'Detect Screen', icon: 'monitor', onClick: () => this._detectScreen(row) },
                        { label: 'Duplicate', icon: 'content_copy', onClick: () => this._duplicateProfile(row) },
                        { label: 'Delete Profile', icon: 'delete', danger: true, onClick: () => this._deleteProfile(row.id) }
                    ]
                });
            }

            wrap.appendChild(playBtn); wrap.appendChild(gearBtn); wrap.appendChild(moreBtn);
            return wrap;
        },

        _showRowContextMenu(e, row) {
            e.preventDefault();
            const getIds = () => this._selectedIds.has(row.id) ? [...this._selectedIds].map(id => this._profilesData.find(p => p.id === id)).filter(Boolean) : [row];
            DuckControls.ContextMenu.create(null, {
                items: [
                    { label: 'Copy', icon: 'content_copy', children: [
                        { label: 'Profile Name', icon: 'badge', onClick: () => navigator.clipboard.writeText(row.name) },
                        { label: 'Profile ID', icon: 'fingerprint', onClick: () => navigator.clipboard.writeText(row.id) },
                        { label: 'Proxy', icon: 'public', onClick: () => { const p = row.proxy || ''; if (p) navigator.clipboard.writeText(p); } }
                    ]},
                    'divider',
                    { label: 'Browser Config', icon: 'settings', children: [
                        { label: 'Clear Cache', icon: 'cleaning_services', onClick: () => window.ProfileModals?.ClearCache?.show([row.id]) },
                        { label: 'Set Browser Version', icon: 'manage_history', onClick: () => window.ProfileModals?.SetBrowserVersion?.show([row.id]) },
                        { label: 'New Fingerprint', icon: 'casino', onClick: () => window.ProfileModals?.NewFingerprint?.show([row.id]) },
                        { label: 'Change Location', icon: 'my_location', onClick: () => window.ProfileModals?.ChangeLocation?.show([row.id]) },
                        { label: 'Change Bookmarks', icon: 'bookmark_add', onClick: () => window.ProfileModals?.ChangeBookmark?.show([row.id]) },
                        { label: 'Update Start URL', icon: 'link', onClick: () => window.ProfileModals?.UpdateStartUrl?.show([row.id]) }
                    ]},
                    'divider',
                    { label: 'Export Profile(s)', icon: 'download', onClick: () => window.ProfileModals?.ExportProfiles?.show([row.id]) },
                    { label: 'Bulk Rename', icon: 'edit_note', onClick: () => window.ProfileModals?.BulkRename?.show([row]) },
                    { label: 'Delete Selected', icon: 'delete', danger: true, onClick: () => this._deleteProfile(row.id) }
                ]
            }).showAt(e.clientX, e.clientY);
        },

        // ── Utilities ───────────────────────────────────────────────
        _escapeHtml(text) { const d = document.createElement('div'); d.textContent = text; return d.innerHTML; },
        _formatDate(dateStr) {
            if (!dateStr) return '-';
            try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
            catch { return dateStr; }
        },
        async _copyToClipboard(text) {
            if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
            return new Promise((resolve, reject) => {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = text; ta.style.cssText = 'position:fixed;left:-999999px;top:-999999px;';
                    document.body.appendChild(ta); ta.focus(); ta.select();
                    document.execCommand('copy') ? resolve() : reject(new Error('copy failed'));
                    ta.remove();
                } catch (e) { reject(e); }
            });
        },
        _loadColPreferences() {
            const saved = localStorage.getItem('duck_profile_visible_cols');
            if (saved) { 
                try { 
                    const arr = JSON.parse(saved); 
                    if (Array.isArray(arr)) this._visibleCols = new Set(arr); 
                } catch {} 
            }
        }
    };

    window.DuckApp?.registerView('profiles', VIEW);
    window.ProfilesView = VIEW;
})();
