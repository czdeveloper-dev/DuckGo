/**
 * CreateProfileModal.js — wired to DuckBridge (unified JS ↔ C# protocol)
 *
 * Group & Tag selects load from backend via group.list / tag.list.
 * Quick-create buttons (in dropdown) open CreateEntity modal and refresh selects.
 */
(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    Object.assign(window.ProfileModals.CreateProfile, {
        _modal: null,
        _groupCtrl: null,
        _tagCtrl: null,
        _groups: [],
        _tags: [],

        async _loadEntityData() {
            try {
                this._groups = await DuckBridge.call('group.list') || [];
                this._tags   = await DuckBridge.call('tag.list')   || [];
                this._groups.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                this._tags.sort((a, b)   => (a.Name || '').localeCompare(b.Name || ''));
            } catch (e) {
                console.error('[CreateProfileModal] Failed to load entity data:', e);
                this._groups = [];
                this._tags   = [];
            }
        },

        _buildGroupOptions() {
            return this._groups.map(g => ({
                label: g.Name || g.name || '',
                value: String(g.Id ?? g.id)
            }));
        },

        _buildTagOptions() {
            return this._tags.map(t => ({
                label: t.Name || t.name || '',
                value: String(t.Id ?? t.id)
            }));
        },

        async _refreshEntityData() {
            await this._loadEntityData();
            if (this._groupCtrl) this._groupCtrl.setOptions(this._buildGroupOptions());
            if (this._tagCtrl)   this._tagCtrl.setOptions(this._buildTagOptions());
        },

        async _quickCreateGroup() {
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('group', async (name) => {
                try {
                    const result = await DuckBridge.call('group.create', { name });
                    // result = { Id, Name, CreatedAt } from backend
                    this._groups.push(result);
                    this._groups.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                    if (this._groupCtrl) this._groupCtrl.setOptions(this._buildGroupOptions());
                    this._groupCtrl?.setValue(String(result.Id));
                    window.DuckControls?.Toast?.success('Group Created', `Group "${name}" created.`);
                } catch (e) {
                    window.DuckControls?.Toast?.error('Create Failed', e.message);
                }
            });
        },

        async _quickCreateTag() {
            if (!window.ProfileModals?.CreateEntity) return;
            window.ProfileModals.CreateEntity.show('tag', async (name) => {
                try {
                    const result = await DuckBridge.call('tag.create', { name });
                    // result = { Id, Name, CreatedAt } from backend
                    this._tags.push(result);
                    this._tags.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                    if (this._tagCtrl) this._tagCtrl.setOptions(this._buildTagOptions());
                    window.DuckControls?.Toast?.success('Tag Created', `Tag "${name}" created.`);
                } catch (e) {
                    window.DuckControls?.Toast?.error('Create Failed', e.message);
                }
            });
        },

        async show() {
            if (this._modal) { this._modal.destroy(); this._modal = null; }

            // Fetch groups & tags before rendering
            await this._loadEntityData();

            const container = document.createElement('div');
            container.style.cssText = 'display: flex; gap: 16px; flex: 1; background: var(--bg-base); padding: 24px; box-sizing: border-box; overflow: hidden; height: 100%;';

            // ── LEFT COLUMN ──────────────────────────────────────────────
            const leftCol = document.createElement('div');
            leftCol.style.cssText = 'flex: 1; display: flex; flex-direction: column; gap: 16px; min-width: 0; overflow: hidden;';

            const topForm = document.createElement('div');
            topForm.style.cssText = 'display: flex; flex-direction: column; gap: 16px; background: var(--bg-surface); padding: 16px; border-radius: 8px; border: 1px solid var(--border-default);';

            const createLabelWrap = (labelText, el) => {
                const w = document.createElement('div');
                w.className = 'filter-stacked';
                const h = document.createElement('div');
                h.className = 'filter-stacked-head';
                const l = document.createElement('span');
                l.className = 'ui-label-sm';
                l.textContent = labelText;
                h.appendChild(l);
                w.appendChild(h);
                w.appendChild(el);
                return w;
            };

            // Row 1: Mode + Name
            const row1 = document.createElement('div');
            row1.style.cssText = 'display: grid; grid-template-columns: 260px 1fr; gap: 16px; align-items: start;';
            const nameWrap = document.createElement('div');
            nameWrap.style.cssText = 'display: flex; gap: 12px; align-items: flex-end; width: 100%;';

            const nameInput = window.DuckControls.Input.create({ label: 'Profile Name', placeholder: 'Enter profile name...', icon: 'badge' });
            nameInput.element.style.flex = '1';

            const qtySpin = window.DuckControls.SpinNumber.create({ value: 1, min: 1, max: 100 });
            const qtyWrap = document.createElement('div');
            qtyWrap.style.cssText = 'display: none; width: 120px; flex-direction: column; gap: 6px;';
            const qtyLabel = document.createElement('label');
            qtyLabel.textContent = 'Quantity';
            qtyLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary);';
            qtyWrap.appendChild(qtyLabel);
            qtyWrap.appendChild(qtySpin.element);
            nameWrap.appendChild(nameInput.element);
            nameWrap.appendChild(qtyWrap);

            const modeToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Single Profile', value: 'single' }, { label: 'Bulk Create', value: 'bulk' }],
                value: 'single', fullWidth: true,
                onChange: (val) => {
                    qtyWrap.style.display = val === 'bulk' ? 'block' : 'none';
                    const lbl = nameInput.element.querySelector('.ui-label-sm');
                    const inp = nameInput.element.querySelector('input');
                    if (val === 'bulk') { if (lbl) lbl.textContent = 'Profile Prefix'; if (inp) inp.placeholder = 'Enter prefix...'; }
                    else { if (lbl) lbl.textContent = 'Profile Name'; if (inp) inp.placeholder = 'Enter profile name...'; }
                }
            });
            row1.appendChild(createLabelWrap('Creation Mode', modeToggle.element));
            row1.appendChild(nameWrap);
            topForm.appendChild(row1);

            // Row 2: Group + Tags (wired to backend)
            const row2 = document.createElement('div');
            row2.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 16px;';

            const groupSelect = window.DuckControls.Select.create({
                label: 'Group',
                placeholder: 'Select group...',
                options: this._buildGroupOptions(),
                actions: [{ text: '+ Create', icon: 'add', onClick: () => this._quickCreateGroup() }]
            });
            this._groupCtrl = groupSelect;

            const tagSelect = window.DuckControls.MultiSelectComboBox.create({
                label: 'Tags',
                placeholder: 'Select tags...',
                options: this._buildTagOptions(),
                actions: [{ text: '+ Create', icon: 'add', onClick: () => this._quickCreateTag() }]
            });
            this._tagCtrl = tagSelect;

            row2.appendChild(groupSelect.element);
            row2.appendChild(tagSelect.element);
            topForm.appendChild(row2);
            leftCol.appendChild(topForm);

            // ── Tabs ────────────────────────────────────────────────────────
            const tabsWrap = document.createElement('div');
            tabsWrap.style.cssText = 'flex: 1; display: flex; flex-direction: column; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border-default); overflow: hidden; min-height: 0;';

            const getTabDOM = (moduleName, title, desc) => {
                const dom = document.createElement('div');
                dom.style.cssText = 'padding: 24px; overflow-y: auto; height: 100%; box-sizing: border-box;';
                if (window.ProfileModals.CreateProfile[moduleName]) {
                    dom.appendChild(window.ProfileModals.CreateProfile[moduleName].render());
                } else {
                    dom.innerHTML = `<h3 style="margin-top:0;">${title}</h3><p style="color:var(--text-secondary);">${desc}</p>`;
                }
                return dom;
            };

            const tabControl = window.DuckControls.TabControl.create({
                tabs: [
                    { id: 'general',  name: 'General',  content: getTabDOM('GeneralTab',  'General',  'General configs.') },
                    { id: 'network',  name: 'Network',  content: getTabDOM('NetworkTab',  'Network',  'Network & proxy configs.') },
                    { id: 'hardware', name: 'Hardware', content: getTabDOM('HardwareTab', 'Hardware', 'Hardware configs.') },
                    { id: 'security', name: 'Security', content: getTabDOM('SecurityTab', 'Security', 'Security configs.') },
                    { id: 'cookies',  name: 'Cookies',  content: getTabDOM('CookiesTab',  'Cookies',  'Cookies configs.') },
                    { id: 'notes',    name: 'Notes',     content: getTabDOM('NotesTab',    'Notes',     'Notes configs.') }
                ]
            });

            tabsWrap.appendChild(tabControl.element);
            leftCol.appendChild(tabsWrap);
            container.appendChild(leftCol);

            // ── RIGHT COLUMN — Summary ───────────────────────────────────────
            const rightCol = document.createElement('div');
            rightCol.style.cssText = 'display: flex; flex-direction: column; width: 260px; min-width: 260px; flex-shrink: 0; background: var(--bg-surface); border-left: 1px solid var(--border-default);';

            const summaryWrap = document.createElement('div');
            summaryWrap.style.cssText = 'flex: 1; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border-default); padding: 16px; display: flex; flex-direction: column; overflow-y: auto;';

            const summaryHeader = document.createElement('div');
            summaryHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;';
            summaryHeader.innerHTML = '<div style="font-size: 14px; font-weight: 600; color: var(--text-primary);">Overview</div>';
            const btnRandom = window.DuckControls.Button.create(null, { text: 'New Fingerprint', variant: 'surface', size: 'sm', icon: 'refresh' });
            summaryHeader.appendChild(btnRandom.element);
            summaryWrap.appendChild(summaryHeader);

            const summaryList = document.createElement('div');
            summaryList.style.cssText = 'display: flex; flex-direction: column; gap: 12px; font-size: 12px;';
            const addSummaryItem = (label, initialVal) => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';
                row.innerHTML = `<div style="color:var(--text-secondary);font-size:11px;font-weight:500;">${label}</div><div style="color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:4px 8px;background:var(--bg-base);border:1px solid var(--border-subtle);border-radius:4px;">${initialVal}</div>`;
                summaryList.appendChild(row);
            };
            addSummaryItem('Operating System', 'Windows 10');
            addSummaryItem('Browser', 'Chromium 138');
            addSummaryItem('User Agent', 'Mozilla/5.0 (Windows NT 10.0...');
            addSummaryItem('Screen Resolution', '1920x1080');
            addSummaryItem('Timezone', 'America/New_York (Match IP)');
            addSummaryItem('Language', 'en-US,en');
            addSummaryItem('Hardware', '8 Cores, 8GB RAM');

            summaryWrap.appendChild(summaryList);
            rightCol.appendChild(summaryWrap);
            container.appendChild(rightCol);

            // ── Modal init ─────────────────────────────────────────────────
            this._modal = window.DuckControls.Modal.create({
                title: 'Create Profile',
                subtitle: 'Configure and generate a new isolated browser fingerprint environment.',
                icon: 'add_circle',
                content: container,
                size: 'xxl',
                buttons: [
                    { text: 'Cancel', variant: 'ghost', onClick: () => this._modal.close() },
                    {
                        text: 'Create Profile', variant: 'primary', icon: 'add',
                        onClick: async () => {
                            const groupVal = this._groupCtrl?.getValue() || '';
                            const tagVals  = this._tagCtrl?.getValues() || [];
                            const payload = {
                                mode:       modeToggle.getValue(),
                                name:       nameInput.getValue(),
                                quantity:   qtySpin.getValue(),
                                groupId:    groupVal ? parseInt(groupVal) : null,
                                tagIds:     tagVals.map(v => parseInt(v)).filter(Boolean),
                            };
                            const tabs = ['GeneralTab', 'NetworkTab', 'HardwareTab', 'SecurityTab', 'CookiesTab', 'NotesTab'];
                            tabs.forEach(tabName => {
                                if (window.ProfileModals.CreateProfile[tabName]?.getValues) {
                                    Object.assign(payload, window.ProfileModals.CreateProfile[tabName].getValues());
                                }
                            });

                            console.log('[DuckGo] Create Profile Payload:', payload);

                            // Wire up real backend call here when ready
                            // try {
                            //   const result = await DuckBridge.call('profile.create', payload);
                            //   window.DuckApp?.refreshCurrentView?.();
                            // } catch (e) { ... }

                            this._modal.close();
                        }
                    }
                ],
                onClose: () => { this._modal = null; this._groupCtrl = null; this._tagCtrl = null; }
            });

            const modalBody = this._modal.container?.querySelector('.duck-modal-body');
            if (modalBody) {
                modalBody.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;padding:0;';
            }

            this._modal.open();
        }
    });
})();
