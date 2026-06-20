// Automation View – mock data wired to DuckControls (same pattern as Profiles)
(function () {
    'use strict';

    const VIEW = {
        _initialized: false,
        _selectedIds: new Set(),
        _filters: { search: '', id: '', group: '', tag: '' },
        _automationsData: [],
        _groups: [],
        _tags: [],

        // — Mock Data ————————————————————————————————————————————————————
        _mockAutomations: [
            { id: 1, name: 'Auto Login FB', author: 'Admin', groupName: 'Social', tags: ['Facebook', 'Login'], description: 'Auto login to Facebook accounts', lastOpened: '2026-06-20T10:00:00', enabled: true },
            { id: 2, name: 'Tiktok Uploader', author: 'Admin', groupName: 'Social', tags: ['Tiktok'], description: 'Auto upload videos to TikTok in bulk', lastOpened: '2026-06-19T15:30:00', enabled: false },
            { id: 3, name: 'Google Search Scraper', author: 'User', groupName: 'SEO', tags: ['Google', 'Scrape'], description: 'Scrape keyword data from Google', lastOpened: '2026-06-18T09:15:00', enabled: true }
        ],
        _mockGroups: [{ id: 1, Name: 'Social' }, { id: 2, Name: 'SEO' }],
        _mockTags: [{ id: 1, Name: 'Facebook' }, { id: 2, Name: 'Tiktok' }, { id: 3, Name: 'Google' }, { id: 4, Name: 'Login' }, { id: 5, Name: 'Scrape' }],

        // — View entry ——————————————————————————————————————————————————
        async onShow() {
            if (!this._initialized) {
                this._initialized = true;
                this.initUI();
            }
            await this.loadGroups();
            await this.loadTags();
            await this.loadAutomations();
        },

        // — Data loaders ——————————————————————————————————————————————
        async loadGroups() {
            try {
                const res = await DuckBridge.call('group.list');
                this._groups = Array.isArray(res) ? res : this._mockGroups;
            } catch {
                this._groups = this._mockGroups;
            }
            this._groups.sort((a, b) => (a.Name || a.name || '').localeCompare(b.Name || b.name || ''));
            this._updateGroupSelect();
        },

        async loadTags() {
            try {
                const res = await DuckBridge.call('tag.list');
                this._tags = Array.isArray(res) ? res : this._mockTags;
            } catch {
                this._tags = this._mockTags;
            }
            this._tags.sort((a, b) => (a.Name || a.name || '').localeCompare(b.Name || b.name || ''));
            this._updateTagSelect();
        },

        async loadAutomations() {
            if (this._table && this._table.setLoading) this._table.setLoading(true);
            let items = [];
            try {
                const minTime = new Promise(r => setTimeout(r, 300));
                // Replace with: const [resp] = await Promise.all([DuckBridge.call('automation.list', filters), minTime]);
                await minTime;
                items = [...this._mockAutomations];
            } catch (err) {
                console.warn('[Automation] Bridge unavailable, using mock:', err);
            } finally {
                if (this._table && this._table.setLoading) this._table.setLoading(false);
            }

            // Apply local filters
            if (this._filters.search) {
                const s = this._filters.search.toLowerCase();
                items = items.filter(i => i.name.toLowerCase().includes(s));
            }
            if (this._filters.id) {
                items = items.filter(i => String(i.id) === this._filters.id.trim());
            }
            if (this._filters.group) {
                items = items.filter(i => i.groupName === this._filters.group);
            }
            if (this._filters.tag) {
                const tagIds = this._filters.tag.split(',').filter(Boolean);
                if (tagIds.length) {
                    items = items.filter(i => i.tags && i.tags.some(t => tagIds.includes(String(t))));
                }
            }

            items = items.map((a, idx) => ({ ...a, seq: idx + 1 }));
            this._automationsData = items;

            const currentIds = new Set(items.map(a => a.id));
            for (const id of this._selectedIds) { if (!currentIds.has(id)) this._selectedIds.delete(id); }
            this._updateBulkActions();
            this._loadTableData(items);
            this._updateStats(items);
        },

        // — Select option builders ——————————————————————————————————————
        _buildGroupOptions() {
            return [
                { label: 'All Groups', value: '' },
                ...this._groups.map(g => ({
                    label: g.Name || g.name || '',
                    value: g.Name || g.name || '',
                    actions: [{ icon: 'edit', onClick: () => {} }]
                }))
            ];
        },

        _buildTagOptions() {
            return this._tags.map(t => ({
                label: t.Name || t.name || '',
                value: String(t.Id ?? t.id)
            }));
        },

        _updateGroupSelect() { if (this._groupCtrl) this._groupCtrl.setOptions(this._buildGroupOptions()); },
        _updateTagSelect()   { if (this._tagCtrl) this._tagCtrl.setOptions(this._buildTagOptions()); },

        // — Init UI —————————————————————————————————————————————————————
        initUI() {
            // Refresh button
            const refreshEl = document.getElementById('auto-ctrl-refresh');
            if (refreshEl) {
                DuckControls.Button.create(refreshEl, {
                    variant: 'surface', icon: 'refresh',
                    onClick: () => Promise.all([this.loadGroups(), this.loadTags(), this.loadAutomations()])
                });
            }

            // Create Workflow button
            const createEl = document.getElementById('auto-ctrl-create');
            if (createEl) {
                DuckControls.Button.create(createEl, {
                    variant: 'primary', icon: 'add', text: 'Create Workflow',
                    onClick: () => window.DuckControls?.Toast?.info('Open workflow builder')
                });
            }

            this._initSearchControls();
            this._initSelectControls();
            this._initBulkActionsUI();
            this._buildTable();
        },

        _initSearchControls() {
            const searchContainer = document.getElementById('auto-ctrl-search');
            if (searchContainer) {
                this._searchCtrl = DuckControls.Input.create({
                    label: 'SEARCH', placeholder: 'Search workflow...', icon: 'search',
                    width: '200px', bgVariant: 'subtle',
                    onInput: (e) => { this._filters.search = e.target.value; this.loadAutomations(); }
                });
                searchContainer.appendChild(this._searchCtrl.element);
            }

            const idContainer = document.getElementById('auto-ctrl-id');
            if (idContainer) {
                this._idCtrl = DuckControls.Input.create({
                    label: 'ID', placeholder: 'Workflow ID', icon: 'tag',
                    width: '140px', bgVariant: 'subtle',
                    onInput: (e) => { this._filters.id = e.target.value; this.loadAutomations(); }
                });
                idContainer.appendChild(this._idCtrl.element);
            }
        },

        _initSelectControls() {
            // Group Select
            const groupContainer = document.getElementById('auto-ctrl-group');
            if (groupContainer) {
                this._groupCtrl = DuckControls.Select.create({
                    label: 'GROUP', placeholder: 'All Groups', width: '180px', bgVariant: 'subtle',
                    actions: [
                        { text: 'Delete', icon: 'delete', color: 'var(--danger)', onClick: () => {} },
                        { text: '+ Create', icon: 'add', onClick: () => {} }
                    ],
                    options: this._buildGroupOptions(),
                    onChange: (e) => { this._filters.group = e.target.value; this.loadAutomations(); }
                });
                groupContainer.appendChild(this._groupCtrl.element);
            }

            // Tag MultiSelect
            const tagContainer = document.getElementById('auto-ctrl-tag');
            if (tagContainer) {
                this._tagCtrl = DuckControls.MultiSelectComboBox.create({
                    label: 'TAG', placeholder: 'All Tags', width: '180px', bgVariant: 'subtle',
                    actions: [
                        { text: 'Delete', icon: 'delete', color: 'var(--danger)', onClick: () => {} },
                        { text: '+ Create', icon: 'add', onClick: () => {} }
                    ],
                    options: this._buildTagOptions(),
                    onChange: (selectedValues) => { this._filters.tag = selectedValues.join(','); this.loadAutomations(); }
                });
                tagContainer.appendChild(this._tagCtrl.element);
            }

            // Total stat
            const statContainer = document.getElementById('auto-ctrl-stat');
            if (statContainer) {
                const wrap = document.createElement('div');
                wrap.className = 'filter-stacked';
                const head = document.createElement('div');
                head.className = 'filter-stacked-head';
                const lbl = document.createElement('span');
                lbl.className = 'ui-label-sm';
                lbl.textContent = 'TOTAL AUTOMATIONS';
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

        _initBulkActionsUI() {
            this._bulkBar   = document.getElementById('auto-bulk-actions');
            this._bulkCount = document.getElementById('auto-bulk-count');
            if (this._bulkBar) { this._bulkBar.style.display = 'none'; }

            const mk = (id, text, icon, variant, onClick) => {
                const el = document.getElementById(id);
                if (el) DuckControls.Button.create(el, { text, icon, variant, onClick });
            };

            mk('auto-ctrl-bulk-import', 'Import Workflow', 'download', 'surface', () => window.DuckControls?.Toast?.info('Import Workflow'));
            mk('auto-ctrl-bulk-export', 'Export Workflow', 'upload',   'surface', () => window.DuckControls?.Toast?.info('Export Workflow'));
            mk('auto-ctrl-bulk-copy',   'Copy Workflow ID','content_copy','surface', () => window.DuckControls?.Toast?.info('Copy Workflow ID'));
            mk('auto-ctrl-bulk-delete', 'Delete selected', 'delete',  'danger',  () => window.DuckControls?.Toast?.info('Delete selected'));

            const closeEl = document.getElementById('auto-ctrl-bulk-close');
            if (closeEl) {
                DuckControls.Button.create(closeEl, {
                    variant: 'surface', icon: 'close',
                    onClick: () => {
                        this._selectedIds.clear();
                        this._table?.setChecked?.([]);
                        this._updateBulkActions();
                    }
                });
            }
        },

        _updateBulkActions() {
            this._selectedIds.delete(undefined);
            this._selectedIds.delete(null);
            const has = this._selectedIds.size > 0;
            if (this._bulkBar) {
                if (has) { this._bulkBar.classList.add('visible'); this._bulkBar.style.display = 'flex'; }
                else     { this._bulkBar.classList.remove('visible'); this._bulkBar.style.display = 'none'; }
            }
            if (this._bulkCount) this._bulkCount.textContent = `${this._selectedIds.size} selected`;
        },

        // — Cell Renderers ——————————————————————————————————————————————
        _escapeHtml(str) {
            return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        },

        _formatDate(value) {
            if (!value) return '-';
            try {
                const d = new Date(value);
                if (isNaN(d)) return String(value);
                return d.toLocaleString('sv-SE').replace('T', ' ');
            } catch { return String(value); }
        },

        _renderNameCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;display:flex;align-items:center;';

            const lbl = document.createElement('span');
            lbl.style.cssText = 'font-weight:500;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text;display:block;flex:1;';
            lbl.textContent = (row.name && row.name.trim()) ? this._escapeHtml(row.name) : '-';

            const inputCtrl = DuckControls.Input.create({ icon: 'edit', placeholder: 'Enter name...', value: row.name || '' });
            inputCtrl.element.style.display = 'none';
            inputCtrl.element.style.flex = '1';

            lbl.addEventListener('click', () => {
                lbl.style.display = 'none';
                inputCtrl.element.style.display = 'flex';
                inputCtrl.input.focus();
                inputCtrl.input.select();
            });

            const done = () => {
                inputCtrl.element.style.display = 'none';
                lbl.style.display = 'block';
                const newName = inputCtrl.getValue().trim();

                if (!newName) {
                    inputCtrl.setValue(row.name || '');
                    window.DuckControls.Toast?.error?.('Error', 'Name cannot be empty');
                    return;
                }

                if (newName !== row.name) {
                    row.name = newName;
                    lbl.textContent = this._escapeHtml(row.name || '-');
                    // TODO: DuckBridge.call('automation.update', { id: row.id, name: newName });
                    window.DuckControls?.Toast?.success?.('Name updated');
                }
            };

            inputCtrl.input.addEventListener('blur', done);
            inputCtrl.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') done();
                if (e.key === 'Escape') { inputCtrl.setValue(row.name || ''); done(); }
            });

            wrap.appendChild(lbl);
            wrap.appendChild(inputCtrl.element);
            wrap.addEventListener('click', (e) => e.stopPropagation());
            return wrap;
        },

        _renderAuthorCell(row) {
            const el = document.createElement('span');
            el.style.cssText = 'color:var(--text-primary);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;width:100%;';
            el.textContent = row.author || '-';
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
            if (!tags.length) {
                const e = document.createElement('span');
                e.style.cssText = 'color:var(--text-primary);font-size:12px;';
                e.textContent = '-';
                wrap.appendChild(e);
                return wrap;
            }
            tags.slice(0, 3).forEach(t => {
                const e = document.createElement('span');
                DuckControls.Badge.create(e, { text: this._escapeHtml(String(t)) });
                e.classList.add('duck-badge-info');
                wrap.appendChild(e);
            });
            if (tags.length > 3) {
                const e = document.createElement('span');
                e.style.cssText = 'color:var(--text-tertiary);font-weight:700;font-size:12px;';
                e.textContent = '...';
                wrap.appendChild(e);
            }
            return wrap;
        },

        _renderDescCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;display:flex;align-items:center;position:relative;';

            const lbl = document.createElement('span');
            lbl.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;color:var(--text-secondary);font-size:12px;cursor:text;display:block;';
            lbl.textContent = row.description || '-';

            const inputCtrl = DuckControls.Input.create({ icon: 'edit_note', placeholder: 'Enter description...', value: row.description || '' });
            inputCtrl.element.style.display = 'none';
            inputCtrl.element.style.flex = '1';

            lbl.addEventListener('click', () => {
                lbl.style.display = 'none';
                inputCtrl.element.style.display = 'flex';
                inputCtrl.input.focus();
                inputCtrl.input.select();
            });

            const done = () => {
                inputCtrl.element.style.display = 'none';
                lbl.style.display = 'block';
                const newVal = inputCtrl.getValue();
                if (newVal !== row.description) {
                    row.description = newVal;
                    lbl.textContent = newVal || '-';
                    // TODO: DuckBridge.call('automation.update', { id: row.id, description: newVal });
                    window.DuckControls?.Toast?.success?.('Description updated');
                }
            };

            inputCtrl.input.addEventListener('blur', done);
            inputCtrl.input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') done();
                if (e.key === 'Escape') { inputCtrl.setValue(row.description || ''); done(); }
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
            wrap.style.cssText = 'display:flex;align-items:center;gap:2px;justify-content:flex-end;';
            const mk = (el, cfg) => DuckControls.Button.create(el, cfg);

            // Enable / Disable switch-style toggle button
            const toggleBtn = document.createElement('button');
            mk(toggleBtn, {
                icon: row.enabled ? 'toggle_on' : 'toggle_off',
                text: row.enabled ? 'On' : 'Off',
                variant: row.enabled ? 'success' : 'surface',
                size: 'sm'
            });
            toggleBtn.style.cssText = 'width:62px;justify-content:center;';
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                row.enabled = !row.enabled;
                // Re-render this cell by reloading row
                mk(toggleBtn, {
                    icon: row.enabled ? 'toggle_on' : 'toggle_off',
                    text: row.enabled ? 'On' : 'Off',
                    variant: row.enabled ? 'success' : 'surface',
                    size: 'sm'
                });
                // TODO: DuckBridge.call('automation.toggle', { id: row.id, enabled: row.enabled });
                window.DuckControls?.Toast?.success?.(row.enabled ? 'Workflow enabled' : 'Workflow disabled');
            };

            // Copy Workflow button
            const copyBtn = document.createElement('button');
            mk(copyBtn, { icon: 'content_copy', variant: 'ghost', size: 'sm' });
            copyBtn.classList.add('duck-btn-icon-only');
            copyBtn.title = 'Copy Workflow';
            copyBtn.onclick = (e) => { e.stopPropagation(); this._onCopy(row.id); };

            // 3-dots more button
            const moreBtn = document.createElement('button');
            mk(moreBtn, { icon: 'more_vert', variant: 'ghost', size: 'sm' });
            moreBtn.classList.add('duck-btn-icon-only');
            moreBtn.onclick = (e) => e.stopPropagation();

            if (window.DuckControls?.ContextMenu) {
                DuckControls.ContextMenu.create(moreBtn, {
                    items: [
                        { label: 'Pin Workflow',      icon: 'push_pin',     onClick: () => window.DuckControls?.Toast?.info('Pin: ' + row.id) },
                        { label: 'Duplicate',         icon: 'content_copy', onClick: () => window.DuckControls?.Toast?.info('Duplicate: ' + row.id) },
                        { label: 'Export',            icon: 'upload',       onClick: () => window.DuckControls?.Toast?.info('Export: ' + row.id) },
                        'divider',
                        { label: 'Delete Workflow',   icon: 'delete', danger: true, onClick: () => window.DuckControls?.Toast?.info('Delete: ' + row.id) }
                    ]
                });
            }

            wrap.appendChild(toggleBtn);
            wrap.appendChild(copyBtn);
            wrap.appendChild(moreBtn);
            return wrap;
        },

        // — Table ——————————————————————————————————————————————————————
        _buildTable() {
            const container = document.querySelector('#automations-table-view .table-card');
            if (!container) return;
            container.innerHTML = '';

            const cols = [
                { id: 'select', type: 'checkbox', title: 'Select all', locked: true, lockedPosition: 'left', resizable: false, width: '52px',
                  onCheckAll: (e) => { e.checked ? this._automationsData.forEach(a => this._selectedIds.add(a.id)) : this._selectedIds.clear(); this._table?.setChecked?.(Array.from(this._selectedIds)); this._updateBulkActions(); } },
                { id: 'seq',         label: '#',           width: '40px',  minWidth: '40px',  locked: true, lockedPosition: 'left', resizable: false, align: 'center',
                  render: (r) => { const el = document.createElement('span'); el.textContent = r.seq; return el; } },
                { id: 'name',        label: 'NAME',        width: '240px', minWidth: '120px', locked: true, lockedPosition: 'left', resizable: true,  render: (r) => this._renderNameCell(r) },
                { id: 'author',      label: 'AUTHOR',      width: '160px', minWidth: '120px',                                       render: (r) => this._renderAuthorCell(r) },
                { id: 'groupName',   label: 'GROUP',       width: '160px', minWidth: '160px', maxWidth: '240px',                    render: (r) => this._renderGroupCell(r) },
                { id: 'tags',        label: 'TAGS',        width: '160px', minWidth: '160px', maxWidth: '240px',                    render: (r) => this._renderTagsCell(r) },
                { id: 'description', label: 'DESCRIPTION', width: '240px', minWidth: '240px', maxWidth: '320px',                    render: (r) => this._renderDescCell(r) },
                { id: 'lastopened',  label: 'LAST OPENED', width: '200px', minWidth: '200px', resizable: false,                     render: (r) => this._renderDateCell(r.lastOpened) },
                { id: 'filler', fillSpace: true },
                { id: 'action',      label: 'CONTROL',     width: '170px', locked: true, lockedPosition: 'right', resizable: false, render: (r) => this._renderActionCell(r) }
            ];

            this._table = DuckControls.Table.create({
                container, id: 'duck-table-automations', emptyText: 'No workflows found', fillSpace: true,
                onCheckRow: (e, row) => { e.checked ? this._selectedIds.add(row.id) : this._selectedIds.delete(row.id); this._updateBulkActions(); },
                onRowContextMenu: (e, row) => this._showRowContextMenu(e, row),
                columns: cols
            });
            container.style.cssText = 'flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;';
            if (this._table.element) container.appendChild(this._table.element);
        },

        _loadTableData(items) {
            if (!this._table) return;
            if (this._table.renderData) {
                this._table.renderData(items);
                this._table.setChecked?.(Array.from(this._selectedIds));
            } else if (this._table.setData) {
                this._table.setData(items);
            }
        },

        _updateStats(items) { if (this._statEl) this._statEl.textContent = `${items.length}`; },

        // — Row / Bulk Actions ——————————————————————————————————————————
        _onCopy(id) {
            window.DuckControls?.Toast?.success?.('Workflow copied to clipboard');
        },

        _showRowContextMenu(e, row) {
            e.preventDefault();
            DuckControls.ContextMenu.create(null, {
                items: [
                    { label: 'Pin Workflow',    icon: 'push_pin',     onClick: () => window.DuckControls?.Toast?.info('Pin: ' + row.id) },
                    { label: 'Duplicate',       icon: 'content_copy', onClick: () => window.DuckControls?.Toast?.info('Duplicate: ' + row.id) },
                    { label: 'Export',          icon: 'upload',       onClick: () => window.DuckControls?.Toast?.info('Export: ' + row.id) },
                    'divider',
                    { label: 'Delete Workflow', icon: 'delete', danger: true, onClick: () => window.DuckControls?.Toast?.info('Delete: ' + row.id) }
                ]
            });
        }
    };

    if (window.DuckApp && typeof window.DuckApp.registerView === 'function') {
        window.DuckApp.registerView('automation', VIEW);
    }
    window.AutomationView = VIEW;
})();
