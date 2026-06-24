(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.NetworkTab = {
        _savedProxies: [],
        _proxyTypes: [],

        _setTemplate(template) {
            this._fpTemplate = template;
            this._populateNetworkOptions(template);
        },

        _populateNetworkOptions(tmpl) {
            if (!tmpl) return;

            // Language options
            if (this._langTagInput) {
                const langOpts = (tmpl.Languages || []).map(l => ({
                    label: l,
                    value: l
                }));
                this._langTagInput.setOptions(langOpts);
            }

            // Timezone options
            if (this.tzSelect) {
                const tzOpts = (tmpl.Timezones || []).map(tz => ({ label: tz, value: tz }));
                this.tzSelect.setOptions([{ label: 'Auto (Match IP)', value: 'auto' }, { label: 'Real', value: 'real' }, ...tzOpts]);
                this.tzSelect.setValue('auto');
            }
        },

        _currentBrowserLanguages() {
            const langs = Array.isArray(navigator.languages) && navigator.languages.length
                ? navigator.languages
                : [navigator.language].filter(Boolean);
            return langs.filter(Boolean);
        },

        _normalizeProxyType(type) {
            const value = String(type || 'http').trim().toLowerCase();
            return ['http', 'https', 'socks4', 'socks5'].includes(value) ? value : 'http';
        },

        _proxyTypeLabel(type) {
            const value = String(type || 'http').trim().toLowerCase();
            const found = this._proxyTypes.find(t =>
                String(t.Value || t.value || '').toLowerCase() === value);
            if (found) return found.Label || found.label || value.toUpperCase();
            return value.toUpperCase();
        },

        _toggleLocationInputs(mode) {
            if (this._coordWrap) {
                this._coordWrap.style.display = mode === 'custom' ? 'flex' : 'none';
            }
        },

        _updateProtocolHint() {
            if (!this._protocolHint) return;
            if (this.proxyTypeToggle?.getValue() === 'saved') {
                const proxy = this._getSelectedSavedProxy();
                this._protocolHint.textContent = proxy
                    ? `Protocol: ${this._proxyTypeLabel(proxy.Type || proxy.type)}`
                    : 'Protocol: —';
                this._protocolHint.style.display = 'block';
                return;
            }

            if (this.proxyTypeToggle?.getValue() === 'custom') {
                this._protocolHint.textContent = `Protocol: ${this._proxyTypeLabel(this.pType?.getValue())}`;
                this._protocolHint.style.display = 'block';
                return;
            }

            this._protocolHint.style.display = 'none';
        },

        _toggleProxyInputs(mode) {
            if (!this._dynamicProxyWrap || !this._customProxyForm || !this._savedProxyForm || !this._checkProxyBtnWrap) return;

            if (mode === 'none') {
                this._dynamicProxyWrap.style.display = 'none';
            } else {
                this._dynamicProxyWrap.style.display = 'flex';
                this._customProxyForm.style.display = mode === 'custom' ? 'flex' : 'none';
                this._savedProxyForm.style.display = mode === 'saved' ? 'flex' : 'none';
                this._checkProxyBtnWrap.style.display = mode === 'none' ? 'none' : 'flex';
            }

            this._updateProtocolHint();
            window.ProfileModals?.CreateProfile?._scheduleSync?.();
        },

        _getSelectedSavedProxy() {
            const selectedId = String(this.sProxy?.getValue?.() || '');
            return this._savedProxies.find(p => String(p.Id || p.id) === selectedId) || null;
        },

        async _loadSavedProxies(savedProxyId = null) {
            try {
                const proxies = await DuckBridge.call('proxy.list', {});
                const groups = await DuckBridge.call('proxygroup.list', {});
                const tags = await DuckBridge.call('proxytag.list', {});
                
                this._savedProxies = Array.isArray(proxies?.Items || proxies) ? (proxies?.Items || proxies) : [];
                this._proxyGroups = Array.isArray(groups) ? groups : [];
                this._proxyTags = Array.isArray(tags) ? tags : [];
            } catch (e) {
                console.warn('[NetworkTab] Failed to load proxies metadata', e);
                this._savedProxies = [];
                this._proxyGroups = [];
                this._proxyTags = [];
            }

            if (this.sGroup) {
                const groupOpts = [{ label: 'All Groups', value: '' }];
                this._proxyGroups.forEach(g => groupOpts.push({ label: g.Name || g.name, value: String(g.Id || g.id) }));
                this.sGroup.setOptions(groupOpts);
            }

            if (this.sTags) {
                const tagOpts = this._proxyTags.map(t => ({ label: t.Name || t.name, value: String(t.Id || t.id) }));
                this.sTags.setOptions(tagOpts);
            }

            let proxyToSelect = null;
            if (savedProxyId != null) {
                const proxyIdStr = String(savedProxyId);
                proxyToSelect = this._savedProxies.find(p => String(p.Id || p.id) === proxyIdStr);
                if (proxyToSelect) {
                    const groupId = proxyToSelect.GroupId || proxyToSelect.groupId;
                    const tagIds = proxyToSelect.TagIds || proxyToSelect.tagIds || [];
                    if (groupId && this.sGroup) this.sGroup.setValue(String(groupId));
                    if (tagIds.length > 0 && this.sTags) this.sTags.setValues(tagIds.map(String));
                }
            }

            this._filterSavedProxies(savedProxyId);
            this._loadProxyTypes();
        },

        _filterSavedProxies(forceSelectId = null) {
            const groupId = this.sGroup?.getValue?.();
            const tagIds = this.sTags?.getValues?.() || [];

            const filtered = this._savedProxies.filter(proxy => {
                if (groupId && groupId !== '') {
                    const pGroupId = String(proxy.GroupId || proxy.groupId || '');
                    if (pGroupId !== String(groupId)) return false;
                }
                if (tagIds.length > 0) {
                    const pTagIds = (proxy.TagIds || proxy.tagIds || []).map(String);
                    const hasTag = tagIds.some(id => pTagIds.includes(String(id)));
                    if (!hasTag) return false;
                }
                return true;
            });

            const options = filtered.map(proxy => {
                const id = String(proxy.Id || proxy.id);
                const name = proxy.Name || proxy.name || '';
                return { label: name ? `${id} - ${name}` : `Proxy #${id}`, value: id };
            });

            if (options.length === 0) {
                options.push({ label: 'No proxies found', value: '' });
            } else {
                options.unshift({ label: 'Select Proxy...', value: '' });
            }

            if (this.sProxy) {
                this.sProxy.setOptions(options);
                const currentVal = forceSelectId != null ? String(forceSelectId) : this.sProxy.getValue();
                const exists = options.some(o => o.value === currentVal);
                
                if (exists && currentVal) {
                    this.sProxy.setValue(currentVal);
                } else if (options.length > 0 && options[0].value !== '') {
                    this.sProxy.setValue(options[0].value);
                } else {
                    this.sProxy.setValue('');
                }
                this._updateProtocolHint();
            }
        },

        async _loadProxyTypes() {
            try {
                const types = await DuckBridge.call('proxyType.list');
                this._proxyTypes = Array.isArray(types) ? types : [];
            } catch (e) {
                console.warn('[NetworkTab] Failed to load proxy types', e);
                this._proxyTypes = [];
            }

            if (this.pType && this._proxyTypes.length > 0) {
                const options = this._proxyTypes.map(t => ({
                    label: t.Label || t.label || String(t.Value || t.value || ''),
                    value: t.Value || t.value || ''
                }));
                this.pType.setOptions(options);
                if (options.length > 0 && !this.pType.getValue()) {
                    this.pType.setValue(options[0].value);
                }
            }
        },

        async _setCurrentCoordinates() {
            const setCoords = (lat, lng, acc) => {
                this.locationModeToggle?.setValue?.('custom');
                this._toggleLocationInputs('custom');
                this.latIn?.setValue?.(String(lat));
                this.lngIn?.setValue?.(String(lng));
                if (this.accuracySpin) this.accuracySpin.setValue(Math.round(acc));
                window.ProfileModals?.CreateProfile?._scheduleSync?.();
            };

            const fetchByIp = async () => {
                try {
                    const res = await DuckBridge.call('system.getIpLocation');
                    if (res && res.lat && res.lng) {
                        setCoords(res.lat, res.lng, res.accuracy || 1000);
                        return;
                    }
                } catch (e) {}

                try {
                    const ipRes = await fetch('https://ipapi.co/json/');
                    const ipData = await ipRes.json();
                    if (ipData && ipData.latitude && ipData.longitude) {
                        setCoords(ipData.latitude, ipData.longitude, 1000);
                    }
                } catch (err) {
                }
            };

            if (!navigator.geolocation) {
                await fetchByIp();
                return;
            }

            navigator.geolocation.getCurrentPosition((pos) => {
                setCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy || 100);
            }, async () => {
                await fetchByIp();
            }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 });
        },

        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 24px; width: 100%;';

            const header = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.style.cssText = 'margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;';
            h2.textContent = 'Network & Geolocation';
            const subtitle = document.createElement('div');
            subtitle.style.cssText = 'font-size: 13px; color: var(--text-secondary); line-height: 1.5;';
            subtitle.textContent = 'Configure proxy connections, timezone, language bindings, and geolocation coordinates.';
            header.appendChild(h2);
            header.appendChild(subtitle);
            container.appendChild(header);

            const proxySec = document.createElement('div');
            proxySec.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

            this.proxyTypeToggle = window.DuckControls.ToggleGroup.create({
                options: [
                    { label: 'Without Proxy', value: 'none' },
                    { label: 'Custom Proxy', value: 'custom' },
                    { label: 'Saved Proxy', value: 'saved' }
                ],
                value: 'none',
                onChange: (val) => this._toggleProxyInputs(val)
            });

            const dynamicProxyWrap = document.createElement('div');
            dynamicProxyWrap.style.cssText = 'display: none; flex-direction: column; gap: 16px; margin-top: 4px; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px;';
            this._dynamicProxyWrap = dynamicProxyWrap;

            const customProxyForm = document.createElement('div');
            customProxyForm.style.cssText = 'display: none; flex-direction: column; gap: 16px;';
            this._customProxyForm = customProxyForm;

            const hostPortRow = document.createElement('div');
            hostPortRow.style.cssText = 'display: grid; grid-template-columns: 140px 1fr 120px; gap: 12px; align-items: end;';
            this.pType = window.DuckControls.Select.create({
                label: 'Protocol',
                options: [],
                value: 'http',
                onChange: () => {
                    this._updateProtocolHint();
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            this.pHost = window.DuckControls.Input.create({
                label: 'IP',
                placeholder: '127.0.0.1',
                icon: 'dns',
                onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            this.pPort = window.DuckControls.Input.create({
                label: 'Port',
                placeholder: '8080',
                icon: 'settings_ethernet',
                onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            hostPortRow.appendChild(this.pType.element);
            hostPortRow.appendChild(this.pHost.element);
            hostPortRow.appendChild(this.pPort.element);

            this.pUser = window.DuckControls.Input.create({
                label: 'Username',
                placeholder: 'Username',
                icon: 'person',
                onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            this.pPass = window.DuckControls.Input.create({
                label: 'Password',
                placeholder: 'Password',
                icon: 'key',
                onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });

            customProxyForm.appendChild(hostPortRow);
            customProxyForm.appendChild(this.pUser.element);
            customProxyForm.appendChild(this.pPass.element);

            const savedProxyForm = document.createElement('div');
            savedProxyForm.style.cssText = 'display: none; flex-direction: column; gap: 12px;';
            this._savedProxyForm = savedProxyForm;

            const filterRow = document.createElement('div');
            filterRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px;';

            this.sGroup = window.DuckControls.Select.create({
                label: 'Proxy Group',
                options: [{ label: 'All Groups', value: '' }],
                onChange: () => this._filterSavedProxies()
            });

            this.sTags = window.DuckControls.MultiSelectComboBox.create({
                label: 'Proxy Tags',
                options: [],
                onChange: () => this._filterSavedProxies()
            });

            filterRow.appendChild(this.sGroup.element);
            filterRow.appendChild(this.sTags.element);
            savedProxyForm.appendChild(filterRow);

            this.sProxy = window.DuckControls.Select.create({
                label: 'Saved Proxy',
                options: [{ label: 'Loading proxies...', value: '' }],
                onChange: () => {
                    this._updateProtocolHint();
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            savedProxyForm.appendChild(this.sProxy.element);

            const protocolHint = document.createElement('div');
            protocolHint.style.cssText = 'display:none; font-size:12px; color: var(--text-secondary);';
            this._protocolHint = protocolHint;
            dynamicProxyWrap.appendChild(protocolHint);

            // ── Proxy status indicator ──────────────────────────────────────
            const proxyStatusWrap = document.createElement('div');
            proxyStatusWrap.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-default); background: var(--bg-subtle); min-height: 36px; transition: all 0.2s ease;';
            proxyStatusWrap.style.display = 'none';

            const statusDot = document.createElement('span');
            statusDot.style.cssText = 'width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); flex-shrink: 0; transition: background 0.3s ease;';
            proxyStatusWrap.appendChild(statusDot);

            const statusLabel = document.createElement('span');
            statusLabel.style.cssText = 'font-size: 12px; color: var(--text-secondary); transition: color 0.3s ease;';
            statusLabel.textContent = 'Not checked yet';
            proxyStatusWrap.appendChild(statusLabel);

            const latencyLabel = document.createElement('span');
            latencyLabel.style.cssText = 'font-size: 11px; color: var(--text-muted); margin-left: auto;';
            proxyStatusWrap.appendChild(latencyLabel);

            this._proxyStatusWrap = proxyStatusWrap;
            this._proxyStatusDot = statusDot;
            this._proxyStatusLabel = statusLabel;
            this._proxyLatencyLabel = latencyLabel;
            dynamicProxyWrap.appendChild(proxyStatusWrap);

            const _setProxyStatus = (status, latencyMs) => {
                proxyStatusWrap.style.display = 'flex';
                if (status === 'alive') {
                    proxyStatusWrap.style.borderColor = 'var(--success)';
                    proxyStatusWrap.style.background = 'rgba(34, 197, 94, 0.08)';
                    statusDot.style.background = 'var(--success)';
                    statusLabel.textContent = latencyMs != null ? `Connected — ${latencyMs}ms` : 'Connected';
                    statusLabel.style.color = 'var(--success)';
                    latencyLabel.textContent = latencyMs != null ? `${latencyMs}ms` : '';
                } else if (status === 'not_found') {
                    proxyStatusWrap.style.borderColor = 'var(--warning)';
                    proxyStatusWrap.style.background = 'rgba(245, 158, 11, 0.08)';
                    statusDot.style.background = 'var(--warning)';
                    statusLabel.textContent = 'Proxy not found';
                    statusLabel.style.color = 'var(--warning)';
                    latencyLabel.textContent = '';
                } else {
                    proxyStatusWrap.style.borderColor = 'var(--danger, var(--danger))';
                    proxyStatusWrap.style.background = 'rgba(239, 68, 68, 0.08)';
                    statusDot.style.background = 'var(--danger, var(--danger))';
                    statusLabel.textContent = latencyMs != null ? `Connection failed — ${latencyMs}ms` : 'Connection failed';
                    statusLabel.style.color = 'var(--danger, var(--danger))';
                    latencyLabel.textContent = latencyMs != null ? `${latencyMs}ms` : '';
                }
            };
            this._setProxyStatus = _setProxyStatus;
            // ─────────────────────────────────────────────────────────────

            dynamicProxyWrap.appendChild(customProxyForm);
            dynamicProxyWrap.appendChild(savedProxyForm);

            const checkProxyBtnWrap = document.createElement('div');
            checkProxyBtnWrap.style.cssText = 'display: flex; justify-content: flex-end; margin-top: 4px;';
            this._checkProxyBtnWrap = checkProxyBtnWrap;
            const checkProxyBtn = window.DuckControls.Button.create(null, {
                text: 'Check Proxy',
                variant: 'surface',
                icon: 'network_check',
                onClick: async () => {
                    const mode = this.proxyTypeToggle?.getValue?.() || 'none';
                    if (mode === 'none') {
                        return;
                    }

                    const originalText = checkProxyBtn.element.querySelector('span:not(.material-symbols-outlined)')?.textContent || 'Check Proxy';
                    const iconEl = checkProxyBtn.element.querySelector('.material-symbols-outlined');
                    const textEl = checkProxyBtn.element.querySelector('span:not(.material-symbols-outlined)');
                    if (iconEl) iconEl.textContent = 'hourglass_empty';
                    if (textEl) textEl.textContent = 'Checking...';
                    checkProxyBtn.element.style.pointerEvents = 'none';

                    try {
                        let res;
                        if (mode === 'saved') {
                            const id = parseInt(this.sProxy?.getValue?.() || '0', 10);
                            if (!id) {
                                return;
                            }
                            res = await DuckBridge.call('proxy.check', { id });
                        } else {
                            const payload = {
                                type: this._normalizeProxyType(this.pType?.getValue?.()),
                                host: this.pHost?.getValue?.() || '',
                                port: parseInt(this.pPort?.getValue?.() || '0', 10),
                                username: this.pUser?.getValue?.() || '',
                                password: this.pPass?.getValue?.() || ''
                            };
                            res = await DuckBridge.call('proxy.check', payload);
                        }

                        const status = res?.status || res?.Status || 'dead';
                        const latency = res?.latency || res?.Latency || null;
                        this._setProxyStatus?.(status, latency);

                        if (status === 'dead') {
                        }
                    } catch (e) {
                        this._setProxyStatus?.('dead', null);
                    } finally {
                        if (iconEl) iconEl.textContent = 'network_check';
                        if (textEl) textEl.textContent = originalText;
                        checkProxyBtn.element.style.pointerEvents = '';
                    }
                }
            });
            checkProxyBtnWrap.appendChild(checkProxyBtn.element);
            dynamicProxyWrap.appendChild(checkProxyBtnWrap);

            proxySec.appendChild(window.DuckControls.SettingRow.create({ title: 'Connection Type', desc: 'Select how this profile connects to the internet', control: this.proxyTypeToggle.element, alignTop: true }).element);
            proxySec.appendChild(dynamicProxyWrap);

            container.appendChild(window.DuckControls.Card.create({ title: 'Proxy Settings', icon: 'router', desc: 'Route traffic through dedicated IP addresses', content: proxySec }).element);

            const geoSec = document.createElement('div');
            geoSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

            this.tzSelect = window.DuckControls.ComboBox.create({
                label: '',
                placeholder: 'Search timezone...',
                options: [{ label: 'Auto (Match IP)', value: 'auto' }, { label: 'Real', value: 'real' }],
                value: 'auto',
                onChange: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            this.tzSelect.element.style.width = '300px';
            geoSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Timezone', desc: 'Override local machine timezone', control: this.tzSelect.element, alignTop: false }).element);

            const browserLangs = this._currentBrowserLanguages();
            this.langTagInput = window.DuckControls.ComboBoxTag.create({
                label: 'Languages (Accept-Language)',
                placeholder: 'e.g. en-US, en (press Enter)',
                values: browserLangs,
                options: [],
                allowCustom: true,
                onChange: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            this._langTagInput = this.langTagInput;
            this.langTagInput.element.style.width = '100%';

            const langWrap = document.createElement('div');
            langWrap.style.cssText = 'display:flex; flex-direction:column; gap:8px; width:100%;';
            langWrap.appendChild(this.langTagInput.element);
            const langBtnRow = document.createElement('div');
            langBtnRow.style.cssText = 'display:flex; justify-content:flex-end;';
            const useCurrentLangBtn = window.DuckControls.Button.create(null, {
                text: 'Use Current Browser Languages',
                variant: 'surface',
                icon: 'translate',
                onClick: () => {
                    this.langTagInput.setValues(this._currentBrowserLanguages());
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            langBtnRow.appendChild(useCurrentLangBtn.element);
            langWrap.appendChild(langBtnRow);
            geoSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Languages', desc: 'Browser preferred languages header', control: langWrap, alignTop: true, fullWidthControl: true }).element);

            this.locationModeToggle = window.DuckControls.ToggleGroup.create({
                options: [
                    { label: 'Real', value: 'real' },
                    { label: 'Noise', value: 'noise' },
                    { label: 'Custom', value: 'custom' }
                ],
                value: 'noise',
                onChange: (val) => {
                    this._toggleLocationInputs(val);
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            geoSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Location Mode', desc: 'Choose how coordinates are derived for the fingerprint', control: this.locationModeToggle.element, alignTop: false }).element);

            const coordWrap = document.createElement('div');
            coordWrap.style.cssText = 'display: none; flex-direction: column; gap: 16px; margin-top: -8px; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px;';
            this._coordWrap = coordWrap;

            const coordTitle = document.createElement('div');
            coordTitle.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
            const titleDiv = document.createElement('div');
            titleDiv.style.cssText = 'font-size: 13px; font-weight: 600; color: var(--text-primary);';
            titleDiv.textContent = 'Custom Coordinates';
            const subtitleDiv = document.createElement('div');
            subtitleDiv.style.cssText = 'font-size: 11px; color: var(--text-secondary);';
            subtitleDiv.textContent = 'Applied only when Location Mode is set to Custom';
            coordTitle.appendChild(titleDiv);
            coordTitle.appendChild(subtitleDiv);
            coordWrap.appendChild(coordTitle);

            const coordButtons = document.createElement('div');
            coordButtons.style.cssText = 'display:flex; justify-content:flex-end;';
            const currentCoordBtn = window.DuckControls.Button.create(null, {
                text: 'Use Current Location',
                variant: 'surface',
                icon: 'my_location',
                onClick: () => this._setCurrentCoordinates()
            });
            coordButtons.appendChild(currentCoordBtn.element);
            coordWrap.appendChild(coordButtons);

            const coordInputs = document.createElement('div');
            coordInputs.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 180px; gap: 16px; align-items: end;';
            this.latIn = window.DuckControls.Input.create({ label: 'Latitude', placeholder: '40.7128', icon: 'my_location', onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.() });
            this.lngIn = window.DuckControls.Input.create({ label: 'Longitude', placeholder: '-74.0060', icon: 'location_on', onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.() });
            this.accuracySpin = window.DuckControls.SpinNumber.create({ label: 'Accuracy', value: 100, min: 1, max: 10000, step: 1, onChange: () => window.ProfileModals?.CreateProfile?._scheduleSync?.() });
            coordInputs.appendChild(this.latIn.element);
            coordInputs.appendChild(this.lngIn.element);
            coordInputs.appendChild(this.accuracySpin.element);
            coordWrap.appendChild(coordInputs);

            geoSec.appendChild(coordWrap);
            container.appendChild(window.DuckControls.Card.create({ title: 'Geolocation & Timezone', icon: 'public', desc: 'Location and regional spoofing settings', content: geoSec }).element);

            queueMicrotask(() => {
                this._toggleProxyInputs('none');
                this._loadSavedProxies();
            });

            return container;
        },

        getValues() {
            const proxyMode = this.proxyTypeToggle ? this.proxyTypeToggle.getValue() : 'none';
            const selectedSavedProxy = this._getSelectedSavedProxy();
            const proxyType = proxyMode === 'saved'
                ? this._normalizeProxyType(selectedSavedProxy?.Type || selectedSavedProxy?.type)
                : this._normalizeProxyType(this.pType ? this.pType.getValue() : 'http');

            const res = {
                proxyMode,
                timezone: this.tzSelect ? this.tzSelect.getValue() : 'auto',
                languages: this.langTagInput ? this.langTagInput.getValues() : [],
                locationMode: this.locationModeToggle ? this.locationModeToggle.getValue() : 'noise',
                proxyProtocol: proxyType,
                proxyDisplayName: proxyMode === 'saved'
                    ? (selectedSavedProxy?.Name || selectedSavedProxy?.name || '')
                    : ''
            };

            if (proxyMode === 'custom') {
                res.proxyConfig = {
                    Type: proxyType,
                    Host: this.pHost ? this.pHost.getValue() : '',
                    Port: this.pPort ? parseInt(this.pPort.getValue() || '0', 10) : 0,
                    Username: this.pUser ? this.pUser.getValue() : '',
                    Password: this.pPass ? this.pPass.getValue() : ''
                };
            } else if (proxyMode === 'saved') {
                const savedId = this.sProxy ? this.sProxy.getValue() : '';
                res.savedProxyId = savedId ? parseInt(savedId, 10) : null;
            }

            if (res.locationMode === 'custom') {
                res.customCoordinates = {
                    lat: this.latIn ? parseFloat(this.latIn.getValue() || '0') : 0,
                    lng: this.lngIn ? parseFloat(this.lngIn.getValue() || '0') : 0,
                    accuracy: this.accuracySpin ? parseFloat(this.accuracySpin.getValue() || '10') : 10
                };
            }
            // [DEBUG] network values
            console.log('[DEBUG:NetworkTab.getValues]', JSON.stringify({
                proxyMode: res.proxyMode,
                timezone: res.timezone,
                languages: res.languages,
                locationMode: res.locationMode,
            }, null, 2));
            return res;
        },

        setValues(values) {
            if (!values) return;
            
            // Proxy type
            if (values.proxyMode && this.proxyTypeToggle) {
                this.proxyTypeToggle.setValue(values.proxyMode);
                // Manually trigger the visibility updates after initial render
                setTimeout(() => {
                    this._toggleProxyInputs(values.proxyMode);
                }, 0);
            }
            
            // Saved proxy - load proxies list first then set value
            if (values.savedProxyId != null) {
                // Load proxies with the saved proxy ID pre-selected
                this._loadSavedProxies(values.savedProxyId);
                // Also switch to saved mode if not already
                if (this.proxyTypeToggle && this.proxyTypeToggle.getValue() !== 'saved') {
                    this.proxyTypeToggle.setValue('saved');
                    setTimeout(() => {
                        this._toggleProxyInputs('saved');
                    }, 0);
                }
            } else {
                // Just load proxies normally for create mode
                this._loadSavedProxies();
            }
            
            // Custom proxy fields
            if (values.proxyConfig) {
                if (this.pHost) this.pHost.setValue(values.proxyConfig.Host || '');
                if (this.pPort) this.pPort.setValue(values.proxyConfig.Port || '');
                if (this.pUser) this.pUser.setValue(values.proxyConfig.Username || '');
                if (this.pPass) this.pPass.setValue(values.proxyConfig.Password || '');
                if (this.pType) this.pType.setValue(values.proxyConfig.Type || 'http');
            }
            
            // Timezone
            if (values.timezone && this.tzSelect) {
                this.tzSelect.setValue(values.timezone);
            }
            
            // Languages
            if (values.languages && this.langTagInput) {
                this.langTagInput.setValues(Array.isArray(values.languages) ? values.languages : [values.languages]);
            }
            
            // Location mode
            if (values.locationMode && this.locationModeToggle) {
                this.locationModeToggle.setValue(values.locationMode);
                setTimeout(() => {
                    if (this._toggleLocationInputs) this._toggleLocationInputs(values.locationMode);
                }, 0);
            }
            
            // Custom coordinates
            if (values.customCoordinates) {
                if (this.latIn) this.latIn.setValue(String(values.customCoordinates.lat || 0));
                if (this.lngIn) this.lngIn.setValue(String(values.customCoordinates.lng || 0));
                if (this.accuracySpin) this.accuracySpin.setValue(values.customCoordinates.accuracy || 100);
            }
        },
    };
})();

