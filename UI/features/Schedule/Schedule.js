(function () {
    'use strict';

    const VIEW = {
        _initialized: false,
        _selectedIds: new Set(),
        _filters: { search: '', group: '', tag: '', status: '', automation: '' },
        _schedulesData: [],
        _scheduleGroups: [],
        _scheduleTags: [],
        _automations: [],
        _visibleCols: new Set(['seq', 'name', 'type', 'group', 'tags', 'time', 'next', 'status', 'message', 'note', 'created', 'action']),

        // ── View entry ──────────────────────────────────────────────
        async onShow() {
            if (!this._initialized) {
                this._initialized = true;
                this._loadColPreferences();
                this.initUI();
            }
            await this.loadAutomations();
            await this.loadSchedules();
        },

        _loadColPreferences() {
            try {
                const saved = localStorage.getItem('sched_visible_cols');
                if (saved) {
                    const parsed = JSON.parse(saved);
                    this._visibleCols = new Set(parsed);
                }
            } catch (e) { console.error('[Schedule] Load cols failed:', e); }
        },

        _customizeColumns() {
            if (window.ProxyModals?.CustomizeColumn) {
                const schedCols = [
                    { id: 'group', label: 'GROUP' },
                    { id: 'tags', label: 'TAGS' },
                    { id: 'time', label: 'TIME' },
                    { id: 'next', label: 'NEXT RUN' },
                    { id: 'note', label: 'NOTE' },
                    { id: 'created', label: 'CREATED TIME' }
                ];
                window.ProxyModals.CustomizeColumn.show(this._visibleCols, () => {
                    this._table.updateColumnVisibility(this._visibleCols);
                }, schedCols, 'sched_visible_cols');
            }
        },

        // ── Data loaders ────────────────────────────────────────────
        async loadAutomations() {
            try {
                const res = await DuckBridge.call('automation.list');
                this._automations = (res?.Items || res || []);
                this._automations.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                this._updateAutoSelect();
            } catch (e) {
                console.warn('[Schedule] automation.list not available, using mock data');
                this._automations = [
                    { Id: 1, Name: 'Auto Like Facebook' },
                    { Id: 2, Name: 'Shopee Checkout' },
                    { Id: 3, Name: 'Daily Login Bonus' }
                ];
                this._updateAutoSelect();
            }
        },

        async loadSchedules() {
            if (this._table && this._table.setLoading) this._table.setLoading(true);
            let items = [];
            try {
                const filters = {};
                if (this._filters.search)    filters.search      = this._filters.search;
                if (this._filters.automation) filters.automationId = parseInt(this._filters.automation);

                const minTime = new Promise(r => setTimeout(r, 300));
                const [resp]  = await Promise.all([DuckBridge.call('schedule.list', filters), minTime]);
                items = resp?.Items || resp || [];
            } catch (err) {
                console.warn('[Schedule] schedule.list not available, using mock data');
                // Generate some mock data
                items = Array.from({ length: 5 }).map((_, i) => ({
                    id: i + 1, name: `Task ${i + 1}`, freqType: ['immediate', 'once', 'interval', 'daily'][i % 4],
                    groupName: 'Group ' + (i % 2 + 1), tags: ['TagA', 'TagB'].slice(0, (i % 3)),
                    timeConfig: '10:00 AM', nextRun: new Date().toISOString(), status: ['running', 'idle', 'paused', 'error'][i % 4],
                    message: 'All good', note: '', automationId: 1, createdAt: new Date().toISOString()
                }));
            } finally {
                if (this._table && this._table.setLoading) this._table.setLoading(false);
            }

            items = items.map((s, idx) => ({
                ...s,
                id:          s.Id         || s.id         || 0,
                seq:         idx + 1,
                name:        s.Name       || s.name       || 'Untitled',
                freqType:    s.FreqType   || s.freqType   || 'immediate',
                timeConfig:  s.TimeConfig || s.timeConfig || '',
                nextRun:     s.NextRun    || s.nextRun    || null,
                status:      s.Status     || s.status     || 'idle',
                message:     s.Message   || s.message    || '-',
                note:        s.Note       || s.note       || '',
                profileIds:  s.ProfileIds || s.profileIds || [],
                threads:     s.Threads    || s.threads    || 1,
                arrangeMode: s.ArrangeMode|| s.arrangeMode|| 'auto',
                chromeArgs:  s.ChromeArgs || s.chromeArgs || '',
                openDelayMs: s.OpenDelayMs|| s.openDelayMs|| 1500,
                repeatCount: s.RepeatCount|| s.repeatCount|| 1,
            }));

            this._schedulesData = items;
            const currentIds = new Set(items.map(s => s.id));
            for (const id of this._selectedIds) { if (!currentIds.has(id)) this._selectedIds.delete(id); }
            this._updateBulkActions();
            if (this._table) this._table.renderData(items);
            this._updateStats(items);
        },

        // ── Select builders ─────────────────────────────────────────
        _buildAutoOptions() {
            return [
                { label: 'All Automations', value: '' },
                ...this._automations.map(a => ({
                    label: a.Name || a.name || '',
                    value: String(a.Id || a.id),
                })),
            ];
        },
        _updateAutoSelect() {
            if (this._autoCtrl) this._autoCtrl.setOptions(this._buildAutoOptions());
        },

        // ── UI init ─────────────────────────────────────────────────
        initUI() {
            // Refresh
            const refreshEl = document.getElementById('sched-ctrl-refresh');
            if (refreshEl) {
                this._refreshBtn = DuckControls.Button.create(refreshEl, {
                    variant: 'surface', icon: 'refresh',
                    onClick: () => Promise.all([this.loadAutomations(), this.loadSchedules()]),
                });
            }

            // Columns
            const colsEl = document.getElementById('sched-ctrl-cols');
            if (colsEl) {
                this._colsBtn = DuckControls.Button.create(colsEl, {
                    variant: 'surface', icon: 'view_column',
                    onClick: () => this._customizeColumns()
                });
            }

            // Create Task
            const createEl = document.getElementById('sched-ctrl-create');
            if (createEl) {
                DuckControls.Button.create(createEl, {
                    variant: 'primary', icon: 'add', text: 'Create Task',
                    onClick: () => window.ScheduleModals?.CreateTask?.show(async (payload) => {
                        await DuckBridge.call('schedule.create', payload);
                        await this.loadSchedules();
                        DuckControls.Toast?.success?.('Success', 'Task created');
                    }),
                });
            }

            this._initSearchControls();
            this._initActionChips();
            this._initBulkActions();
            this._buildTable();
        },

        _initSearchControls() {
            // Search name
            const searchEl = document.getElementById('sched-ctrl-search');
            if (searchEl) {
                this._searchCtrl = DuckControls.Input.create({
                    label: 'SEARCH', placeholder: 'Search by task name...', icon: 'search',
                    width: '200px', bgVariant: 'subtle',
                    onInput: (e) => { this._filters.search = e.target.value; this.loadSchedules(); },
                });
                searchEl.appendChild(this._searchCtrl.element);
            }

            // Group
            const groupEl = document.getElementById('sched-ctrl-group');
            if (groupEl) {
                this._groupCtrl = DuckControls.Select.create({
                    label: 'GROUP', placeholder: 'All', width: '180px', bgVariant: 'subtle',
                    actions: [
                        { text: 'Delete', icon: 'delete', color: 'var(--danger)', onClick: () => this._deleteGroup() },
                        { text: '+ Create', icon: 'add', onClick: () => this._createGroup() }
                    ],
                    options: this._buildGroupOptions(),
                    onChange: (e) => { this._filters.group = e.target.value; this.loadSchedules(); }
                });
                groupEl.appendChild(this._groupCtrl.element);
            }

            // Tag
            const tagEl = document.getElementById('sched-ctrl-tag');
            if (tagEl) {
                this._tagCtrl = DuckControls.MultiSelectComboBox.create({
                    label: 'TAGS', placeholder: 'All', width: '180px', bgVariant: 'subtle',
                    actions: [
                        { text: 'Delete', icon: 'delete', color: 'var(--danger)', onClick: () => this._deleteTag() },
                        { text: '+ Create', icon: 'add', onClick: () => this._createTag() }
                    ],
                    options: this._buildTagOptions(),
                    onChange: (selectedValues) => { this._filters.tag = selectedValues.join(','); this.loadSchedules(); }
                });
                tagEl.appendChild(this._tagCtrl.element);
            }

            // Status
            const statusEl = document.getElementById('sched-ctrl-status');
            if (statusEl) {
                this._statusCtrl = DuckControls.Select.create({
                    label: 'STATUS', placeholder: 'All', width: '150px', bgVariant: 'subtle',
                    options: [
                        {label:'All', value:''},
                        {label:'Ready', value:'ready'},
                        {label:'Running', value:'running'},
                        {label:'Stopped', value:'stopped'},
                        {label:'Finished', value:'finished'}
                    ],
                    onChange: (e) => { this._filters.status = e.target.value; this.loadSchedules(); }
                });
                statusEl.appendChild(this._statusCtrl.element);
            }

            // Type combobox
            const typeEl = document.getElementById('sched-ctrl-type');
            if (typeEl) {
                this._typeFilterCtrl = DuckControls.MultiSelectComboBox.create({
                    label: 'TYPE', placeholder: 'All', width: '180px', bgVariant: 'subtle',
                    hasCheckbox: true,
                    options: [
                        {label:'Immediate', value:'immediate'},
                        {label:'Once', value:'once'},
                        {label:'Interval', value:'interval'},
                        {label:'Daily', value:'daily'}
                    ],
                    onChange: (selectedValues) => { this._filters.type = selectedValues.join(','); this.loadSchedules(); }
                });
                typeEl.appendChild(this._typeFilterCtrl.element);
            }

            // Automation combobox
            const autoEl = document.getElementById('sched-ctrl-auto');
            if (autoEl) {
                this._autoCtrl = DuckControls.MultiSelectComboBox.create({
                    label: 'AUTOMATION', placeholder: 'All', width: '180px', bgVariant: 'subtle',
                    hasCheckbox: true,
                    options: [],
                    onChange: (selectedValues) => { this._filters.automation = selectedValues.join(','); this.loadSchedules(); }
                });
                autoEl.appendChild(this._autoCtrl.element);
            }

            // Stat badge
            const statEl = document.getElementById('sched-ctrl-stat');
            if (statEl) {
                const wrap = document.createElement('div');
                wrap.className = 'filter-stacked';
                const head = document.createElement('div');
                head.className = 'filter-stacked-head';
                const lbl = document.createElement('span');
                lbl.className = 'ui-label-sm';
                lbl.textContent = 'TOTAL SCHEDULES';
                head.appendChild(lbl);
                wrap.appendChild(head);
                this._statEl = document.createElement('div');
                this._statEl.className = 'input-field-sm bg-subtle';
                this._statEl.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;min-width:80px;';
                this._statEl.textContent = '0';
                wrap.appendChild(this._statEl);
                statEl.appendChild(wrap);
            }
        },

        // 🟢 Group & Tag CRUD 🟢
        _buildGroupOptions() {
            return [
                { label: 'All', value: '' },
                ...this._scheduleGroups.map(g => ({
                    label: g.name || '',
                    value: String(g.id),
                    actions: [{ icon: 'edit', onClick: () => this._editGroup(g) }]
                }))
            ];
        },
        _buildTagOptions() {
            return [
                ...this._scheduleTags.map(t => ({
                    label: t.name || '',
                    value: String(t.id),
                    actions: [{ icon: 'edit', onClick: () => this._editTag(t) }]
                }))
            ];
        },
        _updateGroupSelect() { if (this._groupCtrl) this._groupCtrl.setOptions(this._buildGroupOptions()); },
        _updateTagSelect() { if (this._tagCtrl) this._tagCtrl.setOptions(this._buildTagOptions()); },

        _buildGroupDeleteItems() { return this._scheduleGroups.map(g => ({ label: g.name || '', value: String(g.id) })); },
        _buildTagDeleteItems() { return this._scheduleTags.map(t => ({ label: t.name || '', value: String(t.id) })); },

        async _createGroup() {
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('schedulegroup', async (name) => {
                try {
                    const result = await DuckBridge.call('schedulegroup.create', { name });
                    this._scheduleGroups.push(result);
                } catch (e) {
                    this._scheduleGroups.push({ id: Date.now(), name });
                }
                this._scheduleGroups.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                this._updateGroupSelect();
            });
        },
        async _editGroup(g) {
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('schedulegroup', async (newName) => {
                try {
                    await DuckBridge.call('schedulegroup.update', { id: g.id, name: newName });
                    g.name = newName;
                } catch (e) { g.name = newName; }
                this._scheduleGroups.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                this._updateGroupSelect();
            }, g.name);
        },
        async _deleteGroup() {
            const items = this._buildGroupDeleteItems();
            if (items.length === 0) return;
            if (!window.ProxyModals?.DeleteEntity) return;
            window.ProxyModals.DeleteEntity.show('schedulegroup', items, async (selectedValues, deleteMode) => {
                try {
                    for (const val of selectedValues) await DuckBridge.call('schedulegroup.delete', { id: parseInt(val) });
                } catch (e) {}
                this._scheduleGroups = this._scheduleGroups.filter(g => !selectedValues.includes(String(g.id)));
                this._updateGroupSelect();
            });
        },

        async _createTag() {
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('scheduletag', async (name) => {
                try {
                    const result = await DuckBridge.call('scheduletag.create', { name });
                    this._scheduleTags.push(result);
                } catch (e) {
                    this._scheduleTags.push({ id: Date.now(), name });
                }
                this._scheduleTags.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                this._updateTagSelect();
            });
        },
        async _editTag(t) {
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('scheduletag', async (newName) => {
                try {
                    await DuckBridge.call('scheduletag.update', { id: t.id, name: newName });
                    t.name = newName;
                } catch (e) { t.name = newName; }
                this._scheduleTags.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                this._updateTagSelect();
            }, t.name);
        },
        async _deleteTag() {
            const items = this._buildTagDeleteItems();
            if (items.length === 0) return;
            if (!window.ProxyModals?.DeleteEntity) return;
            window.ProxyModals.DeleteEntity.show('scheduletag', items, async (selectedValues, deleteMode) => {
                try {
                    for (const val of selectedValues) await DuckBridge.call('scheduletag.delete', { id: parseInt(val) });
                } catch (e) {}
                this._scheduleTags = this._scheduleTags.filter(t => !selectedValues.includes(String(t.id)));
                this._updateTagSelect();
            });
        },

        _initActionChips() {
            const chipsEl = document.getElementById('sched-ctrl-chips');
            if (!chipsEl) return;

            const tasksBtn = document.createElement('button');
            chipsEl.appendChild(tasksBtn);
            DuckControls.Button.create(tasksBtn, { variant: 'chip', icon: 'pending_actions', text: 'Tasks Actions', dropdownArrow: true, onClick: () => {} });
            DuckControls.ContextMenu.create(tasksBtn, {
                items: [
                    { label: 'Run Selected',    icon: 'play_arrow', onClick: () => { if (this._selectedIds.size > 0) this._bulkRun(); }   },
                    { label: 'Pause Selected',  icon: 'pause',      onClick: () => { if (this._selectedIds.size > 0) this._bulkPause(); } },
                    'divider',
                    { label: 'Delete Selected', icon: 'delete', color: 'var(--danger)', danger: true, onClick: () => { if (this._selectedIds.size > 0) this._bulkDelete(); } },
                ],
            });
        },

        _initBulkActions() {
            const mkBtn = (id, cfg) => { const el = document.getElementById(id); if (el) DuckControls.Button.create(el, cfg); };
            mkBtn('sched-ctrl-bulk-run',    { variant: 'secondary', size: 'sm', icon: 'play_arrow', text: 'Run Tasks',   onClick: () => this._bulkRun()    });
            mkBtn('sched-ctrl-bulk-pause',  { variant: 'secondary', size: 'sm', icon: 'pause',      text: 'Pause Tasks', onClick: () => this._bulkPause()  });
            mkBtn('sched-ctrl-bulk-delete', { variant: 'danger',    size: 'sm', icon: 'delete',     text: 'Delete Tasks', onClick: () => this._bulkDelete() });
            mkBtn('sched-ctrl-bulk-close',  { variant: 'ghost',     size: 'sm', icon: 'close',
                onClick: () => { this._table?.clearChecked?.(); this._selectedIds.clear(); this._updateBulkActions(); }
            });
        },

        _updateBulkActions() {
            const bar  = document.getElementById('sched-bulk-actions');
            const cnt  = document.getElementById('sched-bulk-count');
            if (!bar || !cnt) return;
            if (this._selectedIds.size > 0) {
                cnt.textContent = `${this._selectedIds.size} selected`;
                bar.classList.add('visible');
            } else {
                bar.classList.remove('visible');
                this._table?.clearChecked?.();
            }
        },

        _updateStats(items) {
            if (this._statEl) this._statEl.textContent = `${items.length}`;
        },

        // ── Table ───────────────────────────────────────────────────
        _buildTable() {
            if (this._table?.destroy) this._table.destroy();
            const card = document.querySelector('#schedule-table-view .table-card');
            card?.querySelector('.data-table-wrap')?.remove();
            const _this = this;

            const cols = [
                { id: 'select',   type: 'checkbox', title: 'Select all', locked: true, lockedPosition: 'left', resizable: false, width: '52px', onCheckAll: e => this._handleCheckAll(e) },
                { id: 'seq',      label: '#',       width: '40px', minWidth: '40px', locked: true, lockedPosition: 'left', resizable: false, align: 'center', render: r => { const s=document.createElement('span'); s.textContent=r.seq; return s; } },
                { id: 'name',     label: 'NAME',    width: '240px', minWidth: '120px', locked: true, lockedPosition: 'left', resizable: true, render: r => _this._renderNameCell(r) },
                { id: 'type',     label: 'TYPE',    width: '140px', minWidth: '140px', resizable: false, render: r => _this._renderTypeCell(r) },
                { id: 'group',    label: 'GROUP',   width: '160px', minWidth: '160px', maxWidth: '240px', render: r => _this._renderGroupCell(r) },
                { id: 'tags',     label: 'TAGS',    width: '160px', minWidth: '160px', maxWidth: '240px', render: r => _this._renderTagsCell(r) },
                { id: 'time',     label: 'TIME',    width: '160px', minWidth: '160px', maxWidth: '240px', resizable: false, render: r => _this._renderTimeConfig(r) },
                { id: 'next',     label: 'NEXT RUN',width: '160px', minWidth: '160px', resizable: false, render: r => _this._renderNextRun(r) },
                { id: 'status',   label: 'STATUS',  width: '144px', minWidth: '144px', resizable: false, render: r => _this._renderStatusBadge(r) },
                { id: 'message',  label: 'MESSAGE', width: '240px', minWidth: '240px', maxWidth: '400px', render: r => _this._renderMessageCell(r) },
                { id: 'note',     label: 'NOTE',    width: '240px', minWidth: '240px', maxWidth: '320px', resizable: true, render: r => _this._renderNoteCell(r) },
                { id: 'created',  label: 'CREATED TIME', width: '200px', minWidth: '200px', resizable: false, render: r => _this._renderDateCell(r.createdAt) },
                { id: 'filler',   fillSpace: true },
                { id: 'action',   label: 'CONTROL', width: '170px', locked: true, lockedPosition: 'right', resizable: false, render: (r) => _this._renderActionCell(r) }
            ];

            const tableContainer = document.getElementById('schedule-table-view');
            this._table = DuckControls.Table.create({
                id: 'duck-table-schedule',
                emptyText: 'No schedule tasks found',
                columns: cols,
                onCheckRow: (e, row) => {
                    if (e.checked) this._selectedIds.add(row.id);
                    else           this._selectedIds.delete(row.id);
                    this._updateBulkActions();
                },
                onRowContextMenu: (e, row) => this._showRowContextMenu(e, row),
            });

            if (card) { card.style.cssText = 'flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;'; card.appendChild(this._table.element); }
            this._table.updateColumnVisibility(this._visibleCols);
        },

        _handleCheckAll(e) {
            if (e.checked) this._schedulesData.forEach(s => this._selectedIds.add(s.id));
            else this._selectedIds.clear();
            this._updateBulkActions();
        },

        // ── Cell renderers ──────────────────────────────────────────
        _renderNameCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'width:100%;';
            const lbl = document.createElement('span');
            lbl.style.cssText = 'font-weight:500;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:text;display:block;';
            lbl.textContent = row.name || '-';

            const inputCtrl = DuckControls.Input.create({ icon: 'edit_note', placeholder: 'Tên task...', value: row.name || '' });
            inputCtrl.element.style.display = 'none';

            lbl.addEventListener('click', () => {
                lbl.style.display = 'none'; inputCtrl.element.style.display = 'flex';
                inputCtrl.input.focus(); inputCtrl.input.select();
            });

            const done = async () => {
                inputCtrl.element.style.display = 'none'; lbl.style.display = 'block';
                const newName = inputCtrl.getValue().trim();
                if (!newName) {
                    inputCtrl.setValue(row.name || '');
                    window.DuckControls.Toast?.error?.('Error', 'Name cannot be empty');
                    return;
                }
                if (newName !== row.name) {
                    const old = row.name;
                    row.name = newName; lbl.textContent = newName;
                    try { await DuckBridge.call('schedule.updateName', { id: row.id, name: newName }); }
                    catch (e) { row.name = old; lbl.textContent = old; DuckControls.Toast?.error?.('Lỗi', e?.message); }
                }
            };
            inputCtrl.input.addEventListener('blur', done);
            inputCtrl.input.addEventListener('keydown', e => { if (e.key === 'Enter') done(); if (e.key === 'Escape') { inputCtrl.setValue(row.name); done(); } });
            wrap.appendChild(lbl);
            wrap.appendChild(inputCtrl.element);
            wrap.addEventListener('click', e => e.stopPropagation());
            return wrap;
        },

        _renderTypeCell(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;gap:6px;white-space:nowrap;width:max-content;';
            const MAP = {
                immediate: { icon: 'bolt',     text: 'Immediate' },
                once:      { icon: 'event',    text: 'Once'      },
                interval:  { icon: 'repeat',   text: 'Interval'  },
                daily:     { icon: 'today',    text: 'Daily'     },
            };
            const cfg = MAP[row.freqType] || MAP.immediate;
            wrap.innerHTML = `<span class="material-symbols-outlined" style="font-size:16px;width:16px;display:inline-flex;justify-content:center;color:var(--text-tertiary);flex-shrink:0;">${cfg.icon}</span> <span style="font-size:13px;color:var(--text-primary);font-weight:500;">${cfg.text}</span>`;
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

        _renderTimeConfig(row) {
            const s = document.createElement('span');
            s.style.cssText = 'font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;';
            s.textContent = row.timeConfig || '-';
            if (row.timeConfig && window.DuckControls?.Tooltip) {
                window.DuckControls.Tooltip.create(s, { text: row.timeConfig, position: 'top' });
            }
            return s;
        },

        _renderNextRun(row) {
            const s = document.createElement('span');
            if (!row.nextRun) {
                s.className = 'sched-nextrun on-demand';
                s.textContent = row.freqType === 'immediate' ? 'On demand' : '—';
            } else {
                s.className = 'sched-nextrun';
                s.textContent = this._formatDate(row.nextRun);
            }
            return s;
        },

        _renderStatusBadge(row) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;align-items:center;white-space:nowrap;width:max-content;';
            const st = String(row.status || 'idle').toLowerCase();
            let color = 'var(--text-tertiary)';
            let text = 'Idle';
            if (st === 'running' || st === 'ready') { color = 'var(--success)'; text = st === 'ready' ? 'Ready' : 'Running'; }
            else if (st === 'paused' || st === 'stopped') { color = 'var(--warning)'; text = st === 'stopped' ? 'Stopped' : 'Paused'; }
            else if (st === 'error') { color = 'var(--danger)'; text = 'Error'; }
            else if (st === 'finished' || st === 'completed') { color = 'var(--text-secondary)'; text = 'Finished'; }

            const pill = document.createElement('span');
            pill.style.cssText = `display:inline-block;width:14px;height:6px;border-radius:3px;margin-right:6px;background:${color};flex-shrink:0;`;
            const txt = document.createElement('span');
            txt.style.cssText = 'font-size:12px;font-weight:500;color:var(--text-primary);';
            txt.textContent = text;
            wrap.appendChild(pill); wrap.appendChild(txt);
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
                        await DuckBridge.call('schedule.updateNotes', { id: row.id, notes: newVal });
                        row.note = newVal;
                        lbl.textContent = newVal || '-';
                    } catch (e) {
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

            const isRunning = row.status === 'running';

            const runBtn = document.createElement('button');
            runBtn.style.cssText = 'width:80px;justify-content:center;';
            DuckControls.Button.create(runBtn, {
                variant: isRunning ? 'warning' : 'success', 
                icon: isRunning ? 'pause' : 'play_arrow', 
                text: isRunning ? 'Pause' : 'Run',
                size: 'sm',
                onClick: async (e) => {
                    e.stopPropagation();
                    try {
                        if (isRunning) await DuckBridge.call('schedule.pause', { id: row.id });
                        else           await DuckBridge.call('schedule.run',   { id: row.id });
                        await this.loadSchedules();
                    } catch (err) { DuckControls.Toast?.error?.('Error', err?.message); }
                },
            });
            wrap.appendChild(runBtn);

            const moreBtn = document.createElement('button');
            moreBtn.classList.add('duck-btn-icon-only');
            DuckControls.Button.create(moreBtn, { icon: 'more_vert', variant: 'ghost', size: 'sm' });
            moreBtn.onclick = (e) => {
                e.stopPropagation();
                if (window.DuckControls?.ContextMenu) {
                    window.DuckControls.ContextMenu.create(moreBtn, {
                        items: [
                            { type: 'label', label: 'Task Actions' },
                            { label: 'Edit Task', icon: 'edit', onClick: () => window.ScheduleModals?.CreateTask?.show(async (payload) => {
                                await DuckBridge.call('schedule.update', payload);
                                await this.loadSchedules();
                                DuckControls.Toast?.success?.('Success', 'Task updated');
                            }, row) },
                            'divider',
                            { label: 'Delete Task', icon: 'delete', danger: true, color: 'var(--danger)', onClick: async () => {
                                if (!confirm(`Delete task "${row.name}"?`)) return;
                                try { await DuckBridge.call('schedule.delete', { id: row.id }); await this.loadSchedules(); }
                                catch (err) { DuckControls.Toast?.error?.('Error', err?.message); }
                            }}
                        ]
                    }).showAt(e.clientX, e.clientY);
                }
            };
            wrap.appendChild(moreBtn);

            return wrap;
        },

        _showRowContextMenu(e, row) {
            DuckControls.ContextMenu.show(e, {
                items: [
                    { label: row.status === 'running' ? 'Pause Task' : 'Run Task', icon: row.status === 'running' ? 'pause' : 'play_arrow',
                      onClick: async () => {
                          if (row.status === 'running') await DuckBridge.call('schedule.pause', { id: row.id });
                          else await DuckBridge.call('schedule.run', { id: row.id });
                          await this.loadSchedules();
                      }
                    },
                    { label: 'Edit Task', icon: 'edit',
                      onClick: () => window.ScheduleModals?.CreateTask?.show(async (p) => {
                          await DuckBridge.call('schedule.update', p);
                          await this.loadSchedules();
                      }, row)
                    },
                    'divider',
                    { label: 'Delete Task', icon: 'delete', danger: true, color: 'var(--danger)',
                      onClick: async () => {
                          if (!confirm(`Xóa task "${row.name}"?`)) return;
                          await DuckBridge.call('schedule.delete', { id: row.id });
                          await this.loadSchedules();
                      }
                    },
                ],
            });
        },

        // ── Bulk actions ────────────────────────────────────────────
        async _bulkRun() {
            try { await DuckBridge.call('schedule.bulkRun', [...this._selectedIds]); await this.loadSchedules(); }
            catch (e) { DuckControls.Toast?.error?.('Error', e?.message); }
        },
        async _bulkPause() {
            try { await DuckBridge.call('schedule.bulkPause', [...this._selectedIds]); await this.loadSchedules(); }
            catch (e) { DuckControls.Toast?.error?.('Error', e?.message); }
        },
        async _bulkDelete() {
            if (!confirm(`Delete ${this._selectedIds.size} task(s)?`)) return;
            try { await DuckBridge.call('schedule.bulkDelete', [...this._selectedIds]); this._selectedIds.clear(); this._updateBulkActions(); await this.loadSchedules(); }
            catch (e) { DuckControls.Toast?.error?.('Error', e?.message); }
        },

        // ── Helpers ─────────────────────────────────────────────────
        _escapeHtml(str) {
            if (!str) return '';
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
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

        _formatDate(iso) {
            if (!iso) return '-';
            try {
                const d   = new Date(iso);
                if (isNaN(d)) return '-';
                const pad = n => String(n).padStart(2, '0');
                return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
            } catch { return '-'; }
        },
    };

    // ── Register with DuckApp ────────────────────────────────────────
    window.ScheduleView = VIEW;
    if (window.DuckApp) {
        DuckApp.registerView('schedule', VIEW);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (window.DuckApp) DuckApp.registerView('schedule', VIEW);
        });
    }
})();


