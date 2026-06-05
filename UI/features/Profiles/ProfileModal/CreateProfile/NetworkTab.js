(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.NetworkTab = {
        _savedProxies: [],

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
            const value = this._normalizeProxyType(type);
            if (value === 'https') return 'HTTPS';
            if (value === 'socks4') return 'Socks4';
            if (value === 'socks5') return 'Socks5';
            return 'HTTP/HTTPS';
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
            return this._savedProxies.find(p => String(p.Id ?? p.id) === selectedId) || null;
        },

        async _loadSavedProxies() {
            try {
                const proxies = await DuckBridge.call('proxy.list');
                this._savedProxies = Array.isArray(proxies) ? proxies : [];
            } catch (e) {
                console.warn('[NetworkTab] Failed to load proxies', e);
                this._savedProxies = [];
            }

            const options = this._savedProxies.map(proxy => {
                const id = String(proxy.Id ?? proxy.id);
                const type = this._proxyTypeLabel(proxy.Type || proxy.type);
                const host = proxy.Host || proxy.host || '-';
                const port = proxy.Port || proxy.port || '-';
                const name = proxy.Name || proxy.name || `Proxy #${id}`;
                return {
                    label: `${name} · ${type} · ${host}:${port}`,
                    value: id
                };
            });

            this.sProxy?.setOptions(options);
            if (options.length > 0 && !this.sProxy?.getValue?.()) {
                this.sProxy.setValue(options[0].value);
            }
            this._updateProtocolHint();
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
                    } else {
                        window.DuckControls?.Toast?.warning('Location unavailable', 'Could not get location from IP.');
                    }
                } catch (err) {
                    window.DuckControls?.Toast?.warning('Location unavailable', err?.message || 'Could not get current coordinates.');
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
            hostPortRow.style.cssText = 'display: grid; grid-template-columns: 220px 1fr 140px; gap: 12px; align-items: end;';
            this.pType = window.DuckControls.Select.create({
                label: 'Protocol',
                options: [
                    { label: 'HTTP/HTTPS', value: 'http' },
                    { label: 'HTTPS', value: 'https' },
                    { label: 'Socks4', value: 'socks4' },
                    { label: 'Socks5', value: 'socks5' }
                ],
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
                placeholder: 'user',
                icon: 'person',
                onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            this.pPass = window.DuckControls.Input.create({
                label: 'Password',
                placeholder: 'pass',
                icon: 'key',
                onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });

            customProxyForm.appendChild(hostPortRow);
            customProxyForm.appendChild(this.pUser.element);
            customProxyForm.appendChild(this.pPass.element);

            const savedProxyForm = document.createElement('div');
            savedProxyForm.style.cssText = 'display: none; flex-direction: column; gap: 12px;';
            this._savedProxyForm = savedProxyForm;
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
                        window.DuckControls?.Toast?.warning('No proxy selected', 'Choose Custom Proxy or Saved Proxy first.');
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
                                window.DuckControls?.Toast?.warning('Missing proxy', 'Please select a saved proxy.');
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
                        if (status === 'alive') {
                            window.DuckControls?.Toast?.success('Proxy Valid', 'Proxy is reachable from backend.');
                        } else if (status === 'not_found') {
                            window.DuckControls?.Toast?.warning('Proxy missing', 'Saved proxy was not found.');
                        } else {
                            window.DuckControls?.Toast?.error('Proxy Error', 'Connection failed from backend.');
                        }
                    } catch (e) {
                        window.DuckControls?.Toast?.error('Error', e.message || 'Proxy check failed.');
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

            this.geoModeToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Prompt', value: 'Prompt' }, { label: 'Allow', value: 'Allow' }, { label: 'Block', value: 'Block' }],
                value: 'Block',
                onChange: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            geoSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Geolocation Access', desc: 'Handle websites requesting your location', control: this.geoModeToggle.element, alignTop: false }).element);

            this.tzSelect = window.DuckControls.ComboBox.create({
                label: '',
                placeholder: 'Search timezone...',
                options: [{ label: 'Auto (Match IP)', value: 'auto' }],
                value: 'auto'
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
                res.customProxy = {
                    mode: 'custom',
                    type: proxyType,
                    host: this.pHost ? this.pHost.getValue() : '',
                    port: this.pPort ? parseInt(this.pPort.getValue() || '0', 10) : 0,
                    username: this.pUser ? this.pUser.getValue() : '',
                    password: this.pPass ? this.pPass.getValue() : ''
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
            return res;
        }
    };
})();
