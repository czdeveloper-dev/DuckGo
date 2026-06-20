window.ScheduleModals = window.ScheduleModals || {};

/**
 * CreateTask Modal – 3 tabs: Schedule / Profile / Config
 * Uses DuckControls.Modal + DuckControls.TabControl (horizontal variant)
 */
window.ScheduleModals.CreateTask = {
    _modal: null,
    _selectedProfileIds: null,
    _onSave: null,

    show(onSave, editData) {
        try {
            if (this._modal) { this._modal.destroy(); this._modal = null; }
            this._onSave = onSave;
            this._selectedProfileIds = new Set(editData?.profileIds || []);

        // ── Outer wrapper ────────────────────────────────────────
        const body = document.createElement('div');
        body.style.cssText = 'display:flex;flex-direction:column;gap:14px;height:550px;overflow:hidden;';

        // Task name
        const nameCtrl = DuckControls.Input.create({
            label: 'Task Name',
            placeholder: 'Leave empty for auto-generate',
            value: editData?.name || '',
            icon: 'task',
            fullWidth: true
        });
        body.appendChild(nameCtrl.element);

        // ════════════════════════════════════════════════════════
        // TAB 1: SCHEDULE
        // ════════════════════════════════════════════════════════
        const tabSchedule = document.createElement('div');
        tabSchedule.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

        // Automation select
        const autoSel = DuckControls.MultiSelectComboBox.create({
            label: 'Automation',
            placeholder: 'Select Automations...',
            options: [{ label: '(loading...)', value: '' }],
        });
        tabSchedule.appendChild(autoSel.element);

        // Load automations – graceful fallback
        DuckBridge.call('automation.list').then(res => {
            const items = res?.Items || res || [];
            autoSel.setOptions([
                ...items.map(a => ({ label: a.Name || a.name || '', value: String(a.Id || a.id) })),
            ]);
            if (editData?.automationId) autoSel.setValues([String(editData.automationId)]);
        }).catch(() => {
            const mockItems = [
                { Id: 1, Name: 'Auto Like Facebook' },
                { Id: 2, Name: 'Shopee Checkout' },
                { Id: 3, Name: 'Daily Login Bonus' }
            ];
            autoSel.setOptions([
                ...mockItems.map(a => ({ label: a.Name || a.name || '', value: String(a.Id || a.id) })),
            ]);
            if (editData?.automationId) autoSel.setValues([String(editData.automationId)]);
        });

        // Frequency
        const freqSel = DuckControls.Select.create({
            label: 'Frequency',
            options: [
                { label: 'Immediately', value: 'immediate', icon: 'bolt' },
                { label: 'Once',        value: 'once',      icon: 'calendar_today' },
                { label: 'Interval',    value: 'interval',  icon: 'sync' },
                { label: 'Daily',       value: 'daily',     icon: 'calendar_month' },
            ],
            value: editData?.freqType || 'interval',
            onChange: (e) => showPanel(e.target?.value || freqSel.getValue())
        });
        tabSchedule.appendChild(freqSel.element);

        // Dynamic panel container
        const dynWrap = document.createElement('div');
        dynWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        tabSchedule.appendChild(dynWrap);

        // Preview
        const previewBox = document.createElement('div');
        previewBox.className = 'sched-preview-box';
        previewBox.innerHTML = '<span class="material-symbols-outlined">event</span><div class="sched-preview-text" id="sched-task-preview"></div>';
        tabSchedule.appendChild(previewBox);

        // ── Panel: Immediate ──────────────────────────────────────
        const panelImmediate = document.createElement('div');
        panelImmediate.style.cssText = 'font-size:12px;color:var(--text-secondary);padding:10px 14px;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:var(--r);';
        panelImmediate.innerHTML = 'Task will <strong style="color:var(--text-primary)">run immediately</strong> when triggered. No fixed schedule.';

        // ── Panel: Once ───────────────────────────────────────────
        const panelOnce = document.createElement('div');
        panelOnce.style.cssText = 'display:flex;gap:10px;';
        let initDate = editData?.onceDatetime?.split('T')[0] || '';
        if (initDate && initDate.includes('-')) {
            const p = initDate.split('-');
            if (p.length === 3) initDate = `${p[2]}/${p[1]}/${p[0]}`;
        }
        const dateCtrl = DuckControls.DateTimeInput.create({ label: 'Date', icon: 'calendar_today', type: 'date', format: 'DD/MM/YYYY', value: initDate });
        
        let initTime = editData?.onceDatetime?.split('T')[1]?.slice(0,5) || '';
        const timeCtrl = DuckControls.DateTimeInput.create({ label: 'Time', icon: 'schedule', type: 'time', format: 'HH:MM', value: initTime });
        
        dateCtrl.element.style.flex = '1';
        timeCtrl.element.style.flex = '1';
        panelOnce.appendChild(dateCtrl.element);
        panelOnce.appendChild(timeCtrl.element);

        // ── Panel: Interval ───────────────────────────────────────
        const panelInterval = document.createElement('div');
        panelInterval.style.cssText = 'display:flex;gap:10px;align-items:flex-end;';
        const intervalSpin = DuckControls.SpinNumber.create({ label: 'Every', value: editData?.intervalValue || 30, min: 1, max: 9999, step: 1, onChange: () => updatePreview() });
        const intervalUnit = DuckControls.Select.create({
            label: 'Unit',
            options: [{ label: 'Minutes', value: 'minutes' }, { label: 'Hours', value: 'hours' }, { label: 'Days', value: 'days' }],
            value: editData?.intervalUnit || 'minutes',
            onChange: () => updatePreview()
        });
        intervalSpin.element.style.flex = '1';
        intervalUnit.element.style.flex = '1';
        panelInterval.appendChild(intervalSpin.element);
        panelInterval.appendChild(intervalUnit.element);

        // ── Panel: Daily ──────────────────────────────────────────
        const panelDaily = document.createElement('div');
        panelDaily.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
        const dailyTimeCtrl = DuckControls.DateTimeInput.create({ label: 'Run At', icon: 'schedule', type: 'time', format: 'HH:MM:SS', value: editData?.dailyTime || '08:00' });
        dailyTimeCtrl.element.style.maxWidth = '180px';
        panelDaily.appendChild(dailyTimeCtrl.element);

        const dowLabel = document.createElement('div');
        dowLabel.className = 'ui-label';
        dowLabel.textContent = 'Days of Week';
        panelDaily.appendChild(dowLabel);

        const dayToggles = document.createElement('div');
        dayToggles.className = 'sched-day-toggles';
        dayToggles.style.cssText = 'display:flex; flex-wrap:wrap; gap:8px;';
        const DAY_LABELS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
        const activeDays = new Set(editData?.dailyDays || [1,2,3,4,5]);
        DAY_LABELS.forEach((lbl, i) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sched-day-toggle' + (activeDays.has(i + 1) ? ' active' : '');
            btn.textContent = lbl;
            btn.addEventListener('click', () => {
                const d = i + 1;
                activeDays.has(d) ? activeDays.delete(d) : activeDays.add(d);
                btn.classList.toggle('active');
                updatePreview();
            });
            dayToggles.appendChild(btn);
        });
        panelDaily.appendChild(dayToggles);

        // ── Preview update ────────────────────────────────────────
        function updatePreview() {
            const freq = freqSel.getValue();
            const el   = document.getElementById('sched-task-preview');
            if (!el) return;
            if (freq === 'immediate') {
                el.innerHTML = 'Task will <strong>run immediately</strong> when triggered.';
            } else if (freq === 'once') {
                const dStr = dateCtrl.getValue() || '?';
                const tStr = timeCtrl.getValue() || '?';
                el.innerHTML = `Task will run <strong>once</strong> at <strong>${dStr} ${tStr}</strong>.`;
            } else if (freq === 'interval') {
                const n = intervalSpin.getValue();
                const u = intervalUnit.getValue();
                el.innerHTML = `Task will run <strong>every ${n} ${u}</strong> from the time it is activated.`;
            } else if (freq === 'daily') {
                const t    = dailyTimeCtrl.getValue() || '?';
                const days = [...activeDays].sort().map(d => DAY_LABELS[d - 1]).join(', ');
                el.innerHTML = `Task will run at <strong>${t}</strong> on <strong>${days || 'no days selected'}</strong>.`;
            }
        }

        function showPanel(freq) {
            dynWrap.innerHTML = '';
            if (freq === 'immediate') dynWrap.appendChild(panelImmediate);
            else if (freq === 'once')     dynWrap.appendChild(panelOnce);
            else if (freq === 'interval') dynWrap.appendChild(panelInterval);
            else if (freq === 'daily')    dynWrap.appendChild(panelDaily);
            updatePreview();
        }

        if (dateCtrl && dateCtrl.input) dateCtrl.input.addEventListener('change', updatePreview);
        if (timeCtrl && timeCtrl.input) timeCtrl.input.addEventListener('change', updatePreview);
        if (dailyTimeCtrl && dailyTimeCtrl.input) dailyTimeCtrl.input.addEventListener('change', updatePreview);
        showPanel(editData?.freqType || 'interval');

        // ════════════════════════════════════════════════════════
        // TAB 2: PROFILE
        // ════════════════════════════════════════════════════════
        const tabProfile = document.createElement('div');
        tabProfile.style.cssText = 'display:flex;flex-direction:column;gap:10px;height:100%;';

        // Filter row 1
        const fRow1 = document.createElement('div');
        fRow1.style.cssText = 'display:flex;gap:10px;';
        const profSearch = DuckControls.Input.create({ label: 'Search', placeholder: 'Search by name...', icon: 'search' });
        const profId     = DuckControls.Input.create({ label: 'ID',     placeholder: '1,2,3 or 1-5',    icon: 'tag' });
        profSearch.element.style.flex = '2';
        profId.element.style.flex = '1';
        fRow1.appendChild(profSearch.element);
        fRow1.appendChild(profId.element);
        tabProfile.appendChild(fRow1);

        // Filter row 2
        const fRow2 = document.createElement('div');
        fRow2.style.cssText = 'display:flex;gap:10px;';
        const profGroup = DuckControls.Select.create({ label: 'Group', placeholder: 'All Groups', options: [{ label: 'All Groups', value: '' }], onChange: () => loadProfiles() });
        const profTag   = DuckControls.MultiSelectComboBox.create({ label: 'Tag', placeholder: 'All Tags', options: [] });
        profGroup.element.style.flex = '1';
        profTag.element.style.flex   = '1';
        fRow2.appendChild(profGroup.element);
        fRow2.appendChild(profTag.element);
        tabProfile.appendChild(fRow2);

        // Profile mini-table
        const profTableWrap = document.createElement('div');
        profTableWrap.className = 'sched-profile-table-wrap';
        profTableWrap.style.cssText = 'flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border-default); border-radius: 6px;';
        tabProfile.appendChild(profTableWrap);

        const profCountEl = document.createElement('div');
        profCountEl.style.cssText = 'font-size:12px;color:var(--text-tertiary);';
        profCountEl.innerHTML = '<span class="sched-prof-sel-count" style="color:var(--accent);font-weight:600">0</span> profiles selected';
        tabProfile.appendChild(profCountEl);

        const _self = this;
        let _profTable = null;

        const buildProfTable = () => {
            _profTable = DuckControls.Table.create({
                id: 'sched-prof-pick',
                emptyText: 'No profiles found',
                columns: [
                    { id: 'select', type: 'checkbox', width: '40px', locked: true, lockedPosition: 'left', resizable: false, title: 'Select all',
                      onCheckAll: (e) => {
                          if (e.checked) _currentProfiles.forEach(p => _self._selectedProfileIds.add(p.id));
                          else _self._selectedProfileIds.clear();
                          updateProfCount();
                      }
                    },
                    { id: 'seq',   label: '#',     width: '40px', minWidth: '40px', locked: true, lockedPosition: 'left', resizable: false, align: 'center',
                      render: r => { const s = document.createElement('span'); s.textContent = r.seq; return s; }
                    },
                    { id: 'id',    label: 'ID',    width: '40px', minWidth: '40px', locked: true, lockedPosition: 'left', resizable: false, align: 'center',
                      render: r => { const s = document.createElement('span'); s.textContent = r.id; return s; }
                    },
                    { id: 'name',  label: 'NAME',  width: '160px', maxWidth: '160px', locked: true, lockedPosition: 'left', resizable: true,
                      render: r => { 
                          const s = document.createElement('span'); 
                          s.style.cssText = 'font-weight:500;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;cursor:pointer;'; 
                          s.textContent = r.name || '-'; 
                          
                          requestAnimationFrame(() => {
                              if (s.offsetWidth < s.scrollWidth) {
                                  DuckControls.Tooltip.create(s, { text: r.name, position: 'top' });
                              }
                          });
                          
                          s.addEventListener('click', () => {
                              const tr = s.closest('tr');
                              if (tr) {
                                  const cb = tr.querySelector('input[type="checkbox"]');
                                  if (cb) cb.click();
                              }
                          });
                          
                          return s; 
                      }
                    },
                    { id: 'group', label: 'GROUP', width: '160px', minWidth: '160px', maxWidth: '240px',
                      render: r => { 
                          const s = document.createElement('span'); 
                          s.style.cssText = 'font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block;'; 
                          s.textContent = r.groupName || '-'; 
                          
                          requestAnimationFrame(() => {
                              if (s.offsetWidth < s.scrollWidth && r.groupName) {
                                  DuckControls.Tooltip.create(s, { text: r.groupName, position: 'top' });
                              }
                          });
                          
                          return s; 
                      }
                    },
                    { id: 'tags',  label: 'TAGS', width: '160px', minWidth: '160px', maxWidth: '240px',
                      render: r => {
                          const w = document.createElement('div');
                          w.style.cssText = 'display:flex;gap:4px;overflow:hidden;';
                          const tags = Array.isArray(r.tags) ? r.tags : [];
                          if (!tags.length) { w.style.color = 'var(--text-tertiary)'; w.textContent = '-'; return w; }
                          
                          tags.slice(0, 3).forEach(t => {
                              const b = document.createElement('span');
                              DuckControls.Badge?.create ? DuckControls.Badge.create(b, { text: t }) : (b.textContent = t);
                              b.style.whiteSpace = 'nowrap';
                              b.style.overflow = 'hidden';
                              b.style.textOverflow = 'ellipsis';
                              b.style.maxWidth = '100%';
                              b.style.display = 'inline-block';
                              w.appendChild(b);
                          });
                          
                          requestAnimationFrame(() => {
                              if (w.scrollWidth > w.offsetWidth || tags.length > 3) {
                                  DuckControls.Tooltip.create(w, { text: tags.join(', '), position: 'top' });
                              }
                          });
                          return w;
                      }
                    },
                    { id: 'filler', fillSpace: true }
                ],
                onCheckRow: (e, row) => {
                    if (e.checked) _self._selectedProfileIds.add(row.id);
                    else           _self._selectedProfileIds.delete(row.id);
                    updateProfCount();
                },
            });
            _profTable.element.style.flex = '1';
            _profTable.element.style.height = '100%';
            profTableWrap.appendChild(_profTable.element);
        };

        const updateProfCount = () => {
            const el = profCountEl.querySelector('.sched-prof-sel-count');
            if (el) el.textContent = _self._selectedProfileIds.size;
        };

        let _currentProfiles = [];
        const loadProfiles = async () => {
            try {
                const filters = {};
                const s  = profSearch.getValue().trim();
                const id = profId.getValue().trim();
                const g  = profGroup.getValue();
                const t  = profTag.getValues?.() || [];
                if (s)       filters.search  = s;
                if (id)      filters.idStr   = id;
                if (g)       filters.groupId = parseInt(g);
                if (t.length)filters.tagIds  = t.map(Number);
                const resp = await DuckBridge.call('profile.list', filters);
                _currentProfiles = (resp?.Items || resp || []).map((p, i) => ({
                    ...p, id: p.Id || p.id, seq: i + 1,
                    name: p.Name || p.name || '',
                    groupName: p.GroupName || '',
                    tags: p.TagNames || p.tagNames || [],
                }));
            } catch {
                _currentProfiles = [
                    { id: 1, seq: 1, name: 'Profile Facebook 1', groupName: 'Facebook Farms', tags: ['vip', 'active'] },
                    { id: 2, seq: 2, name: 'Profile Facebook 2', groupName: 'Facebook Farms', tags: ['active'] },
                    { id: 3, seq: 3, name: 'Shopee Buyer', groupName: 'Shopee', tags: ['buyer'] },
                    { id: 4, seq: 4, name: 'Amazon Crawler', groupName: 'Crawlers', tags: [] }
                ];
            }
            if (_profTable) {
                _profTable.renderData(_currentProfiles);
                _profTable.setChecked?.([..._self._selectedProfileIds]);
            }
            updateProfCount();
        };

        // Load groups/tags for filters
        DuckBridge.call('group.list').then(groups => {
            profGroup.setOptions([
                { label: 'All Groups', value: '' },
                ...(groups || []).map(g => ({ label: g.Name || g.name, value: String(g.Id || g.id) })),
            ]);
        }).catch(() => {});

        DuckBridge.call('tag.list').then(tags => {
            profTag.setOptions((tags || []).map(t => ({ label: t.Name || t.name, value: String(t.Id || t.id) })));
        }).catch(() => {});

        // Wire filters
        if (profSearch && profSearch.input) profSearch.input.addEventListener('input', () => loadProfiles());
        if (profId && profId.input) profId.input.addEventListener('input', () => loadProfiles());

        // Build table then load (deferred so DOM is ready)
        buildProfTable();
        setTimeout(() => loadProfiles(), 0);

        // ════════════════════════════════════════════════════════
        // TAB 3: CONFIG
        // ════════════════════════════════════════════════════════
        const tabConfig = document.createElement('div');
        tabConfig.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

        // Threads
        const threadRow = document.createElement('div');
        threadRow.style.cssText = 'display:flex;align-items:center;gap:12px;';
        const threadSpin = DuckControls.SpinNumber.create({ label: 'Concurrent Threads', value: editData?.threads || 3, min: 1, max: 50 });
        const threadHint = document.createElement('span');
        threadHint.style.cssText = 'font-size:12px;color:var(--text-tertiary);padding-top:20px;';
        threadHint.textContent = 'Profiles run in parallel';
        threadRow.appendChild(threadSpin.element);
        threadRow.appendChild(threadHint);
        tabConfig.appendChild(threadRow);

        // Arrange Profiles
        let selectedArrange = editData?.arrangeMode || 'grid';
        const arrWrap = document.createElement('div');
        arrWrap.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

        const genSection = document.createElement('div');
        genSection.style.cssText = 'display:flex; flex-direction:column; gap:12px;';
        
        const targetScreen = DuckControls.ComboBox.create({
            icon: 'grid_on',
            label: 'Target Screen',
            options: [
                { label: 'Primary Monitor', value: 'primary' },
                { label: 'Secondary Monitor', value: 'secondary' }
            ],
            value: 'primary'
        });
        genSection.appendChild(targetScreen.element);
        arrWrap.appendChild(genSection);

        const div1 = document.createElement('div');
        div1.style.cssText = 'height: 1px; background: var(--border-default);';
        arrWrap.appendChild(div1);

        const layoutSection = document.createElement('div');
        layoutSection.style.cssText = 'display:flex; flex-direction:column; gap:12px;';
        
        const modeWrap = document.createElement('div');
        modeWrap.style.alignSelf = 'flex-start';
        const modeLabel = document.createElement('div');
        modeLabel.className = 'ui-label';
        modeLabel.textContent = 'Layout Mode';
        modeLabel.style.marginBottom = '6px';
        modeWrap.appendChild(modeLabel);

        const gridSettingsWrap = document.createElement('div');
        gridSettingsWrap.style.cssText = 'display:flex; flex-direction:column; gap:10px; transition: all 0.3s ease;';

        const modeRadio = DuckControls.ChipSelect.create({
            name: 'schedArrangeMode',
            options: [
                { label: 'Auto Split', value: 'auto' },
                { label: 'Grid Layout', value: 'grid' }
            ],
            value: selectedArrange,
            onChange: (val) => {
                selectedArrange = val;
                if (val !== 'grid') {
                    gridSettingsWrap.style.opacity = '0.3';
                    gridSettingsWrap.style.pointerEvents = 'none';
                } else {
                    gridSettingsWrap.style.opacity = '1';
                    gridSettingsWrap.style.pointerEvents = 'auto';
                }
            }
        });
        modeRadio.element.style.width = 'max-content';
        modeWrap.appendChild(modeRadio.element);
        layoutSection.appendChild(modeWrap);

        if (selectedArrange !== 'grid') {
            gridSettingsWrap.style.opacity = '0.3';
            gridSettingsWrap.style.pointerEvents = 'none';
        }

        const layoutGrid = document.createElement('div');
        layoutGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; align-items: end;';
        
        const colWrap = document.createElement('div');
        colWrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        const colLabel = document.createElement('label');
        colLabel.className = 'ui-label';
        colLabel.textContent = 'Columns';
        colWrap.appendChild(colLabel);
        const colsSpin = DuckControls.SpinNumber.create({ value: editData?.columns || 2, min: 1, max: 20, step: 1 });
        colWrap.appendChild(colsSpin.element);
        
        const rowWrap = document.createElement('div');
        rowWrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        const rowLabel = document.createElement('label');
        rowLabel.className = 'ui-label';
        rowLabel.textContent = 'Rows';
        rowWrap.appendChild(rowLabel);
        const rowsSpin = DuckControls.SpinNumber.create({ value: editData?.rows || 2, min: 1, max: 20, step: 1 });
        rowWrap.appendChild(rowsSpin.element);
        
        const gapWrap = document.createElement('div');
        gapWrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        const gapLabel = document.createElement('label');
        gapLabel.className = 'ui-label';
        gapLabel.textContent = 'Gap (px)';
        gapWrap.appendChild(gapLabel);
        const gapSpin = DuckControls.SpinNumber.create({ value: editData?.gap || 10, min: 0, max: 100, step: 1 });
        gapWrap.appendChild(gapSpin.element);
        
        const scaleCbWrap = document.createElement('div');
        scaleCbWrap.style.cssText = 'padding-bottom: 6px;';
        const scaleCb = DuckControls.Checkbox.create(scaleCbWrap, { 
            label: 'Auto-scale to fit', 
            checked: editData?.autoScale !== false
        });

        layoutGrid.appendChild(colWrap);
        layoutGrid.appendChild(rowWrap);
        layoutGrid.appendChild(gapWrap);
        layoutGrid.appendChild(scaleCbWrap);
        
        gridSettingsWrap.appendChild(layoutGrid);
        layoutSection.appendChild(gridSettingsWrap);
        arrWrap.appendChild(layoutSection);
        tabConfig.appendChild(arrWrap);

        // Chrome args
        const chromeCtrl = DuckControls.Input.create({
            label: 'Chrome Arguments',
            placeholder: '--disable-notifications --no-sandbox ...',
            value: editData?.chromeArgs || '',
            icon: 'public',
        });
        tabConfig.appendChild(chromeCtrl.element);

        // Delay + Repeat
        const drRow = document.createElement('div');
        drRow.style.cssText = 'display:flex;gap:12px;';
        const delaySpin  = DuckControls.SpinNumber.create({ label: 'Window Open Delay (ms)', value: editData?.openDelayMs || 1500, min: 0, max: 60000, step: 100 });
        const repeatSpin = DuckControls.SpinNumber.create({ label: 'Repeat Count',           value: editData?.repeatCount || 1,    min: 1, max: 9999  });
        delaySpin.element.style.flex  = '1';
        repeatSpin.element.style.flex = '1';
        drRow.appendChild(delaySpin.element);
        drRow.appendChild(repeatSpin.element);
        tabConfig.appendChild(drRow);

        // ── TabControl (horizontal) ──────────────────────────────
        const tabCtrl = DuckControls.TabControl.create({
            variant: 'horizontal',
            tabs: [
                { id: 'schedule', name: 'Schedule', content: tabSchedule },
                { id: 'profiles', name: 'Profiles', content: tabProfile },
                { id: 'config',   name: 'Config',   content: tabConfig   },
            ],
        });
        tabCtrl.element.style.cssText = 'flex:1;min-height:0;overflow:hidden;';
        body.appendChild(tabCtrl.element);

        // ── Modal ─────────────────────────────────────────────────
        this._modal = DuckControls.Modal.create({
            title:    editData ? 'Edit Task' : 'Create Schedule Task',
            subtitle: 'Configure an automated execution task',
            icon:     'assignment',
            content:  body,
            size:     'lg',
            closeOnOverlay: true,
            preventAutoFocus: true,
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, m) => m.close() },
                {
                    text:  editData ? 'Save Changes' : 'Create Task',
                    icon:  'save',
                    class: 'duck-btn-primary',
                    onClick: async (e, m) => {
                        const name = nameCtrl.getValue().trim();
                        const freq = freqSel.getValue();
                        const selectedAutos = autoSel.getValues?.() || [];
                        const payload = {
                            name: name || '',
                            automationId:  selectedAutos.length ? parseInt(selectedAutos[0]) : null,
                            automationIds: selectedAutos.map(Number),
                            freqType:      freq,
                            onceDatetime:  freq === 'once' ? (() => {
                                const dStr = dateCtrl.getValue() || '';
                                let isoD = dStr;
                                if (dStr.includes('/')) {
                                    const p = dStr.split('/');
                                    if (p.length === 3) isoD = `${p[2]}-${p[1]}-${p[0]}`;
                                }
                                return isoD + 'T' + (timeCtrl.getValue() || '00:00');
                            })() : null,
                            intervalValue: freq === 'interval' ? intervalSpin.getValue()        : null,
                            intervalUnit:  freq === 'interval' ? intervalUnit.getValue()        : null,
                            dailyTime:     freq === 'daily'    ? dailyTimeCtrl.getValue()       : null,
                            dailyDays:     freq === 'daily'    ? [...activeDays].sort()         : null,
                            profileIds:    [...this._selectedProfileIds],
                            threads:       threadSpin.getValue(),
                            arrangeMode:   selectedArrange,
                            columns:       colsSpin.getValue(),
                            rows:          rowsSpin.getValue(),
                            gap:           gapSpin.getValue(),
                            autoScale:     scaleCb.isChecked(),
                            chromeArgs:    chromeCtrl.getValue(),
                            openDelayMs:   delaySpin.getValue(),
                            repeatCount:   repeatSpin.getValue(),
                        };
                        if (editData?.id) payload.id = editData.id;

                        m.setLoading(true);
                        try {
                            if (this._onSave) await this._onSave(payload);
                            m.close();
                        } catch (err) {
                            DuckControls.Toast?.error?.('Error', err?.message || 'Failed to save task');
                        } finally {
                            m.setLoading(false);
                        }
                    },
                },
            ],
            onClose: () => { this._modal = null; this._selectedProfileIds = null; },
        });

        this._modal.open();
        } catch (err) {
            console.error('CreateTask show error:', err);
            if (window.DuckControls && window.DuckControls.Toast && window.DuckControls.Toast.error) {
                window.DuckControls.Toast.error('Create Task Error', err.stack || err.message || String(err));
            } else {
                alert('Create Task Error:\n' + (err.stack || err.message || String(err)));
            }
        }
    },
};
