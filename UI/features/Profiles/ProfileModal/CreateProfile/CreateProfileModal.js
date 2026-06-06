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

        // Listen for profile-created so Group/Tag dropdowns stay fresh
        _initProfileCreatedListener() {
            window.removeEventListener('profile-created', this._onProfileCreatedBound);
            this._onProfileCreatedBound = () => this._refreshEntityData();
            window.addEventListener('profile-created', this._onProfileCreatedBound);
        },

        // ── Module init ──────────────────────────────────────────────────
        _init() {
            this._initProfileCreatedListener();
        },

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
            // Resolve browser type from catalog (v.browser = lowercase key)
            const browserLabel = v.browser
                ? (this._browserCatalog?.Browsers?.find(b => String(b.BrowserType || '').toLowerCase() === String(v.browser).toLowerCase())?.BrowserType || v.browser)
                : 'Chromium';
            set('Browser', `${browserLabel} ${v.browserVersion || '138'}`);
            // User-Agent: show actual generated UA in auto mode, custom value in custom mode
            if (v.autoGenerateUa) {
                const osVal = v.os || 'Windows';
                const modelVal = v.osModel || null;
                const version = v.browserVersion || '138';
                const block = this._fpTemplate?.OS?.[osVal];
                const modelDef = (block?.Models || []).find(m => m.Name === modelVal) || block?.Models?.[0];
                const ua = modelDef?.UserAgentTemplate?.replace('{VERSION}', version)
                    || `Generated for ${osVal} ${modelVal || ''}`.trim();
                set('User Agent', ua);
            } else {
                set('User Agent', v.userAgent || '—');
            }
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
            set('Ports', this._fmtPorts(v));
            set('Media', v.mediaDevices || 'noise');
            set('Speech', v.speechVoices || 'noise');
            set('Rects', v.clientRects || 'noise');
        },

        _fmtResolution(v) {
            if (v.screenMode === 'custom' && v.screenWidth) {
                const pr = v.screenPixelRatio != null ? ` @${v.screenPixelRatio}x` : '';
                return `${v.screenWidth}×${v.screenHeight}${pr}`;
            }
            if (v.screenMode === 'random') return 'Random';
            return v.screenPreset ? v.screenPreset.replace(/x/g, '×') : '1920×1080';
        },

        _fmtPorts(v) {
            const base = v.portScan === 'decline' ? 'Decline' : 'Protect';
            const mode = v.portBlockMode || 'block_default';
            const labels = { block_default: 'Block Default', block_all: 'Block All', allow_list: 'Allow List', custom: 'Custom' };
            const modeLabel = labels[mode] || mode;
            if (['allow_list', 'custom'].includes(mode) && v.portBlockList?.length > 0) {
                return `${base} · ${modeLabel} · ${v.portBlockList.join(', ')}`;
            }
            return `${base} · ${modeLabel}`;
        },

        /**
         * Apply a structured fingerprint response to all tab controls.
         * Called by the "New" button after backend generates fingerprint.
         */
        _applyFingerprintResponse(fp) {
            const hwTab  = window.ProfileModals.CreateProfile.HardwareTab;
            const genTab = window.ProfileModals.CreateProfile.GeneralTab;
            const netTab = window.ProfileModals.CreateProfile.NetworkTab;
            const secTab = window.ProfileModals.CreateProfile.SecurityTab;

            // Hardware: CPU
            if (hwTab) {
                hwTab.cpuToggle?.setValue?.('custom');
                const concurrency = fp?.hardwareConcurrency ?? fp?.HardwareConcurrency ?? 8;
                const memory = fp?.deviceMemory ?? fp?.DeviceMemory ?? 8;
                hwTab.cpuChipSelect?.setValue?.(`${concurrency}-${memory}`);
                // CPU chip select dropdown visibility
                const hwTierWrap = hwTab.cpuToggle?.element?.closest('[class*="card"]')?.querySelector('[style*="display"]') || null;
                if (hwTierWrap && hwTierWrap.style.display === 'none' && hwTab.cpuToggle?.getValue?.() === 'custom') {
                    const allDisplays = hwTab.cpuToggle?.element?.closest('.duck-card-content')?.querySelectorAll('[style*="display"]') || [];
                    for (const el of allDisplays) {
                        if (el.style.display === 'none' && el.textContent.includes('Hardware Tier')) {
                            el.style.display = 'flex';
                            break;
                        }
                    }
                }

                // Hardware: Screen
                if (fp?.screenWidth && fp?.screenHeight) {
                    hwTab.resToggle?.setValue?.('custom');
                    const pr = fp.screenPixelRatio ?? 1.0;
                    hwTab.resChipSelect?.setValue?.(`${fp.screenWidth}x${fp.screenHeight}x${pr}`);
                }

                // Hardware: WebGL
                if (fp?.webglVendor || fp?.WebGLVendor) {
                    hwTab.webglMetaToggle?.setValue?.('custom');
                    const vendor = fp.webglVendor || fp.WebGLVendor;
                    const renderer = fp.webglRenderer || fp.WebGLRenderer;
                    if (hwTab._webglVendorSelect) {
                        const osBlock = hwTab._currentOsBlock;
                        const vendors = osBlock?.WebGL?.VendorGPUs ? Object.keys(osBlock.WebGL.VendorGPUs) : [];
                        const match = vendors.find(v => v.toLowerCase() === String(vendor).toLowerCase());
                        if (match) hwTab._webglVendorSelect.setValue(match);
                    }
                    if (hwTab._rendererSelect && renderer) {
                        const osBlock = hwTab._currentOsBlock;
                        const currentVendor = hwTab._webglVendorSelect?.getValue?.() || '';
                        const renderers = osBlock?.WebGL?.VendorGPUs?.[currentVendor] || [];
                        const match = renderers.find(r => String(r).toLowerCase().includes(String(renderer).toLowerCase()));
                        if (match) hwTab._rendererSelect.setValue(match);
                    }
                }
            }

            // General: Browser version
            if (genTab) {
                const version = fp?.browserVersion || fp?.BrowserVersion || '138';
                genTab.browserVersion?.setValue?.(version);
                const ua = fp?.userAgent || fp?.UserAgent || '';
                if (ua && genTab.uaModeToggle?.getValue?.() === 'custom') {
                    genTab.uaInput?.setValue?.(ua);
                }
            }

            // Network: languages + timezone
            if (netTab) {
                const langs = fp?.languages || fp?.Languages || [];
                if (langs.length > 0) {
                    netTab.langTagInput?.setValues?.(Array.isArray(langs) ? langs : String(langs).split(',').map(l => l.trim()));
                }
                const tz = fp?.timezone || fp?.Timezone || 'auto';
                netTab.tzSelect?.setValue?.(tz);
            }

            // Security: client rects
            if (secTab) {
                secTab.rectsToggle?.setValue?.('noise');
            }

            this._syncSummary();
        },

        /**
         * Collect all tab values into a ProfileCreateRequest payload.
         */
        _collectPayload(name) {
            const v = this._collectTabValues();
            const groupValue = this._groupCtrl?.getValue?.() || '';
            const groupId = groupValue ? parseInt(groupValue, 10) : null;
            const tagValues = this._tagCtrl?.getValues?.() || [];
            const tagIds = tagValues.map(t => parseInt(t, 10)).filter(n => !isNaN(n));

            return {
                name,
                groupId,
                tagIds: tagIds.length ? tagIds : null,
                browserType: (v.browser || 'chromium').charAt(0).toUpperCase() + (v.browser || 'chromium').slice(1),
                startUrl: v.startUrl || '',
                notes: v.notes || '',
                cookies: v.cookies || null,
                cookiesData:    v.cookiesData    || null,
                cookiesFileName: v.cookiesFileName || null,
                fingerprint: {
                    platform: v.os || 'Windows',
                    osModel: v.osModel || null,
                    browserVersion: v.browserVersion || '138',
                    userAgent: v.autoGenerateUa ? null : (v.userAgent || null),
                    languages: v.languages || ['en-US', 'en'],
                    timezone: v.timezone || 'auto',
                    screenWidth: v.screenWidth ? parseInt(v.screenWidth, 10) : null,
                    screenHeight: v.screenHeight ? parseInt(v.screenHeight, 10) : null,
                    screenPixelRatio: v.screenPixelRatio || null,
                    hardwareConcurrency: v.concurrency || null,
                    deviceMemory: v.deviceMemory || null,
                    webglMode: v.webglMode || 'random',
                    webglVendor: v.webglVendor || null,
                    webglRenderer: v.webglRenderer || null,
                    canvasMode: v.canvasMode || 'noise',
                    webglImageMode: v.webglImageMode || 'noise',
                    pluginsMode: v.pluginsMode || 'noise',
                    fontsMode: v.fontsMode || 'default',
                    fonts: v.fontsMode === 'custom' ? (v.customFonts || []) : null,
                    webRtcMode: v.webrtcMode || 'disable',
                    sslMode: v.sslMode || 'noise',
                    portScan: v.portScan || 'protect',
                    portBlockMode: v.portBlockMode || 'block_default',
                    portBlockList: v.portBlockList || [],
                    mediaDevicesMode: v.mediaDevices || 'noise',
                    speechVoicesMode: v.speechVoices || 'noise',
                    clientRectsMode: v.clientRects || 'noise',
                    locationMode: v.locationMode || 'noise',
                    latitude: v.customCoordinates?.lat || null,
                    longitude: v.customCoordinates?.lng || null,
                    accuracy: v.customCoordinates?.accuracy || null,
                }
            };
        },

        _collectBulkPayload(qty, prefix) {
            const v = this._collectTabValues();
            const groupValue = this._groupCtrl?.getValue?.() || '';
            const groupId = groupValue ? parseInt(groupValue, 10) : null;
            const tagValues = this._tagCtrl?.getValues?.() || [];
            const tagIds = tagValues.map(t => parseInt(t, 10)).filter(n => !isNaN(n));

            return {
                quantity: qty,
                prefix: prefix || null,
                groupId,
                tagIds: tagIds.length ? tagIds : null,
                browserType: (v.browser || 'chromium').charAt(0).toUpperCase() + (v.browser || 'chromium').slice(1),
                notes: v.notes || '',
                fingerprint: {
                    platform: v.os || 'Windows',
                    osModel: v.osModel || null,
                    browserVersion: v.browserVersion || '138',
                    userAgent: v.autoGenerateUa ? null : (v.userAgent || null),
                    languages: v.languages || ['en-US', 'en'],
                    timezone: v.timezone || 'auto',
                    screenWidth: v.screenWidth ? parseInt(v.screenWidth, 10) : null,
                    screenHeight: v.screenHeight ? parseInt(v.screenHeight, 10) : null,
                    screenPixelRatio: v.screenPixelRatio || null,
                    hardwareConcurrency: v.concurrency || null,
                    deviceMemory: v.deviceMemory || null,
                    webglMode: v.webglMode || 'random',
                    webglVendor: v.webglVendor || null,
                    webglRenderer: v.webglRenderer || null,
                    canvasMode: v.canvasMode || 'noise',
                    webglImageMode: v.webglImageMode || 'noise',
                    pluginsMode: v.pluginsMode || 'noise',
                    fontsMode: v.fontsMode || 'default',
                    fonts: v.fontsMode === 'custom' ? (v.customFonts || []) : null,
                    webRtcMode: v.webrtcMode || 'disable',
                    sslMode: v.sslMode || 'noise',
                    portScan: v.portScan || 'protect',
                    portBlockMode: v.portBlockMode || 'block_default',
                    portBlockList: v.portBlockList || [],
                    mediaDevicesMode: v.mediaDevices || 'noise',
                    speechVoicesMode: v.speechVoices || 'noise',
                    clientRectsMode: v.clientRects || 'noise',
                    locationMode: v.locationMode || 'noise',
                    latitude: v.customCoordinates?.lat || null,
                    longitude: v.customCoordinates?.lng || null,
                    accuracy: v.customCoordinates?.accuracy || null,
                }
            };
        },

        _clearFieldError() {
            this._modal?.container?.querySelectorAll('.field-error-label').forEach(el => el.remove());
            this._modal?.container?.querySelectorAll('.is-error').forEach(el => el.classList.remove('is-error'));
        },

        _showFieldError(field, message) {
            if (!this._modal?.container) return;
            const ctrl = this._fieldErrorTarget(field);
            if (!ctrl) { window.DuckControls.Toast?.warning?.(message); return; }

            // Mark control as error
            ctrl.classList.add('is-error');

            // Find or create error label
            let errLabel = ctrl.parentElement?.querySelector('.field-error-label');
            if (!errLabel) {
                errLabel = document.createElement('div');
                errLabel.className = 'field-error-label';
                errLabel.style.cssText = 'font-size: 11px; color: var(--danger); margin-top: 4px; display: flex; align-items: center; gap: 4px;';
                ctrl.parentElement?.appendChild(errLabel);
            }
            errLabel.innerHTML = '<span class="material-symbols-outlined" style="font-size:12px">error</span> ' + message;
        },

        _fieldErrorTarget(field) {
            const map = {
                browserType: () => this.browserSelect?.element || document.querySelector('[data-field="browserType"]'),
                prefix:     () => this._nameInput?.querySelector?.('input'),
                quantity:   () => this._qtyCtrl?.element?.querySelector?.('input'),
                'proxy.host': () => document.querySelector('[data-field="proxy.host"]'),
                'proxy.port': () => document.querySelector('[data-field="proxy.port"]'),
                'proxy.type': () => document.querySelector('[data-field="proxy.type"]'),
            };
            const finder = map[field];
            return finder ? finder() : null;
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
            if (v.cpuMode === 'real') return 'Real hardware';
            if (v.cpuMode === 'random') return 'Random hardware';
            // Custom mode: show selected tier
            if (v.concurrency != null && v.deviceMemory != null) {
                return `${v.concurrency} Cores, ${v.deviceMemory} GB RAM`;
            }
            return '—';
        },

        _fmtWebGL(v) {
            if (v.webglMode === 'real') return 'Real (no spoof)';
            if (v.webglMode === 'random') return 'Random spoofed';
            if (v.webglVendor || v.webglRenderer) {
                const parts = [v.webglVendor, v.webglRenderer].filter(Boolean);
                const short = parts.map(p => p.length > 40 ? p.substring(0, 40) + '...' : p);
                return short.join('\n');
            }
            return 'Custom (no selection)';
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
            if (genTab) {
                // OS list (Windows, macOS, Linux...) from template keys
                const osKeys = tmpl.OS ? Object.keys(tmpl.OS) : [];
                const osOpts = osKeys.map(k => ({ label: k, value: k }));
                if (genTab.osSelect) {
                    genTab.osSelect.setOptions(osOpts);
                    if (osOpts.length > 0) {
                        const matchedOpt = osOpts.find(o => o.value === osValue);
                        genTab.osSelect.setValue(matchedOpt ? matchedOpt.value : osOpts[0].value);
                    }
                }

                const osModels = (osBlock?.Models || []).map(m => ({ label: m.Name, value: m.Name }));
                if (genTab.osModelSelect) {
                    genTab.osModelSelect.setOptions(osModels);
                    if (osModels.length > 0) genTab.osModelSelect.setValue(osModels[0].value);
                }
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

                // Cascade completes — sync overview immediately (vendor/renderer already set above)
                if (this._syncTimer) clearTimeout(this._syncTimer);
                this._syncSummary();
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
                } else if (netTab.tzSelect) {
                    const tzOpts = (tmpl.Timezones || []).map(tz => ({ label: tz, value: tz }));
                    netTab.tzSelect.setOptions([{ label: 'Auto (Match IP)', value: 'auto' }, ...tzOpts]);
                    netTab.tzSelect.setValue('auto');
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
                    { text: 'Cancel', class: 'duck-btn-ghost', onClick: () => this._modal?.close() },
                    {
                        text: 'Create Profile', class: 'duck-btn-primary', isDefault: true, icon: 'add', disabled: true,
                        onClick: async () => {
                            const mode = this._modeCtrl?.getValue?.() || 'single';
                            const qty = mode === 'bulk' ? (this._qtyCtrl?.getValue?.() || 1) : 1;
                            const prefixVal = this._nameInput?.querySelector('input')?.value?.trim() || null;

                            if (qty > 1 && !prefixVal) {
                                window.DuckControls.Toast?.warning?.('Please enter a prefix for bulk creation.');
                                return;
                            }

                            try {
                                this._modal.setLoading(true, qty > 1 ? `Creating ${qty} profiles...` : 'Creating profile...');
                                let results;

                                if (qty > 1) {
                                    const payload = this._collectBulkPayload(qty, prefixVal);
                                    results = await DuckBridge.call('profile.bulkCreate', payload);
                                } else {
                                    const payload = this._collectPayload(prefixVal || null);
                                    const result = await DuckBridge.call('profile.create', payload);
                                    results = [result];
                                }

                                this._modal.setLoading(false);
                                this._modal.close();
                                window.DispatchEvent?.(new CustomEvent('profile-created', { detail: results }));
                                if (this._onCreated) this._onCreated(results);
                            } catch (err) {
                                this._modal.setLoading(false);
                                const msg = err?.message || String(err);
                                const field = err?._field || '';
                                console.error('[CreateProfile] create failed:', msg, 'field:', field);

                                // Show error label on the relevant field
                                this._clearFieldError();
                                if (field) this._showFieldError(field, msg);
                                // else toast handled by DuckBridge
                            }
                        }
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
                // Stop skeleton loading — show explicit error state inside modal body
                const modalBody = this._modal?.container?.querySelector('.duck-modal-body');
                if (modalBody) {
                    modalBody.innerHTML = '';
                    modalBody.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:16px;padding:40px;text-align:center;';

                    const icon = document.createElement('span');
                    icon.className = 'material-symbols-outlined';
                    icon.style.cssText = 'font-size:48px;color:var(--danger);opacity:0.8;';
                    icon.textContent = 'error_outline';

                    const title = document.createElement('div');
                    title.style.cssText = 'font-size:15px;font-weight:600;color:var(--text-primary);';
                    title.textContent = 'Failed to Load Data';

                    const detail = document.createElement('div');
                    detail.style.cssText = 'font-size:13px;color:var(--text-secondary);max-width:340px;line-height:1.6;';
                    detail.textContent = msg;

                    modalBody.appendChild(icon);
                    modalBody.appendChild(title);
                    modalBody.appendChild(detail);
                }

                // Hide footer
                const footer = this._modal?.container?.querySelector('.duck-modal-footer');
                if (footer) footer.style.display = 'none';
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

            // Pass data to all tabs before building the form
            ['GeneralTab', 'NetworkTab', 'HardwareTab', 'SecurityTab', 'CookiesTab', 'NotesTab'].forEach(tabName => {
                const tab = window.ProfileModals.CreateProfile[tabName];
                if (tab?._setTemplate) tab._setTemplate(template);
                if (tab?._setBrowserCatalog) tab._setBrowserCatalog(browserCatalog);
            });

            // Cascade OS defaults so all tab controls are populated before first render
            this._cascadeOsChange('Windows');

            // ── Build form and replace skeleton ─────────────────────────────
            const container = this._buildFormContainer(template, browserCatalog);

            const modalBody = this._modal?.container?.querySelector('.duck-modal-body');
            if (modalBody) {
                modalBody.innerHTML = '';
                modalBody.appendChild(container);
                modalBody.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;padding:0;';
            }

            // Cascade OS defaults AFTER tabs are rendered so all controls exist in DOM
            this._cascadeOsChange('Windows');

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
            row1.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 16px; align-items: start;';

            const nameWrap = document.createElement('div');
            nameWrap.style.cssText = 'display: flex; gap: 12px; align-items: flex-end; width: 100%;';

            const nameInput = window.DuckControls.Input.create({ label: 'Profile Name', placeholder: 'Enter profile name...', icon: 'badge', fullWidth: true });
            nameInput.element.style.flex = '1';
            this._nameInput = nameInput.element;

            const qtySpin = window.DuckControls.SpinNumber.create({ value: 1, min: 1, max: 100 });
            this._qtyCtrl = qtySpin;
            const qtyWrap = createLabelWrap('Quantity', qtySpin.element);
            qtyWrap.style.display = 'none';
            qtyWrap.style.width = '120px';
            nameWrap.appendChild(nameInput.element);
            nameWrap.appendChild(qtyWrap);

            const modeToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Single Profile', value: 'single' }, { label: 'Bulk Create', value: 'bulk' }],
                value: 'single',
                onChange: (val) => {
                    qtyWrap.style.display = val === 'bulk' ? 'block' : 'none';
                    this._modeCtrl = modeToggle;
                    const lbl = nameInput.element.querySelector('.ui-label-sm');
                    const inp = nameInput.element.querySelector('input');
                    if (val === 'bulk') { if (lbl) lbl.textContent = 'Profile Prefix'; if (inp) inp.placeholder = 'Enter prefix...'; }
                    else { if (lbl) lbl.textContent = 'Profile Name'; if (inp) inp.placeholder = 'Enter profile name...'; }
                }
            });
            this._modeCtrl = modeToggle;
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
                    this._modal.setLoading(true, 'Generating new fingerprint...');
                    try {
                        const fp = await DuckBridge.call('profile.generateFingerprint', {
                            platform: tabValues.os || 'Windows',
                            browser:  tabValues.browser || 'chromium',
                            model:    tabValues.osModel || null
                        });
                        this._applyFingerprintResponse(fp);
                        this._modal.setLoading(false);
                    } catch (e) {
                        // toast handled by DuckBridge
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

    // Auto-init
    window.ProfileModals.CreateProfile._init();
})();
