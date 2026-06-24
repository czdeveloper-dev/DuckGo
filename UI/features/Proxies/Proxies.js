(function () {
    'use strict';

    const VIEW = {
        _initialized: false,
        _selectedIds: new Set(),
        _filters: { search: '', id: '', group: '', tag: '', status: '' },
        _proxiesData: [],
        _proxyGroups: [],
        _proxyTags: [],
        _visibleCols: new Set(['seq', 'name', 'group', 'tags', 'proxy_detail', 'status', 'message', 'note', 'created', 'action']),

        async onShow() { if (!this._initialized) { this._loadColPreferences(); this._initialized = true; this.initUI(); await this.loadProxyGroups(); await this.loadProxyTags(); await this.loadProxies(); } },

        _loadColPreferences() {
            try {
                const saved = localStorage.getItem('proxy_visible_cols');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this._visibleCols = new Set(parsed);
                }
            } catch (e) { console.error('[Proxies] Load cols failed:', e); }
        },

        _customizeColumns() {
            if (window.ProxyModals?.CustomizeColumn) {
                window.ProxyModals.CustomizeColumn.show(this._visibleCols, () => {
                    localStorage.setItem('proxy_visible_cols', JSON.stringify([...this._visibleCols]));
                    if (this._table) this._table.updateColumnVisibility(this._visibleCols);
                });
            }
        },

        async loadProxyGroups() {
            try {
                this._proxyGroups = await DuckBridge.call('proxygroup.list') || [];
                this._proxyGroups.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                this._updateGroupSelect();
            } catch (e) { console.error('[Proxies] loadProxyGroups failed:', e); }
        },

        async loadProxyTags() {
            try {
                this._proxyTags = await DuckBridge.call('proxytag.list') || [];
                this._proxyTags.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                this._updateTagSelect();
            } catch (e) { console.error('[Proxies] loadProxyTags failed:', e); }
        },

        async loadProxies() {
            if (this._table && this._table.setLoading) this._table.setLoading(true);
            let items = [];
            try {
                const filters = { ...this._filters };
                
                // Chuyển đổi filter values
                if (filters.group) filters.groupId = parseInt(filters.group);
                if (filters.tag) filters.tagIds = filters.tag.split(',').map(v => parseInt(v)).filter(v => !isNaN(v));
                if (filters.status !== '') filters.status = filters.status;
                
                // Đổi tên id -> idStr cho backend
                if (filters.id) { filters.idStr = filters.id; delete filters.id; }
                
                const minTimePromise = new Promise(resolve => setTimeout(resolve, 300));
                const [resp] = await Promise.all([
                    DuckBridge.call('proxy.list', filters),
                    minTimePromise
                ]);
                
                items = resp?.Items || resp || [];
            } catch (err) {
                console.error('[Proxies] Load failed:', err);
                items = [];
            } finally {
                if (this._table && this._table.setLoading) this._table.setLoading(false);
            }

            items = items.map((p, idx) => ({
                ...p,
                id: p.Id || p.id || 0,
                seq: idx + 1,
                name: p.Name || p.name || '',
                proxy_type: p.Type || p.type || p.proxy_type || 'http',
                host: p.Host || p.host || '',
                port: p.Port || p.port || '',
                username: p.Username || p.username || '',
                password: p.Password || p.password || '',
                groupName: p.GroupName || p.groupName || '',
                tags: p.TagNames || p.tagNames || [],
                groupId: p.GroupId || p.groupId,
                tagIds: p.TagIds || p.tagIds || [],
                status: p.Status || p.status || 'not_checked',
                message: p.Message || p.message || '',
                note: p.Notes || p.notes || p.note || '',
                rotaryApi: p.RotaryApi || p.rotaryApi || '',
                latencyMs: p.LatencyMs || p.latencyMs,
                createdAt: p.CreatedAt || p.createdAt
            }));

            this._proxiesData = items;
            const currentIds = new Set(items.map(p => p.id));
            for (const id of this._selectedIds) { if (!currentIds.has(id)) this._selectedIds.delete(id); }
            this._updateBulkActions();
            this._loadTableData(items);
            this._updateStats(items);
        },

        _buildGroupOptions() {
            return [
                { label: 'All Groups', value: '' },
                ...this._proxyGroups.map(g => ({
                    label: g.Name || g.name || '',
                    value: String(g.Id || g.id),
                    actions: [{ icon: 'edit', onClick: () => this._editGroup(g) }]
                }))
            ];
        },

        _buildTagOptions() {
            return [
                ...this._proxyTags.map(t => ({
                    label: t.Name || t.name || '',
                    value: String(t.Id || t.id),
                    actions: [{ icon: 'edit', onClick: () => this._editTag(t) }]
                }))
            ];
        },

        _updateGroupSelect() { if (this._groupCtrl) this._groupCtrl.setOptions(this._buildGroupOptions()); },
        _updateTagSelect() {
            if (this._tagCtrl) this._tagCtrl.setOptions(this._buildTagOptions());
        },

        // 🟢 Proxy Group CRUD 🟢
        _buildGroupDeleteItems() {
            return this._proxyGroups.map(g => ({ label: g.Name || g.name || '', value: String(g.Id || g.id) }));
        },

        async _createGroup() {
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('proxygroup', async (name) => {
                try {
                    const result = await DuckBridge.call('proxygroup.create', { name });
                    this._proxyGroups.push(result);
                    this._proxyGroups.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                    this._updateGroupSelect();
                } catch (e) {
                    window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to create group');
                }
            });
        },

        async _editGroup(groupObj) {
            let group = groupObj;
            if (!group) {
                const selectedValue = this._groupCtrl?.getValue() || '';
                if (!selectedValue) return;
                group = this._proxyGroups.find(g => String(g.Id || g.id) === selectedValue);
            }
            if (!group) return;
            const currentName = group.Name || group.name || '';
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('proxygroup', async (newName) => {
                try {
                    const updated = await DuckBridge.call('proxygroup.update', { id: group.Id || group.id, name: newName });
                    const idx = this._proxyGroups.findIndex(g => g.Id === updated.Id || g.id === updated.id);
                    if (idx !== -1) this._proxyGroups[idx] = updated;
                    this._proxyGroups.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                    this._updateGroupSelect();
                } catch (e) {
                    window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to update group');
                }
            }, currentName);
        },

        async _deleteGroup() {
            const items = this._buildGroupDeleteItems();
            if (items.length === 0) return;
            if (!window.ProxyModals?.DeleteEntity) return;
            window.ProxyModals.DeleteEntity.show('proxygroup', items, async (selectedValues, deleteMode) => {
                try {
                    for (const val of selectedValues) {
                        if (deleteMode === 'deleteAll') {
                            await DuckBridge.call('proxygroup.deleteWithProxies', { id: parseInt(val) });
                        } else {
                            await DuckBridge.call('proxygroup.delete', { id: parseInt(val) });
                        }
                    }
                    this._proxyGroups = this._proxyGroups.filter(g => !selectedValues.includes(String(g.Id || g.id)));
                    this._updateGroupSelect();
                    this._filters.group = '';
                    await this.loadProxies();
                } catch (e) {
                    window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to delete group');
                }
            });
        },

        // 🟢 Proxy Tag CRUD 🟢
        _buildTagDeleteItems() {
            return this._proxyTags.map(t => ({ label: t.Name || t.name || '', value: String(t.Id || t.id) }));
        },

        async _createTag() {
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('proxytag', async (name) => {
                try {
                    const result = await DuckBridge.call('proxytag.create', { name });
                    this._proxyTags.push(result);
                    this._proxyTags.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                    this._updateTagSelect();
                } catch (e) {
                    window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to create tag');
                }
            });
        },

        async _editTag(tagObj) {
            let tag = tagObj;
            if (!tag) {
                const selectedValues = this._tagCtrl?.getValues() || [];
                if (selectedValues.length === 0) return;
                const tagId = parseInt(selectedValues[0]);
                tag = this._proxyTags.find(t => (t.Id || t.id) === tagId);
            }
            if (!tag) return;
            const currentName = tag.Name || tag.name || '';
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('proxytag', async (newName) => {
                try {
                    const updated = await DuckBridge.call('proxytag.update', { id: tag.Id || tag.id, name: newName });
                    const idx = this._proxyTags.findIndex(t => t.Id === updated.Id || t.id === updated.id);
                    if (idx !== -1) this._proxyTags[idx] = updated;
                    this._proxyTags.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                    this._updateTagSelect();
                } catch (e) {
                    window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to update tag');
                }
            }, currentName);
        },

        async _deleteTag() {
            const items = this._buildTagDeleteItems();
            if (items.length === 0) return;
            if (!window.ProxyModals?.DeleteEntity) return;
            window.ProxyModals.DeleteEntity.show('proxytag', items, async (selectedValues) => {
                try {
                    for (const val of selectedValues) {
                        await DuckBridge.call('proxytag.delete', { id: parseInt(val) });
                    }
                    this._proxyTags = this._proxyTags.filter(t => !selectedValues.includes(String(t.Id || t.id)));
                    this._updateTagSelect();
                    await this.loadProxies();
                } catch (e) {
                    window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to delete tag');
                }
            });
        },

        initUI() {
            const refreshEl = document.getElementById('proxy-ctrl-refresh');
            if (refreshEl) {
                this._refreshBtn = DuckControls.Button.create(refreshEl, {
                    variant: 'surface', icon: 'refresh',
                    onClick: () => Promise.all([this.loadProxyGroups(), this.loadProxyTags(), this.loadProxies()])
                });
            }

            const colsEl = document.getElementById('proxy-ctrl-cols');
            if (colsEl) {
                this._colsBtn = DuckControls.Button.create(colsEl, {
                    variant: 'surface', icon: 'view_column',
                    onClick: () => this._customizeColumns()
                });
            }

            const createEl = document.getElementById('proxy-ctrl-create');
            if (createEl) {
                this._createBtn = DuckControls.Button.create(createEl, {
                    variant: 'primary', icon: 'add', text: 'Create Proxy',
                    onClick: () => { window.ProxyModals?.CreateProxy?.show(); }
                });
            }

            this._initSearchControls();
            this._initSelectControls();
            this._initActionChips();
            this._initBulkActions();
            try {
                this._buildTable();
            } catch (err) {
                console.error('[Proxies] _buildTable failed:', err);
                if (window.DuckControls?.Toast) {
                    window.DuckControls.Toast.error('Table creation failed: ' + (err.message || String(err)));
                }
            }
        },

        _initSearchControls() {
            const searchContainer = document.getElementById('proxy-ctrl-search');
            if (searchContainer) {
                this._searchCtrl = DuckControls.Input.create({
                    label: 'SEARCH', placeholder: 'Search by Name...', icon: 'search',
                    width: '200px', bgVariant: 'subtle',
                    onInput: (e) => { this._filters.search = e.target.value; this.loadProxies(); }
                });
                searchContainer.appendChild(this._searchCtrl.element);
            }

            const idContainer = document.getElementById('proxy-ctrl-id');
            if (idContainer) {
                this._idCtrl = DuckControls.Input.create({
                    label: 'ID', placeholder: '1,2,3 or 1-5', icon: 'tag',
                    width: '140px', bgVariant: 'subtle',
                    onInput: (e) => { this._filters.id = e.target.value; this.loadProxies(); }
                });
                idContainer.appendChild(this._idCtrl.element);
            }
        },

        _initSelectControls() {
            const groupContainer = document.getElementById('proxy-ctrl-group');
            if (groupContainer) {
                this._groupCtrl = DuckControls.Select.create({
                    label: 'GROUP', placeholder: 'All Groups', width: '180px', bgVariant: 'subtle',
                    value: this._filters.group,
                    actions: [
                        { text: 'Delete', icon: 'delete', color: 'var(--danger)', onClick: () => this._deleteGroup() },
                        { text: '+ Create', icon: 'add', onClick: () => this._createGroup() }
                    ],
                    options: this._buildGroupOptions(),
                    onChange: (e) => { this._filters.group = e.target.value; this.loadProxies(); }
                });
                groupContainer.appendChild(this._groupCtrl.element);
            }

            const tagContainer = document.getElementById('proxy-ctrl-tag');
            if (tagContainer) {
                this._tagCtrl = DuckControls.MultiSelectComboBox.create({
                    label: 'TAG', placeholder: 'All Tags', width: '180px', bgVariant: 'subtle',
                    actions: [
                        { text: 'Delete', icon: 'delete', color: 'var(--danger)', onClick: () => this._deleteTag() },
                        { text: '+ Create', icon: 'add', onClick: () => this._createTag() }
                    ],
                    options: this._buildTagOptions(),
                    onChange: (selectedValues) => { this._filters.tag = selectedValues.join(','); this.loadProxies(); }
                });
                tagContainer.appendChild(this._tagCtrl.element);
            }

            const statusContainer = document.getElementById('proxy-ctrl-status');
            if (statusContainer) {
                this._statusCtrl = DuckControls.Select.create({
                    label: 'STATUS', placeholder: 'All Status', width: '140px', bgVariant: 'subtle',
                    options: [
                        { label: 'All', value: '' },
                        { label: 'Not check', value: 'not_checked' },
                        { label: 'Alive', value: 'alive' },
                        { label: 'Dead', value: 'dead' },
                        { label: 'Timeout', value: 'timeout' }
                    ],
                    onChange: (e) => { this._filters.status = e.target.value; this.loadProxies(); }
                });
                statusContainer.appendChild(this._statusCtrl.element);
            }

            const statContainer = document.getElementById('proxy-ctrl-stat');
            if (statContainer) {
                const wrap = document.createElement('div');
                wrap.className = 'filter-stacked';
                const head = document.createElement('div');
                head.className = 'filter-stacked-head';
                const lbl = document.createElement('span');
                lbl.className = 'ui-label-sm';
                lbl.textContent = 'TOTAL PROXIES';
                head.appendChild(lbl);
                wrap.appendChild(head);
                this._statEl = document.createElement('div');
                this._statEl.className = 'input-field-sm bg-subtle';
                this._statEl.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;min-width:80px;';
                this._statEl.textContent = '0';
                wrap.appendChild(this._statEl);
                statContainer.appendChild(wrap);
            }
        },

        _initActionChips() {
            const chipsContainer = document.getElementById('proxy-ctrl-chips');
            if (!chipsContainer) return;

            const mk = (el, cfg) => DuckControls.Button.create(el, cfg);

            const proxyEl = document.createElement('button');
            chipsContainer.appendChild(proxyEl);
            mk(proxyEl, { variant: 'chip', icon: 'dns', text: 'Proxies', dropdownArrow: true, onClick: () => {} });
            DuckControls.ContextMenu.create(proxyEl, {
                items: [
                    { label: 'Import Proxies', icon: 'upload', onClick: () => window.ProxyModals?.ImportProxy?.show(async () => { await this.loadProxyGroups(); await this.loadProxyTags(); await this.loadProxies(); }) },
                    { label: 'Export Proxies', icon: 'download', onClick: () => { if (this._selectedIds.size > 0) window.ProxyModals?.ExportProxies?.show([...this._selectedIds]); } },
                    { label: 'Check Proxies', icon: 'wifi_tethering', onClick: () => { if (this._selectedIds.size > 0) this._bulkCheck(); } },
                    { label: 'Copy Proxies', icon: 'content_copy', onClick: () => this._bulkCopy() },
                    'divider',
                    { label: 'Delete Selected', icon: 'delete', color: 'var(--danger)', danger: true, onClick: () => { if (this._selectedIds.size > 0) this._bulkDelete(); } }
                ]
            });

            const actionsEl = document.createElement('button');
            chipsContainer.appendChild(actionsEl);
            mk(actionsEl, { variant: 'chip', icon: 'bolt', text: 'Actions', dropdownArrow: true, onClick: () => {} });
            DuckControls.ContextMenu.create(actionsEl, {
                items: [
                    { label: 'Bulk Rename', icon: 'edit_note', onClick: () => this._bulkRename() },
                    { label: 'Compare Proxies', icon: 'compare_arrows', onClick: () => window.ProxyModals?.CompareProxies?.show(this._proxiesData, this._selectedIds) }
                ]
            });

            const scheduleEl = document.createElement('button');
            chipsContainer.appendChild(scheduleEl);
            mk(scheduleEl, { variant: 'chip', icon: 'schedule', text: 'Auto Check Schedule', onClick: () => window.ProxyModals?.AutoCheckSchedule?.show() });
        },

        _initBulkActions() {
            const mkBtn = (id, cfg) => {
                const el = document.getElementById(id);
                if (el) DuckControls.Button.create(el, cfg);
            };
            mkBtn('proxy-ctrl-bulk-check', { variant: 'secondary', size: 'sm', icon: 'wifi_tethering', text: 'Check Proxies', onClick: () => this._bulkCheck() });
            mkBtn('proxy-ctrl-bulk-rename', { variant: 'secondary', size: 'sm', icon: 'drive_file_rename_outline', text: 'Bulk Rename', onClick: () => this._bulkRename() });
            mkBtn('proxy-ctrl-bulk-delete', { variant: 'danger', size: 'sm', icon: 'delete', text: 'Delete Proxies', onClick: () => this._bulkDelete() });
            mkBtn('proxy-ctrl-bulk-close', { variant: 'ghost', size: 'sm', icon: 'close', onClick: () => {
                this._table?.clearChecked?.();
                this._selectedIds.clear();
                this._updateBulkActions();
            } });
        },

        _updateBulkActions() {
            const bar = document.getElementById('proxy-bulk-actions');
            const countEl = document.getElementById('proxy-bulk-count');
            if (!bar || !countEl) return;

            if (this._selectedIds.size > 0) {
                countEl.textContent = `${this._selectedIds.size} selected`;
                bar.classList.add('visible');
            } else {
                bar.classList.remove('visible');
            }
            
            // Sync with table - clear table checkboxes when nothing selected
            if (this._selectedIds.size === 0) {
                this._table?.clearChecked?.();
            }
        },

        _escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },

        _formatDate(isoString) {
            if (!isoString) return '-';
            try {
                const d = new Date(isoString);
                if (isNaN(d.getTime())) return '-';
                const pad = n => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
            } catch { return '-'; }
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

        _buildTable() {
            if (this._table?.destroy) this._table.destroy();
            const card = document.querySelector('#proxies-table-view .table-card');
            card?.querySelector('.data-table-wrap')?.remove();
            const _this = this;
            
            const cols = [
                { id: 'select', type: 'checkbox', title: 'Select all', locked: true, lockedPosition: 'left', resizable: false, width: '52px', onCheckAll: (e) => this._handleCheckAll(e) },
                { id: 'seq', label: '#', width: '40px', minWidth: '40px', locked: true, lockedPosition: 'left', resizable: false, align: 'center', render: (r) => { const el = document.createElement('span'); el.textContent = r.seq; return el; } },
                { id: 'name', label: 'NAME', width: '240px', minWidth: '120px', locked: true, lockedPosition: 'left', resizable: true, render: (r) => _this._renderNameCell(r) },
                { id: 'group', label: 'GROUP', width: '160px', minWidth: '160px', maxWidth: '240px', render: (r) => _this._renderGroupCell(r) },
                { id: 'tags', label: 'TAGS', width: '160px', minWidth: '160px', maxWidth: '240px', render: (r) => _this._renderTagsCell(r) },
                { id: 'proxy_detail', label: 'PROXY', width: '240px', minWidth: '240px', maxWidth: '320px', render: (r) => _this._renderProxyDetailCell(r) },
                { id: 'status', label: 'STATUS', width: '144px', minWidth: '144px', resizable: false, render: (r) => _this._renderStatusBadge(r) },
                { id: 'message', label: 'MESSAGE', width: '240px', minWidth: '240px', maxWidth: '400px', render: (r) => _this._renderMessageCell(r) },
                { id: 'note', label: 'NOTE', width: '240px', minWidth: '240px', maxWidth: '320px', resizable: true, render: (r) => _this._renderNoteCell(r) },
                { id: 'created', label: 'CREATED TIME', width: '200px', minWidth: '200px', resizable: false, render: (r) => _this._renderDateCell(r.createdAt) },
                { id: 'filler', fillSpace: true },
                { id: 'action', label: 'CONTROL', width: '170px', locked: true, lockedPosition: 'right', resizable: false, render: (r) => _this._renderActionCell(r) }
            ];

            const tableContainer = document.getElementById('proxies-table-view');
            this._table = DuckControls.Table.create({
                container: tableContainer, id: 'duck-table-proxies', emptyText: 'No proxies found', fillSpace: true,
                onCheckRow: (e, row) => { e.checked ? this._selectedIds.add(row.id) : this._selectedIds.delete(row.id); this._updateBulkActions(); },
                onRowContextMenu: (e, row) => this._showRowContextMenu(e, row),
                columns: cols
            });
            if (card) { card.style.cssText = 'flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;'; card.appendChild(this._table.element); }
            this._table.updateColumnVisibility(this._visibleCols);
        },

        _renderNameCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;';
            const nc = document.createElement('div');
            nc.style.cssText = 'display:flex;align-items:center;width:100%;';
            const badge = document.createElement('span');
            badge.style.cssText = 'font-size:10px;font-weight:700;background:color-mix(in srgb,var(--accent) 15%,transparent);color:var(--accent);border:1px solid color-mix(in srgb,var(--accent) 30%,transparent);border-radius:4px;padding:2px 4px;margin-right:8px;flex-shrink:0;width:56px;text-align:center;box-sizing:border-box;';
            badge.textContent = row.proxy_type ? String(row.proxy_type).toUpperCase() : 'HTTP';
            
            const cw = document.createElement('div');
            cw.style.cssText = 'flex:1;min-width:0;display:flex;align-items:center;';
            const lbl = document.createElement('span');
            lbl.style.cssText = 'font-weight:500;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text;display:block;flex:1;';
            lbl.textContent = (row.name && row.name.trim()) ? this._escapeHtml(row.name) : '-';
            
            const inputCtrl = DuckControls.Input.create({
                icon: 'badge',
                placeholder: 'Enter name...',
                value: row.name || ''
            });
            inputCtrl.element.style.display = 'none';
            inputCtrl.element.style.flex = '1';
            
            let isEditing = false;
            
            lbl.addEventListener('click', () => {
                if (isEditing) return;
                isEditing = true;
                lbl.style.display = 'none';
                inputCtrl.element.style.display = 'flex';
                inputCtrl.input.focus();
                inputCtrl.input.select();
            });
            
            const finishEditing = () => {
                if (!isEditing) return;
                isEditing = false;
                const newVal = inputCtrl.getValue().trim();
                lbl.style.display = 'block';
                inputCtrl.element.style.display = 'none';
                
                if (newVal !== (row.name || '').trim()) {
                    const oldName = row.name;
                    (async () => {
                        try {
                            await DuckBridge.call('proxy.updateName', { id: row.id, name: newVal });
                            row.name = newVal;
                            lbl.textContent = newVal || '-';
                        } catch (e) {
                            row.name = oldName;
                            lbl.textContent = oldName || '-';
                            window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to update name');
                        }
                    })();
                }
            };
            
            inputCtrl.input.addEventListener('blur', finishEditing);
            inputCtrl.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') finishEditing();
                if (e.key === 'Escape') {
                    isEditing = false;
                    inputCtrl.setValue(row.name || '');
                    lbl.style.display = 'block';
                    inputCtrl.element.style.display = 'none';
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

        _renderProxyCell(row) {
            const el = document.createElement('span');
            el.style.cssText = 'color:var(--text-primary);font-size:12px;display:block;width:100%;word-break:break-all;';
            el.textContent = row.proxy || '-';
            return el;
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

        _renderProxyDetailCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;';
            
            // Format: type://host:port OR type://host:port:username OR type://host:port:username:password
            // If username-only (no password): type://host:port:username:
            // If username+password: type://host:port:username:password
            // If no auth: type://host:port
            let proxyStr = '';
            if (row.host && row.port) {
                proxyStr = `${row.proxy_type?.toLowerCase() || 'http'}://${row.host}:${row.port}`;
                if (row.username) {
                    proxyStr += `:${row.username}`;
                    if (row.password) {
                        proxyStr += `:${row.password}`;
                    } else {
                        // Username only, no password - add trailing colon
                        proxyStr += `:`;
                    }
                }
            }
            
            if (!proxyStr) { wrap.textContent = '-'; return wrap; }
            
            const hiddenText = '********';
            const fullText = proxyStr;
            const displayText = fullText;
            
            const panel = document.createElement('div');
            panel.style.cssText = 'flex:1;min-width:0;display:flex;align-items:center;background:var(--bg-surface);border:1px solid var(--border-default);border-radius:6px;padding:4px 8px;cursor:pointer;';
            const te = document.createElement('span');
            te.style.cssText = 'font-size:12px;color:var(--text-primary);width:100%;display:block;word-break:break-all;white-space:normal;';
            te.textContent = hiddenText;
            panel.appendChild(te);
            
            panel.addEventListener('click', (e) => { 
                e.stopPropagation(); 
                this._copyToClipboard(fullText).then(() => { 
                    const orig = te.textContent; 
                    te.textContent = 'Copied'; 
                    te.style.color = 'var(--success)'; 
                    setTimeout(() => { te.textContent = orig; te.style.color = ''; }, 1000); 
                }); 
            });
            
            wrap.appendChild(panel);
            
            let hidden = true;
            const eyeBtn = document.createElement('button');
            DuckControls.Button.create(eyeBtn, { icon: 'visibility', variant: 'secondary', size: 'sm' });
            eyeBtn.style.cssText = 'flex-shrink:0;border-radius:6px;';
            eyeBtn.onclick = (e) => { e.stopPropagation(); hidden = !hidden; te.textContent = hidden ? hiddenText : displayText; eyeBtn.innerHTML = `<span class="material-symbols-outlined duck-btn-icon">${hidden ? 'visibility' : 'visibility_off'}</span>`; };
            wrap.appendChild(eyeBtn);
            return wrap;
        },

        _renderStatusBadge(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;white-space:nowrap;';
            
            // Check if proxy is being checked
            if (row._checking) {
                // Short pill shape (original style)
                const pill = document.createElement('span');
                pill.style.cssText = 'display:inline-block;width:14px;height:6px;border-radius:3px;margin-right:6px;background:var(--info);flex-shrink:0;';
                const txt = document.createElement('span');
                txt.style.cssText = 'font-size:12px;font-weight:500;color:var(--text-primary);';
                txt.textContent = 'Checking';
                wrap.appendChild(pill); wrap.appendChild(txt);
                return wrap;
            }
            
            const st = String(row.status || 'not_checked').toLowerCase();
            let color = 'var(--text-tertiary)';
            let text = 'Not check';
            if (!st || st === 'not_checked' || st === 'not check') { }
            else if (st === 'alive') { color = 'var(--success)'; text = 'Alive'; }
            else if (st === 'dead') { color = 'var(--danger)'; text = 'Dead'; }
            else if (st === 'timeout') { color = 'var(--warning)'; text = 'Timeout'; }
            else { color = 'var(--danger)'; text = 'Error'; }
            
            // Short pill dot (original style)
            const pill = document.createElement('span');
            pill.style.cssText = `display:inline-block;width:14px;height:6px;border-radius:3px;margin-right:6px;background:${color};flex-shrink:0;`;
            const txt = document.createElement('span');
            txt.style.cssText = 'font-size:12px;font-weight:500;color:var(--text-primary);';
            txt.textContent = text;
            wrap.appendChild(pill); wrap.appendChild(txt);
            
            if (row.latencyMs) {
                const latency = document.createElement('span');
                latency.style.cssText = 'font-size:11px;color:var(--text-tertiary);margin-left:4px;';
                latency.textContent = `(${row.latencyMs}ms)`;
                wrap.appendChild(latency);
            }
            
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
                cp.onclick = async (e) => { 
                    e.stopPropagation(); 
                    await this._copyToClipboard(msg); 
                    cp.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;color:var(--success);">check</span>';
                    setTimeout(() => cp.innerHTML = '<span class="material-symbols-outlined" style="font-size:13px;">content_copy</span>', 1000);
                };
                wrap.appendChild(cp);
            }
            const lbl = document.createElement('span');
            lbl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;color:var(--text-tertiary);font-size:12px;';
            lbl.textContent = this._escapeHtml(msg || '-');
            wrap.appendChild(lbl);
            return wrap;
        },

        _renderNoteCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;display:flex;align-items:center;position:relative;';

            const lbl = document.createElement('span');
            lbl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;color:var(--text-secondary);font-size:12px;cursor:text;display:block;';
            lbl.textContent = row.note || '-';

            const inputCtrl = window.DuckControls.Input.create({
                icon: 'edit_note',
                placeholder: 'Enter note...',
                value: row.note || ''
            });
            inputCtrl.element.style.display = 'none';
            inputCtrl.element.style.flex = '1';

            lbl.addEventListener('click', () => {
                lbl.style.display = 'none';
                inputCtrl.element.style.display = 'flex';
                inputCtrl.input.focus();
                inputCtrl.input.select();
            });

            const saveNote = async () => {
                inputCtrl.element.style.display = 'none';
                lbl.style.display = 'block';
                const newVal = inputCtrl.getValue();
                
                if (newVal !== (row.note || '')) {
                    const oldNote = row.note;
                    try {
                        await DuckBridge.call('proxy.updateNotes', { id: row.id, notes: newVal });
                        row.note = newVal;
                        lbl.textContent = newVal || '-';
                    } catch (e) {
                        // Revert on error
                        row.note = oldNote;
                        lbl.textContent = oldNote || '-';
                        window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to update note');
                    }
                }
            };

            inputCtrl.input.addEventListener('blur', saveNote);
            inputCtrl.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveNote(); }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    inputCtrl.setValue(row.note || '');
                    inputCtrl.element.style.display = 'none';
                    lbl.style.display = 'block';
                }
            });

            wrap.appendChild(lbl);
            wrap.appendChild(inputCtrl.element);
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
            wrap.style.cssText = 'display:flex;align-items:center;gap:4px;justify-content:flex-end;';

            const checkBtn = document.createElement('button');
            checkBtn.style.cssText = 'width:80px;justify-content:center;';
            const checkBtnInstance = DuckControls.Button.create(checkBtn, { 
                icon: 'wifi_tethering', 
                text: 'Check', 
                variant: 'success', 
                size: 'sm',
                onClick: (e, btnInst) => { 
                    e.stopPropagation(); 
                    this._checkProxy(row, btnInst); 
                }
            });
            wrap.appendChild(checkBtn);

            const editBtn = document.createElement('button');
            editBtn.classList.add('duck-btn-icon-only');
            DuckControls.Button.create(editBtn, { icon: 'settings', variant: 'ghost', size: 'sm' });
            editBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.ProxyModals?.CreateProxy) {
                    window.ProxyModals.CreateProxy.show(null, row);
                }
            };
            wrap.appendChild(editBtn);

            const moreBtn = document.createElement('button');
            moreBtn.classList.add('duck-btn-icon-only');
            DuckControls.Button.create(moreBtn, { icon: 'more_vert', variant: 'ghost', size: 'sm' });
            moreBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.DuckControls?.ContextMenu) {
                    window.DuckControls.ContextMenu.create(moreBtn, {
                        items: [
                            { type: 'label', label: 'Proxy Actions' },
                            { label: 'Duplicate', icon: 'content_copy', onClick: () => this._duplicateProxy(row) },
                            'divider',
                            { label: 'Delete Proxy', icon: 'delete', danger: true, onClick: () => this._deleteProxy(row) }
                        ]
                    }).showAt(e.clientX, e.clientY);
                }
            };
            wrap.appendChild(moreBtn);

            return wrap;
        },

        _handleCheckAll(e) {
            if (e.checked) {
                this._proxiesData.forEach(p => this._selectedIds.add(p.id));
            } else {
                this._selectedIds.clear();
            }
            this._table?.setChecked?.(Array.from(this._selectedIds));
            this._updateBulkActions();
        },

        _loadTableData(proxies) { 
            this._table?.renderData(proxies); 
            this._table?.setChecked?.(Array.from(this._selectedIds));
        },
        _updateStats(proxies) { if (this._statEl) this._statEl.textContent = `${proxies.length}`; },

        async _checkProxy(row, checkBtnInstance) {
            try {
                // Mark row as checking (for visual feedback)
                row._checking = true;
                this._table?.renderData(this._proxiesData);
                this._table?.setChecked?.(Array.from(this._selectedIds));
                
                const result = await DuckBridge.call('proxy.check', { id: row.id });
                if (result) {
                    // Update the data - handle both camelCase and PascalCase from backend
                    const rowData = this._proxiesData.find(p => p.id === row.id);
                    if (rowData) {
                        rowData.status = result.Status || result.status || 'not_checked';
                        rowData.message = result.Message || result.message || '';
                        rowData.latencyMs = result.LatencyMs || result.latencyMs || 0;
                    }
                    // Re-render and restore checked state
                    this._table?.renderData(this._proxiesData);
                    this._table?.setChecked?.(Array.from(this._selectedIds));
                }
            } catch (e) {
                window.DuckControls.Toast?.error?.('Check Failed', e?.message || 'Unknown error');
            } finally {
                // Clear checking flag
                row._checking = false;
                this._table?.renderData(this._proxiesData);
                this._table?.setChecked?.(Array.from(this._selectedIds));
            }
        },

        async _bulkCheck() {
            if (this._selectedIds.size === 0) return;
            
            const ids = [...this._selectedIds];
            
            // Mark all as checking
            ids.forEach(id => {
                const row = this._proxiesData.find(p => p.id === id);
                if (row) row._checking = true;
            });
            this._table?.renderData(this._proxiesData);
            this._table?.setChecked?.(Array.from(this._selectedIds));
            
            // Check each proxy sequentially
            for (const id of ids) {
                try {
                    const result = await DuckBridge.call('proxy.check', { id });
                    const rowData = this._proxiesData.find(p => p.id === id);
                    if (rowData && result) {
                        rowData.status = result.Status || result.status || 'not_checked';
                        rowData.message = result.Message || result.message || '';
                        rowData.latencyMs = result.LatencyMs || result.latencyMs || 0;
                    }
                } catch (e) {
                    console.error('Check failed for proxy', id, e);
                }
            }
            
            // Clear checking flags
            ids.forEach(id => {
                const row = this._proxiesData.find(p => p.id === id);
                if (row) row._checking = false;
            });
            this._table?.renderData(this._proxiesData);
            this._table?.setChecked?.(Array.from(this._selectedIds));
        },

        async _bulkCopy() {
            if (this._selectedIds.size === 0) return;

            const ids = [...this._selectedIds];
            try {
                // Format: type://ip:port OR type://ip:port:username OR type://ip:port:username:password
                // If username-only (no password): type://host:port:username:
                // If username+password: type://host:port:username:password
                // If no auth: type://host:port
                const lines = this._proxiesData
                    .filter(p => this._selectedIds.has(p.id))
                    .map(p => {
                        const proxyType = p.proxy_type || 'http';
                        let proxyStr = `${proxyType}://${p.host}:${p.port}`;
                        if (p.username) {
                            proxyStr += `:${p.username}`;
                            if (p.password) {
                                proxyStr += `:${p.password}`;
                            } else {
                                // Username only, no password - add trailing colon
                                proxyStr += `:`;
                            }
                        }
                        return proxyStr;
                    });
                
                await this._copyToClipboard(lines.join('\n'));
            } catch (err) {
                window.DuckControls.Toast?.error?.('Copy Failed', err?.message || 'An error occurred while copying');
            }
        },

        _bulkRename(row) {
            try {
                let proxies = [];
                if (row) {
                    // Called from right-click on a row - use that row
                    proxies = [row];
                } else if (this._selectedIds.size > 0) {
                    // Called from bulk actions - use selected IDs
                    proxies = [...this._selectedIds].map(id => this._proxiesData.find(p => p.id === id)).filter(Boolean);
                }

                if (proxies.length === 0) return;
                if (!window.ProxyModals) throw new Error("ProxyModals not initialized");
                if (!window.ProxyModals.BulkRename) throw new Error("BulkRename module not found");
                window.ProxyModals.BulkRename.show(proxies);
            } catch (err) {
                console.error(err);
            }
        },

        async _bulkDelete() {
            if (this._selectedIds.size === 0) return;
            
            // Use the new DeleteProxies modal
            if (window.ProxyModals?.DeleteProxies) {
                window.ProxyModals.DeleteProxies.show([...this._selectedIds], async (ids) => {
                    try {
                        await DuckBridge.call('proxy.delete', { ids });
                        this._selectedIds.clear();
                        this._table?.setChecked?.([]);
                        this._updateBulkActions();
                        await this.loadProxyGroups();
                        await this.loadProxyTags();
                        await this.loadProxies();
                    } catch(e) {
                        window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to delete proxies');
                    }
                });
            } else {
                // Fallback to confirm if modal not available
                if (!confirm('Delete selected proxies?')) return;
                try {
                    await DuckBridge.call('proxy.delete', { ids: [...this._selectedIds] });
                    this._selectedIds.clear();
                    this._table?.setChecked?.([]);
                    this._updateBulkActions();
                    await this.loadProxyGroups();
                    await this.loadProxyTags();
                    await this.loadProxies();
                } catch(e) {
                    window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to delete proxies');
                }
            }
        },

        async _duplicateProxy(row) {
            try {
                const newProxy = await DuckBridge.call('proxy.duplicate', { id: row.id, name: `${row.name} (Copy)` });
                if (newProxy) {
                    const mappedProxy = {
                        ...newProxy,
                        id: newProxy.Id || newProxy.id || 0,
                        seq: 0,
                        name: newProxy.Name || newProxy.name || 'Unknown',
                        proxy_type: newProxy.Type || newProxy.type || newProxy.proxy_type || 'http',
                        host: newProxy.Host || newProxy.host || '',
                        port: newProxy.Port || newProxy.port || '',
                        username: newProxy.Username || newProxy.username || '',
                        password: newProxy.Password || newProxy.password || '',
                        groupName: newProxy.GroupName || '',
                        tags: newProxy.TagNames || newProxy.tagNames || [],
                        status: newProxy.Status || newProxy.status || 'not_checked',
                        message: newProxy.Message || newProxy.message || '',
                        notes: newProxy.Notes || newProxy.notes || '',
                        createdAt: newProxy.CreatedAt || newProxy.createdAt
                    };
                    
                    // Insert the new proxy right after the original (preserving order)
                    const idx = this._proxiesData.findIndex(p => p.id === row.id);
                    if (idx !== -1) {
                        this._proxiesData.splice(idx + 1, 0, mappedProxy);
                    } else {
                        this._proxiesData.push(mappedProxy);
                    }
                    
                    // Renumber sequences
                    this._proxiesData.forEach((p, i) => p.seq = i + 1);
                    
                    // Reload table and stats
                    if (this._table) {
                        this._table.renderData(this._proxiesData);
                    }
                    this._updateStats?.(this._proxiesData);
                } else {
                    // Fallback: full reload
                    await Promise.all([
                        this.loadProxyGroups?.() || Promise.resolve(),
                        this.loadProxyTags?.() || Promise.resolve(),
                        this.loadProxies?.() || Promise.resolve()
                    ]);
                }
            } catch (e) {
                console.error('Duplicate proxy failed:', e);
                window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to duplicate proxy');
            }
        },

        async _deleteProxy(row) {
            // Use the new DeleteProxies modal
            if (window.ProxyModals?.DeleteProxies) {
                window.ProxyModals.DeleteProxies.show([row.id], async (ids) => {
                    try {
                        await DuckBridge.call('proxy.delete', { ids });
                        await this.loadProxyGroups();
                        await this.loadProxyTags();
                        await this.loadProxies();
                    } catch(e) {
                        window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to delete proxy');
                    }
                });
            } else {
                // Fallback to confirm if modal not available
                if (!confirm('Delete this proxy?')) return;
                try {
                    await DuckBridge.call('proxy.delete', { ids: [row.id] });
                    await this.loadProxyGroups();
                    await this.loadProxyTags();
                    await this.loadProxies();
                } catch(e) {
                    window.DuckControls.Toast?.error?.('Error', e?.message || 'Failed to delete proxy');
                }
            }
        },

        _showRowContextMenu(e, row) {
            e.preventDefault();
            DuckControls.ContextMenu.create(null, {
                items: [
                    { label: 'Copy', icon: 'content_copy', children: [
                        { label: 'Proxy Name', icon: 'badge', onClick: () => { this._copyToClipboard(row.name || ''); } },
                        { label: 'Proxy ID', icon: 'fingerprint', onClick: () => { this._copyToClipboard(String(row.id)); } },
                        { label: 'Proxy Format', icon: 'public', onClick: async () => {
                            try {
                                // Format: type://ip:port or type://ip:port:user or type://ip:port:user:pass
                                const proxyType = row.proxy_type || 'http';
                                let proxyStr = '';
                                if (row.username && row.password) {
                                    proxyStr = `${proxyType}://${row.host}:${row.port}:${row.username}:${row.password}`;
                                } else if (row.username) {
                                    proxyStr = `${proxyType}://${row.host}:${row.port}:${row.username}:`;
                                } else {
                                    proxyStr = `${proxyType}://${row.host}:${row.port}`;
                                }
                                await this._copyToClipboard(proxyStr);
                            } catch { 
                                window.DuckControls.Toast?.error?.('Error', 'Failed to copy proxy');
                            }
                        }},
                        { label: 'Used Profile IDs', icon: 'group', onClick: async () => {
                            try {
                                const res = await DuckBridge.call('proxy.getUsage', { id: row.id });
                                if (res && res.success && res.data) {
                                    const profileIds = res.data.map(p => p.ProfileId || p.profileId || p.id).filter(Boolean);
                                    if (profileIds.length > 0) {
                                        await this._copyToClipboard(profileIds.join(', '));
                                        window.DuckControls.Toast?.success?.('Copied', `${profileIds.length} profile ID(s) copied`);
                                    } else {
                                        window.DuckControls.Toast?.info?.('No Profiles', 'This proxy is not used by any profile');
                                    }
                                } else {
                                    window.DuckControls.Toast?.info?.('No Profiles', 'This proxy is not used by any profile');
                                }
                            } catch { window.DuckControls.Toast?.error?.('Error', 'Failed to get profile IDs'); }
                        }}
                    ]},
                    'divider',
                    { label: 'Check Proxy', icon: 'wifi_tethering', onClick: () => this._checkProxy(row, null) },
                    { label: 'Proxy Usage', icon: 'analytics', onClick: () => window.ProxyModals?.Usage?.show(row.id, row.name) },
                    { label: 'Export Proxies', icon: 'download', onClick: () => { 
                        const ids = this._selectedIds.has(row.id) ? [...this._selectedIds] : [row.id];
                        window.ProxyModals?.ExportProxies?.show(ids); 
                    }},
                    { label: 'Bulk Rename', icon: 'edit_note', onClick: () => this._bulkRename(row) },
                    'divider',
                    { label: 'Delete Select', icon: 'delete', color: 'var(--danger)', danger: true, onClick: () => { 
                        if (!this._selectedIds.has(row.id)) {
                            this._selectedIds.clear();
                            this._selectedIds.add(row.id);
                            this._table?.setChecked?.(Array.from(this._selectedIds));
                            this._updateBulkActions();
                        }
                        this._bulkDelete(); 
                    }}
                ]
            }).showAt(e.clientX, e.clientY);
        }
    };

    window.DuckApp?.registerView('proxies', VIEW);
    window.ProxiesView = VIEW;
})();


