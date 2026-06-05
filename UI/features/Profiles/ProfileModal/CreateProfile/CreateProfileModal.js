/**
 * CreateProfileModal.js
 *
 * Fingerprint template loaded from backend via profile.getFingerprintTemplate.
 * Cascade: OS select → all OS-dependent controls + Overview sync.
 * Every control change triggers _scheduleSync() → Overview updates live.
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
        _fpTemplate: null,
        _syncTimer: null,
        _browserCatalog: null,

        _collectTabValues() {
            const values = {};
            ['GeneralTab', 'NetworkTab', 'HardwareTab', 'SecurityTab', 'CookiesTab', 'NotesTab'].forEach(tabName => {
                const tab = window.ProfileModals.CreateProfile[tabName];
                if (tab?.getValues) Object.assign(values, tab.getValues());
            });
            return values;
        },

        _normalizeProxyType(type) {
            const value = String(type || 'http').trim().toLowerCase();
            return ['http', 'https', 'socks4', 'socks5'].includes(value) ? value : 'http';
        },

        _proxyLabel(type) {
            const value = this._normalizeProxyType(type);
            if (value === 'https') return 'HTTPS';
            if (value === 'socks4') return 'Socks4';
            if (value === 'socks5') return 'Socks5';
            return 'HTTP/HTTPS';
        },

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

        async _loadFingerprintTemplate() {
            if (this._fpTemplate) return this._fpTemplate;
            try {
                this._fpTemplate = await DuckBridge.call('profile.getFingerprintTemplate');
            } catch (e) {
                console.error('[CreateProfileModal] Failed to load fingerprint template:', e);
                this._fpTemplate = null;
            }
            return this._fpTemplate;
        },

        async _loadBrowserCatalog() {
            if (this._browserCatalog) return this._browserCatalog;
            try {
                this._browserCatalog = await DuckBridge.call('browser.listVersions');
            } catch (e) {
                console.error('[CreateProfileModal] Failed to load browser catalog:', e);
                this._browserCatalog = null;
            }
            return this._browserCatalog;
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

        /** Read all tab values and write them into the Overview panel. */
        _syncSummary() {
            if (!this._modal) return;
            const v = this._collectTabValues();
            const groupText = this._groupCtrl?.getOptions?.().find(o => String(o.value) === String(this._groupCtrl?.getValue?.() || ''))?.label || 'None';
            const tagValues = this._tagCtrl?.getValues?.() || [];
            const tagText = tagValues.length
                ? tagValues.map(val => this._tagCtrl?.getOptions?.().find(o => String(o.value) === String(val))?.label || String(val)).join(', ')
                : 'None';

            const set = (label, text) => {
                const el = this._modal.container.querySelector(
                    `.duck-summary-item-value[data-label="${label}"]`
                );
                if (el) el.textContent = text;
            };

            set('Start URL', v.startUrl || 'chrome://newtab');
            set('Group', groupText);
            set('Tags', tagText);
            set('Operating System', v.os || 'Windows');
            set('OS Model', v.osModel || 'Auto');
            set('Browser', `Chromium ${v.browserVersion || '138'}`);
            set('User Agent', v.userAgent || 'Auto-generated');
            set('Screen Resolution', this._fmtResolution(v));
            set('Timezone', v.timezone || 'Auto (Match IP)');
            set('Language', this._fmtLanguages(v.languages));
            set('Proxy', this._fmtProxy(v));
            set('Coordinates', v.locationMode === 'custom' && v.customCoordinates ? `${v.customCoordinates.lat || '-'}, ${v.customCoordinates.lng || '-'} (±${v.customCoordinates.accuracy || 100}m)` : this._fmtCoordinates(v));
            set('Hardware', this._fmtHardware(v));
            set('WebGL', this._fmtWebGL(v));
            set('Fonts', v.fontsMode === 'custom' ? (v.customFonts?.join(', ') || 'None') : 'Default');
            set('WebRTC', v.webrtcMode || 'disable');
            set('SSL', v.sslMode || 'noise');
            set('Ports', v.portBlockMode || v.portScan || 'protect');
            set('Media', v.mediaDevices || 'noise');
            set('Speech', v.speechVoices || 'noise');
            set('Rects', v.clientRects || 'noise');
        },

        _fmtResolution(v) {
            if (v.screenMode === 'custom' && v.screenWidth) return `${v.screenWidth}×${v.screenHeight}`;
            if (v.screenMode === 'random') return 'Random';
            return v.screenPreset || '1920×1080';
        },

        _fmtLanguages(langs) {
            if (!langs || !langs.length) return 'en-US, en';
            const labels = langs.map(l => _LANG_LABELS[l] || l);
            return labels.slice(0, 3).join(', ') + (labels.length > 3 ? ` +${labels.length - 3}` : '');
        },

        _fmtCoordinates(v) {
            if (v.locationMode === 'real') return 'Real location';
            if (v.locationMode === 'noise') return 'Noise around IP';
            return 'Disabled';
        },

        _fmtHardware(v) {
            return `${v.concurrency || 8} Cores, ${v.deviceMemory || 8} GB RAM`;
        },

        _fmtWebGL(v) {
            if (v.webglMode === 'real') return 'Real (no spoof)';
            if (v.webglMode === 'random') return 'Random spoofed';
            if (v.webglVendor && v.webglRenderer) {
                const short = v.webglRenderer.length > 40 ? v.webglRenderer.substring(0, 40) + '...' : v.webglRenderer;
                return `${v.webglVendor}\n${short}`;
            }
            return 'Random spoofed';
        },

        _fmtProxy(v) {
            if (v.proxyMode === 'none') return 'Without Proxy';
            if (v.proxyMode === 'saved') {
                const label = v.proxyDisplayName || `Saved Proxy #${v.savedProxyId || '-'}`;
                return `${label} (${this._proxyLabel(v.proxyProtocol)})`;
            }
            if (v.proxyMode === 'custom' && v.customProxy) {
                return `${this._proxyLabel(v.customProxy.type)}://${v.customProxy.host || '-'}:${v.customProxy.port || '-'}`;
            }
            return 'None';
        },

        _fmtSecurity(v) {
            return [
                `WebRTC: ${v.webrtcMode || 'disable'}`,
                `SSL: ${v.sslMode || 'noise'}`,
                `Ports: ${v.portScan || 'protect'}`,
                `Media: ${v.mediaDevices || 'noise'}`,
                `Speech: ${v.speechVoices || 'noise'}`,
                `Rects: ${v.clientRects || 'noise'}`
            ].join('\n');
        },

        /** Debounced sync — call whenever any control changes. */
        _scheduleSync() {
            if (this._syncTimer) clearTimeout(this._syncTimer);
            this._syncTimer = setTimeout(() => this._syncSummary(), 50);
        },

        /**
         * Cascade all OS-dependent controls from template.
         * Called by GeneralTab OS select onChange.
         */
        _cascadeOsChange(osValue) {
            const tmpl = this._fpTemplate;
            if (!tmpl || !osValue) return;

            const genTab = window.ProfileModals.CreateProfile.GeneralTab;
            const hwTab  = window.ProfileModals.CreateProfile.HardwareTab;
            const netTab = window.ProfileModals.CreateProfile.NetworkTab;
            const secTab = window.ProfileModals.CreateProfile.SecurityTab;
            const osBlock = tmpl.OS?.[osValue];

            // ── GeneralTab: OS model select ────────────────────────────────
            const osModels = (osBlock?.Models || []).map(m => ({ label: m.Name, value: m.Name }));
            if (genTab?.osModelSelect) {
                genTab.osModelSelect.setOptions(osModels);
                if (osModels.length > 0) genTab.osModelSelect.setValue(osModels[0].value);
            }

            // ── HardwareTab ────────────────────────────────────────────────
            if (hwTab) {
                hwTab._currentOsBlock = osBlock;

                // HardwareTiers → cpuChipSelect (value = "Concurrency-Memory")
                const tiers = osBlock?.HardwareTiers || [];
                const cpuTierOpts = tiers.map(t => ({
                    label: `${t.Concurrency} Cores / ${t.Memory} GB`,
                    value: `${t.Concurrency}-${t.Memory}`
                }));
                if (hwTab.cpuChipSelect) {
                    hwTab.cpuChipSelect.setOptions(cpuTierOpts);
                    if (cpuTierOpts.length > 0) {
                        hwTab.cpuChipSelect.setValue(cpuTierOpts[0].value);
                    }
                }

                // ScreenPresets → resChipSelect
                const presets = osBlock?.ScreenPresets || [];
                const resOpts = presets.map(p => ({
                    label: `${p.Width} × ${p.Height} @${p.PixelRatio}x`,
                    value: `${p.Width}x${p.Height}x${p.PixelRatio}`
                }));
                if (hwTab.resChipSelect) {
                    hwTab.resChipSelect.setOptions(resOpts);
                    if (resOpts.length > 0) hwTab.resChipSelect.setValue(resOpts[0].value);
                }

                // WebGL vendors → cascade to vendor + renderer
                const vendors = osBlock?.WebGL?.VendorGPUs
                    ? Object.keys(osBlock.WebGL.VendorGPUs)
                    : ['Google Inc. (NVIDIA)'];
                const vendorOpts = vendors.map(v => ({ label: v, value: v }));

                if (hwTab._webglVendorSelect) {
                    hwTab._webglVendorSelect.setOptions(vendorOpts);
                    if (vendorOpts.length > 0) {
                        const randomVendor = vendorOpts[Math.floor(Math.random() * vendorOpts.length)].value;
                        hwTab._webglVendorSelect.setValue(randomVendor);
                    }
                }

                // WebGL renderer for selected vendor
                const selectedVendor = hwTab._webglVendorSelect ? hwTab._webglVendorSelect.getValue() : vendorOpts[0]?.value;
                if (hwTab._rendererSelect && osBlock?.WebGL?.VendorGPUs?.[selectedVendor]) {
                    const renderers = osBlock.WebGL.VendorGPUs[selectedVendor];
                    const rendererOpts = renderers.map(r => ({ label: r, value: r }));
                    hwTab._rendererSelect.setOptions(rendererOpts);
                    if (rendererOpts.length > 0) {
                        const randomRenderer = rendererOpts[Math.floor(Math.random() * rendererOpts.length)].value;
                        hwTab._rendererSelect.setValue(randomRenderer);
                    }
                }

                // Randomize default values for Random modes
                hwTab._randomizeTier?.();
                hwTab._randomizeResolution?.();
                hwTab._randomizeWebGL?.();
            }

            // ── NetworkTab: language options + timezone ────────────────────
            if (netTab) {
                if (netTab._langTagInput) {
                    const langOpts = (tmpl.Languages || []).map(l => ({
                        label: _LANG_LABELS[l] || l,
                        value: l
                    }));
                    netTab._langTagInput.setOptions(langOpts);
                    // Seed default: en-US + en
                    const enOpts = langOpts.filter(o => ['en-US', 'en'].includes(o.value));
                    netTab._langTagInput.setValues(enOpts.map(o => o.value));
                }
                if (netTab._tzSelect) {
                    const tzOpts = (tmpl.Timezones || []).map(tz => ({ label: tz, value: tz }));
                    netTab._tzSelect.setOptions([{ label: 'Auto (Match IP)', value: 'auto' }, ...tzOpts]);
                    netTab._tzSelect.setValue('auto');
                }
            }

            // ── SecurityTab: font options ─────────────────────────────────
            if (secTab) {
                if (secTab._fontTagInput) {
                    const fontOpts = (osBlock?.Fonts || []).map(f => ({ label: f, value: f }));
                    secTab._fontTagInput.setOptions(fontOpts);
                    // Seed default: first 3 fonts
                    secTab._fontTagInput.setValues(fontOpts.slice(0, 3).map(o => o.value));
                }
            }

            this._scheduleSync();
        },

        /** Called when WebGL vendor changes — update renderer select. */
        _cascadeVendorChange(vendor) {
            const tmpl = this._fpTemplate;
            const genTab = window.ProfileModals.CreateProfile.GeneralTab;
            const hwTab  = window.ProfileModals.CreateProfile.HardwareTab;
            const osVal = genTab?._osSelectCtrl?.getValue() || 'Windows';
            const osBlock = tmpl?.OS?.[osVal];

            if (hwTab) hwTab._currentOsBlock = osBlock;

            if (this._rendererSelect && osBlock?.WebGL?.VendorGPUs?.[vendor]) {
                const renderers = osBlock.WebGL.VendorGPUs[vendor];
                const opts = renderers.map(r => ({ label: r, value: r }));
                this._rendererSelect.setOptions(opts);
                if (opts.length) this._rendererSelect.setValue(opts[0].value);
            }

            this._scheduleSync();
        },

        /** Deferred WebGL vendor cascade — waits for ContextMenu to close after setValue. */
        _scheduleVendorCascade(vendor) {
            if (this._vendorCascadeTimer) clearTimeout(this._vendorCascadeTimer);
            this._vendorCascadeTimer = setTimeout(() => {
                this._cascadeVendorChange(vendor);
            }, 150);
        },

        async show() {
            if (this._modal) { this._modal.destroy(); this._modal = null; }
            this._modal = null;

            // ── Loading / Error state ───────────────────────────────────────
            const loadingWrap = document.createElement('div');
            loadingWrap.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; height: 100%; gap: 16px;';
            const spinner = document.createElement('div');
            spinner.style.cssText = 'width: 40px; height: 40px; border: 3px solid var(--border-default); border-top-color: var(--accent); border-radius: 50%; animation: duckSpin 0.8s linear infinite;';
            const spinKeyframes = document.createElement('style');
            spinKeyframes.textContent = '@keyframes duckSpin { to { transform: rotate(360deg); } }';
            loadingWrap.appendChild(spinKeyframes);
            loadingWrap.appendChild(spinner);
            const loadingLabel = document.createElement('div');
            loadingLabel.style.cssText = 'font-size: 13px; color: var(--text-secondary);';
            loadingLabel.textContent = 'Loading profile data...';
            loadingWrap.appendChild(loadingLabel);

            // Error state (hidden until needed)
            const errorWrap = document.createElement('div');
            errorWrap.style.cssText = 'display: none; flex-direction: column; align-items: center; justify-content: center; flex: 1; height: 100%; gap: 12px; text-align: center; padding: 24px;';
            const errorIcon = document.createElement('span');
            errorIcon.className = 'material-symbols-outlined';
            errorIcon.style.cssText = 'font-size: 36px; color: var(--danger);';
            errorIcon.textContent = 'error_outline';
            errorWrap.appendChild(errorIcon);
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = 'font-size: 13px; color: var(--text-secondary); max-width: 320px; line-height: 1.6;';
            errorWrap.appendChild(errorMsg);

            const loadingContent = document.createElement('div');
            loadingContent.style.cssText = 'display: flex; flex-direction: column; flex: 1; height: 100%;';
            loadingContent.appendChild(loadingWrap);
            loadingContent.appendChild(errorWrap);

            // Modal — submit button disabled until data loads
            this._modal = window.DuckControls.Modal.create({
                defaultEnter: true,
                title: 'Create Profile',
                subtitle: 'Configure and generate a new isolated browser fingerprint environment.',
                icon: 'add_circle',
                content: loadingContent,
                size: 'xxl',
                buttons: [
                    { text: 'Cancel', variant: 'ghost', onClick: () => this._modal?.close() },
                    {
                        text: 'Create Profile', variant: 'primary', icon: 'add', disabled: true,
                        onClick: async () => { /* wired after form loads */ }
                    }
                ],
                onClose: () => {
                    this._modal = null;
                    this._groupCtrl = null;
                    this._tagCtrl = null;
                    this._webglVendorSelect = null;
                    this._rendererSelect = null;
                    this._langTagInput = null;
                    this._fontTagInput = null;
                    if (this._syncTimer) clearTimeout(this._syncTimer);
                }
            });

            const showError = (msg) => {
                errorMsg.textContent = msg;
                loadingWrap.style.display = 'none';
                errorWrap.style.display = 'flex';
                const submitBtn = this._modal?.container?.querySelector('.duck-btn-primary');
                if (submitBtn) submitBtn.disabled = true;
            };

            this._modal.open();

            // ── Load data ───────────────────────────────────────────────────
            await this._loadEntityData();

            const [template, browserCatalog] = await Promise.all([
                this._loadFingerprintTemplate(),
                this._loadBrowserCatalog()
            ]);

            if (!template || !browserCatalog) {
                showError('Failed to load profile data. Please check your connection and try again.');
                return;
            }

            this._fpTemplate = template;
            this._browserCatalog = browserCatalog;

            // ── Build form and replace skeleton ─────────────────────────────
            const container = this._buildFormContainer(template, browserCatalog);

            const modalBody = this._modal?.container?.querySelector('.duck-modal-body');
            if (modalBody) {
                modalBody.innerHTML = '';
                modalBody.appendChild(container);
                modalBody.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;padding:0;';
            }

            // Enable submit button now that form is ready
            const submitBtn = this._modal?.container?.querySelector('.duck-btn-primary');
            if (submitBtn) {
                submitBtn.disabled = false;
            }
        },

        _buildFormContainer(template, browserCatalog) {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; gap: 0; flex: 1; background: var(--bg-surface); border-radius: 8px; overflow: hidden; height: 100%; border: 1px solid var(--border-default);';

            // 1. LEFT PANE (Navigation)
            const leftPane = document.createElement('div');
            leftPane.style.cssText = 'width: 200px; min-width: 200px; display: flex; flex-direction: column; background: var(--bg-subtle); border-right: 1px solid var(--border-default);';

            const navList = document.createElement('div');
            navList.className = 'scrollbar-thin';
            navList.style.cssText = 'display: flex; flex-direction: column; padding: 12px 8px; gap: 4px; overflow-y: auto; flex: 1;';
            leftPane.appendChild(navList);
            container.appendChild(leftPane);

            // 2. MIDDLE PANE (Main Content)
            const middlePane = document.createElement('div');
            middlePane.style.cssText = 'flex: 1; display: flex; flex-direction: column; min-width: 0; background: var(--bg-surface); position: relative;';

            // Sticky Header for Name/Group/Tags
            const stickyHeader = document.createElement('div');
            stickyHeader.style.cssText = 'display: flex; flex-direction: column; gap: 16px; padding: 20px 24px; border-bottom: 1px solid var(--border-default); background: var(--bg-surface); z-index: 10;';

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
            row1.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; gap: 16px; align-items: start;';
            
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
            stickyHeader.appendChild(row1);

            // Row 2: Group + Tags
            const row2 = document.createElement('div');
            row2.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 16px;';

            const groupSelect = window.DuckControls.Select.create({
                label: 'Group',
                placeholder: 'Select group...',
                options: this._buildGroupOptions()
            });
            this._groupCtrl = groupSelect;

            const tagSelect = window.DuckControls.MultiSelectComboBox.create({
                label: 'Tags',
                placeholder: 'Select tags...',
                options: this._buildTagOptions()
            });
            this._tagCtrl = tagSelect;

            row2.appendChild(groupSelect.element);
            row2.appendChild(tagSelect.element);
            stickyHeader.appendChild(row2);
            middlePane.appendChild(stickyHeader);

            // Scrollable Content Area for Tabs
            const contentArea = document.createElement('div');
            contentArea.className = 'scrollbar-thin';
            contentArea.style.cssText = 'flex: 1; overflow-y: auto; overflow-x: hidden; padding: 24px; box-sizing: border-box;';
            middlePane.appendChild(contentArea);
            container.appendChild(middlePane);

            // Setup Custom Tabs
            const getTabDOM = (moduleName, title, desc) => {
                const dom = document.createElement('div');
                dom.style.cssText = 'height: 100%; box-sizing: border-box; display: none;';
                if (window.ProfileModals.CreateProfile[moduleName]) {
                    dom.appendChild(window.ProfileModals.CreateProfile[moduleName].render());
                } else {
                    const h3 = document.createElement('h3');
                    h3.style.marginTop = '0';
                    h3.textContent = title;
                    const p = document.createElement('p');
                    p.style.color = 'var(--text-secondary)';
                    p.textContent = desc;
                    dom.appendChild(h3);
                    dom.appendChild(p);
                }
                return dom;
            };

            const tabsData = [
                { id: 'general',  name: 'General',  icon: 'settings',      content: getTabDOM('GeneralTab',  'General',  '') },
                { id: 'network',  name: 'Network',  icon: 'language',      content: getTabDOM('NetworkTab',  'Network',  '') },
                { id: 'hardware', name: 'Hardware', icon: 'memory',        content: getTabDOM('HardwareTab', 'Hardware', '') },
                { id: 'security', name: 'Security', icon: 'security',      content: getTabDOM('SecurityTab', 'Security', '') },
                { id: 'cookies',  name: 'Cookies',  icon: 'cookie',        content: getTabDOM('CookiesTab',  'Cookies',  '') },
                { id: 'notes',    name: 'Notes',    icon: 'edit_note',     content: getTabDOM('NotesTab',    'Notes',    '') }
            ];

            let activeTabId = 'general';
            const navItems = [];

            tabsData.forEach(tab => {
                contentArea.appendChild(tab.content);

                const btn = document.createElement('div');
                btn.className = 'duck-tabcontrol-item';
                
                const btnInner = document.createElement('div');
                btnInner.style.cssText = 'display: flex; align-items: center; gap: 10px;';
                const btnIcon = document.createElement('span');
                btnIcon.className = 'material-symbols-outlined';
                btnIcon.style.fontSize = '18px';
                btnIcon.textContent = tab.icon;
                const btnText = document.createElement('span');
                btnText.style.fontWeight = 'inherit';
                btnText.textContent = tab.name;
                btnInner.appendChild(btnIcon);
                btnInner.appendChild(btnText);
                btn.appendChild(btnInner);
                
                btn.addEventListener('click', () => {
                    activeTabId = tab.id;
                    updateTabs();
                });
                
                navList.appendChild(btn);
                navItems.push({ id: tab.id, btn, content: tab.content });
            });

            const updateTabs = () => {
                navItems.forEach(item => {
                    if (item.id === activeTabId) {
                        item.btn.classList.add('active');
                        item.content.style.display = 'block';
                    } else {
                        item.btn.classList.remove('active');
                        item.content.style.display = 'none';
                    }
                });
            };
            updateTabs(); // init

            // 3. RIGHT PANE (Overview)
            const rightPane = document.createElement('div');
            rightPane.style.cssText = 'width: 280px; min-width: 280px; display: flex; flex-direction: column; background: var(--bg-surface); border-left: 1px solid var(--border-default);';

            const summaryWrap = document.createElement('div');
            summaryWrap.className = 'scrollbar-thin';
            summaryWrap.style.cssText = 'flex: 1; padding: 20px; display: flex; flex-direction: column; overflow-y: auto;';

            const summaryHeader = document.createElement('div');
            summaryHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px;';
            const overviewTitle = document.createElement('div');
            overviewTitle.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary);';
            overviewTitle.textContent = 'Overview';
            summaryHeader.appendChild(overviewTitle);
            
            const btnRandom = window.DuckControls.Button.create(null, { 
                text: 'New', 
                variant: 'surface', 
                size: 'sm', 
                icon: 'refresh',
                onClick: async () => {
                    const tabValues = this._collectTabValues();
                    const genTab = window.ProfileModals.CreateProfile.GeneralTab;
                    const hwTab = window.ProfileModals.CreateProfile.HardwareTab;
                    const netTab = window.ProfileModals.CreateProfile.NetworkTab;
                    const secTab = window.ProfileModals.CreateProfile.SecurityTab;

                    this._modal.setLoading(true, 'Generating new fingerprint...');
                    try {
                        const fp = await DuckBridge.call('profile.generateFingerprint', {
                            platform: tabValues.os || 'Windows',
                            browser:  tabValues.browser || 'chromium',
                            model:    tabValues.osModel || null
                        });

                        if (hwTab) {
                            hwTab._randomizeTier?.();
                            hwTab._randomizeResolution?.();
                            hwTab._randomizeWebGL?.();
                            hwTab.canvasToggle?.setValue?.('noise');
                            hwTab.webglImgToggle?.setValue?.('noise');
                            hwTab.pluginsToggle?.setValue?.('noise');
                            hwTab.webglMetaToggle?.setValue?.('custom');
                        }

                        if (genTab) {
                            genTab.browserVersion?.setValue?.(fp?.browserVersion || tabValues.browserVersion || '138');
                            if (genTab.uaModeToggle?.getValue?.() === 'custom') {
                                genTab.uaInput?.setValue?.(fp?.userAgent || '');
                            }
                        }

                        if (fp?.screen && hwTab?.resToggle) {
                            const parts = String(fp.screen).split('x');
                            if (parts.length >= 2) {
                                const width = parseInt(parts[0], 10);
                                const height = parseInt(parts[1], 10);
                                const presets = hwTab._currentOsBlock?.ScreenPresets || [];
                                const matched = presets.find(p => p.Width === width && p.Height === height);
                                if (matched) {
                                    hwTab.resToggle.setValue('custom');
                                    hwTab.resChipSelect?.setValue?.(`${matched.Width}x${matched.Height}x${matched.PixelRatio}`);
                                }
                            }
                        }

                        if (fp?.webglVendor && hwTab?._webglVendorSelect) {
                            hwTab.webglMetaToggle?.setValue?.('custom');
                            hwTab._webglVendorSelect.setValue(fp.webglVendor);
                            const osBlock = hwTab._currentOsBlock;
                            const renderers = osBlock?.WebGL?.VendorGPUs?.[fp.webglVendor] || [];
                            if (hwTab._rendererSelect) {
                                hwTab._rendererSelect.setOptions(renderers.map(r => ({ label: r, value: r })));
                                hwTab._rendererSelect.setValue(fp.webglRenderer || renderers[0] || '');
                            }
                        }

                        if (fp?.languages && netTab?.langTagInput) {
                            netTab.langTagInput.setValues(String(fp.languages).split(',').map(x => x.trim()).filter(Boolean));
                        }
                        if (fp?.timezone && netTab?.tzSelect) {
                            netTab.tzSelect.setValue(fp.timezone);
                        }
                        if (secTab?.rectsToggle) {
                            secTab.rectsToggle.setValue('noise');
                        }

                        this._modal.setLoading(false);
                        this._syncSummary();
                    } catch (e) {
                        this._modal.setLoading(false);
                        console.warn('[NewFingerprint]', e);
                    }
                }
            });
            btnRandom.element.title = 'Generate a new random fingerprint';
            summaryHeader.appendChild(btnRandom.element);
            summaryWrap.appendChild(summaryHeader);

            const summaryList = document.createElement('div');
            summaryList.style.cssText = 'display: flex; flex-direction: column; gap: 14px; font-size: 12px;';
            
            const addSummaryItem = (label, initialVal) => {
                const row = document.createElement('div');
                row.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
                const valDiv = document.createElement('div');
                valDiv.className = 'duck-summary-item-value';
                valDiv.dataset.label = label;
                valDiv.style.cssText = 'color:var(--text-primary);white-space:pre-wrap;word-break:break-word;padding:6px 10px;background:var(--bg-subtle);border:1px solid var(--border-subtle);border-radius:6px;font-size:12px;line-height:1.5; font-family: monospace;';
                valDiv.textContent = initialVal;
                
                const labelDiv = document.createElement('div');
                labelDiv.style.cssText = 'color:var(--text-secondary);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;';
                labelDiv.textContent = label;
                row.appendChild(labelDiv);
                
                row.appendChild(valDiv);
                summaryList.appendChild(row);
            };
            
            addSummaryItem('Start URL', '—');
            addSummaryItem('Group', '—');
            addSummaryItem('Tags', '—');
            addSummaryItem('Operating System', '—');
            addSummaryItem('OS Model', '—');
            addSummaryItem('Browser', '—');
            addSummaryItem('User Agent', '—');
            addSummaryItem('Screen Resolution', '—');
            addSummaryItem('Timezone', '—');
            addSummaryItem('Language', '—');
            addSummaryItem('Proxy', '—');
            addSummaryItem('Coordinates', '—');
            addSummaryItem('Hardware', '—');
            addSummaryItem('WebGL', '—');
            addSummaryItem('Fonts', '—');
            addSummaryItem('WebRTC', '—');
            addSummaryItem('SSL', '—');
            addSummaryItem('Ports', '—');
            addSummaryItem('Media', '—');
            addSummaryItem('Speech', '—');
            addSummaryItem('Rects', '—');

            summaryWrap.appendChild(summaryList);
            rightPane.appendChild(summaryWrap);
            container.appendChild(rightPane);

            return container;
        },

        _updateFingerprintSummary(fp) {
            if (!fp) return;
            const set = (label, text) => {
                const el = this._modal?.container?.querySelector(
                    `.duck-summary-item-value[data-label="${label}"]`
                );
                if (el) el.textContent = text;
            };
            set('Operating System', fp.platform || 'Windows');
            set('Browser', `Chromium ${fp.browserVersion || '138'}`);
            set('User Agent', fp.userAgent ? fp.userAgent.substring(0, 40) + '...' : '—');
            set('Screen Resolution', fp.screen || '—');
            set('Timezone', fp.timezone || 'Auto');
            set('Language', fp.languages || '—');
            set('Hardware', fp.hardware || '—');
            set('WebGL', `${fp.webglVendor || ''} / ${fp.webglRenderer || ''}`);
        }
    });

    // ── Language display labels ────────────────────────────────────────────
    const _LANG_LABELS = {
        'en-US': 'English (US)', 'en-GB': 'English (UK)', 'en-AU': 'English (Australia)',
        'en-CA': 'English (Canada)', 'en-IN': 'English (India)',
        'de-DE': 'German (Germany)', 'de-AT': 'German (Austria)', 'de-CH': 'German (Swiss)',
        'fr-FR': 'French (France)', 'fr-CA': 'French (Canada)', 'fr-BE': 'French (Belgium)',
        'es-ES': 'Spanish (Spain)', 'es-MX': 'Spanish (Mexico)', 'es-AR': 'Spanish (Argentina)',
        'pt-BR': 'Portuguese (Brazil)', 'pt-PT': 'Portuguese (Portugal)',
        'it-IT': 'Italian', 'nl-NL': 'Dutch', 'pl-PL': 'Polish',
        'cs-CZ': 'Czech', 'hu-HU': 'Hungarian', 'ro-RO': 'Romanian',
        'ru-RU': 'Russian', 'uk-UA': 'Ukrainian', 'tr-TR': 'Turkish',
        'ar-SA': 'Arabic', 'he-IL': 'Hebrew',
        'ja-JP': 'Japanese', 'ko-KR': 'Korean', 'zh-CN': 'Chinese (Simplified)',
        'zh-TW': 'Chinese (Traditional)', 'zh-HK': 'Chinese (Hong Kong)',
        'th-TH': 'Thai', 'vi-VN': 'Vietnamese', 'id-ID': 'Indonesian',
        'ms-MY': 'Malay', 'tl-PH': 'Filipino'
    };
})();
