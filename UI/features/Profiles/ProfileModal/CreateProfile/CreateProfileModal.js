/**
 * CreateProfileModal.js
 *
 * Fingerprint template loaded from backend via profile.getFingerprintTemplate.
 * Cascade: OS select   -->  all OS-dependent controls + Overview sync.
 * Every control change triggers _scheduleSync()   -->  Overview updates live.
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
        _isSubmitting: false,
        // Edit mode properties
        _mode: 'create',
        _editProfileId: null,
        _originalProfileData: null,
        // Prevent sync/cascade during profile data loading
        _isLoadingProfile: false,

        // Listen for profile-created so Group/Tag dropdowns stay fresh
        _initProfileCreatedListener() {
            window.removeEventListener('profile-created', this._onProfileCreatedBound);
            this._onProfileCreatedBound = () => {
                this._refreshEntityData();
            };
            window.addEventListener('profile-created', this._onProfileCreatedBound);
        },

        // ===== Module init =====
        _init() {
            this._initProfileCreatedListener();
        },

        _collectTabValues() {
            const values = {};
            ['GeneralTab', 'NetworkTab', 'HardwareTab', 'SecurityTab', 'CookiesTab', 'NotesTab'].forEach(tabName => {
                const tab = window.ProfileModals.CreateProfile[tabName];
                const tabVals = tab?.getValues ? tab.getValues() : {};
                console.log(`[DEBUG:_collectTabValues] ${tabName}:`, JSON.stringify(tabVals, null, 2));
                Object.assign(values, tabVals);
            });
            // Get name from the name input field
            const nameInput = this._nameInput?.querySelector?.('input');
            if (nameInput) {
                values.name = nameInput.value || '';
            }
            console.log('[DEBUG:collectTabValues] FINAL:', JSON.stringify(values, null, 2));
            return values;
        },



        async _loadEntityData() {
            try {
                this._groups = await DuckBridge.call('group.list') || [];
                this._tags   = await DuckBridge.call('tag.list')   || [];
                this._groups.sort((a, b) => (a.Name || '').localeCompare(b.Name || ''));
                this._tags.sort((a, b)   => (a.Name || '').localeCompare(b.Name || ''));
            } catch (e) {
                this._groups = [];
                this._tags   = [];
            }
        },

        async _loadFingerprintTemplate() {
            if (this._fpTemplate) return this._fpTemplate;
            try {
                this._fpTemplate = await DuckBridge.call('profile.getFingerprintTemplate');
            } catch (e) {
                this._fpTemplate = null;
            }
            return this._fpTemplate;
        },

        _buildGroupOptions() {
            return this._groups.map(g => ({
                label: g.Name || g.name || '',
                value: String(g.Id || g.id)
            }));
        },

        _buildTagOptions() {
            return this._tags.map(t => ({
                label: t.Name || t.name || '',
                value: String(t.Id || t.id)
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

            // [DEBUG] check if overview elements exist in DOM
            const allSummaryEls = this._modal.container.querySelectorAll('.duck-summary-item-value');
            console.log('[DEBUG:_syncSummary] overview elements found:', allSummaryEls.length);
            allSummaryEls.forEach(el => {
                console.log(`  [${el.dataset.label}]: "${el.textContent}"`);
            });

            const v = this._collectTabValues();
            console.log('[CreateProfile] _syncSummary - collected values:', JSON.stringify(v, null, 2));
            // [DEBUG:SYNC_KEYS] show the exact values overview uses
            console.log('[DEBUG:SYNC_KEYS]', JSON.stringify({
                os: v.os,
                osModel: v.osModel,
                browser: v.browser,
                browserVersion: v.browserVersion,
                screenMode: v.screenMode,
                screenWidth: v.screenWidth,
                screenHeight: v.screenHeight,
                screenPixelRatio: v.screenPixelRatio,
                screenPreset: v.screenPreset,
                timezone: v.timezone,
                languages: v.languages,
                proxyMode: v.proxyMode,
                locationMode: v.locationMode,
                cpuMode: v.cpuMode,
                concurrency: v.concurrency,
                deviceMemory: v.deviceMemory,
                webglMode: v.webglMode,
                webglVendor: v.webglVendor,
                webglRenderer: v.webglRenderer,
                fontsMode: v.fontsMode,
                customFonts: v.customFonts,
                webrtcMode: v.webrtcMode,
                sslMode: v.sslMode,
                mediaDevices: v.mediaDevices,
                audioMode: v.audioMode,
                speechVoices: v.speechVoices,
                clientRects: v.clientRects,
                fontMetricsMode: v.fontMetricsMode,
                portScan: v.portScan,
                portBlockMode: v.portBlockMode,
            }, null, 2));
            const groupText = this._groupCtrl?.getOptions?.().find(o => String(o.value) === String(this._groupCtrl?.getValue?.() || ''))?.label || 'None';
            const tagValues = this._tagCtrl?.getValues?.() || [];
            const tagText = tagValues.length
                ? tagValues.map(val => this._tagCtrl?.getOptions?.().find(o => String(o.value) === String(val))?.label || String(val)).join(', ')
                : 'None';

            const set = (label, text) => {
                const el = this._modal.container.querySelector(
                    `.duck-summary-item-value[data-label="${label}"]`
                );
                console.log(`[DEBUG:set] label="${label}" text="${text}" el=${!!el}`);
                if (el) el.textContent = text;
            };

            set('Start URL', v.startUrl || 'chrome://newtab');
            set('Group', groupText);
            set('Tags', tagText);
            set('Operating System', v.os || null);
            set('OS Model', v.osModel || 'Auto');
            set('Browser', `${v.browser || 'Chromium'} ${v.browserVersion || ''}`.trim());
            // User-Agent: show based on mode
            // Use DB-loaded values when available (bypasses timing issue: controls may not be set yet)
            // Controls are populated asynchronously via RAF, but _syncSummary runs in a setTimeout
            const db = this._loadedDbValues || {};
            // UA: read from controls first (after setValues), fallback to db for timing
            const uaMode = window.ProfileModals?.CreateProfile?.GeneralTab?.uaModeToggle?.getValue?.()
                || db.uaMode || 'random';
            const uaInputVal = window.ProfileModals?.CreateProfile?.GeneralTab?.uaInput?.getValue?.() || '';
            if (uaMode === 'real') {
                set('User Agent', 'Real (system)');
            } else if (uaMode === 'custom') {
                set('User Agent', uaInputVal || db.userAgent || 'Custom');
            } else {
                set('User Agent', db.userAgent || uaInputVal || 'Random');
            }
            set('Screen Resolution', this._fmtResolution({
                screenMode: v.screenMode || db.screenMode,
                screenWidth: v.screenWidth || db.screenWidth,
                screenHeight: v.screenHeight || db.screenHeight,
                screenPixelRatio: v.screenPixelRatio || db.screenPixelRatio,
                screenPreset: v.screenPreset
            }));
            set('Timezone', v.timezone || 'Auto (Match IP)');
            set('Language', this._fmtLanguages(v.languages));
            set('Proxy', this._fmtProxy(v));
            set('Coordinates', v.locationMode === 'custom' && v.customCoordinates ? `${v.customCoordinates.lat || '-'}, ${v.customCoordinates.lng || '-'} (\u00B1${v.customCoordinates.accuracy || 100}m)` : this._fmtCoordinates(v));
            set('Hardware', this._fmtHardware(v));
            set('WebGL', this._fmtWebGL(v));
            const fontsMode = v.fontsMode || 'default';
            set('Fonts', fontsMode === 'custom' ? (v.customFonts?.join(', ') || 'None') : fontsMode.charAt(0).toUpperCase() + fontsMode.slice(1));
            set('WebRTC', v.webrtcMode || 'disable');
            set('SSL', v.sslMode || 'noise');
            set('Ports', this._fmtPorts(v));
            set('Media', v.mediaDevices || 'real');
            set('Audio', v.audioMode || 'real');
            set('Speech', v.speechVoices || 'real');
            set('Rects', v.clientRects || 'real');
            set('Font Metrics', v.fontMetricsMode || 'real');
        },

        _fmtResolution(v) {
            const screenMode = v.screenMode || 'real';
            if (screenMode === 'real') return 'Real (system)';
            if (screenMode === 'custom' && v.screenWidth) {
                const pr = v.screenPixelRatio != null ? ` @${v.screenPixelRatio}x` : '';
                return `${v.screenWidth}\u00D7${v.screenHeight}${pr}`;
            }
            if (screenMode === 'random') return 'Random';
            if (screenMode === 'default') return 'Default';
            return v.screenPreset ? v.screenPreset.replace(/x/g, '\u00D7') : '1920\u00D71080';
        },

        _fmtPorts(v) {
            const base = v.portScan === 'decline' ? 'Decline' : 'Protect';
            const mode = v.portBlockMode || 'block_default';
            const labels = { block_default: 'Block Default', block_all: 'Block All', allow_list: 'Allow List', custom: 'Custom' };
            const modeLabel = labels[mode] || mode;
            if (['allow_list', 'custom'].includes(mode) && v.portBlockList?.length > 0) {
                return `${base} \u00B7 ${modeLabel} \u00B7 ${v.portBlockList.join(', ')}`;
            }
            return `${base} \u00B7 ${modeLabel}`;
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

            if (fp?.rawConfig) {
                if (this._originalProfileData) {
                    this._originalProfileData.ProfileDataParsed = fp.rawConfig;
                } else {
                    this._originalProfileData = { ProfileDataParsed: fp.rawConfig };
                }
            }

            // Hardware: CPU
            if (hwTab) {
                if (fp?.cpuMode === 'custom' && (fp?.hardwareConcurrency || fp?.HardwareConcurrency)) {
                    hwTab.cpuToggle?.setValue?.('custom');
                    const concurrency = fp?.hardwareConcurrency || fp?.HardwareConcurrency || 8;
                    const memory = fp?.deviceMemory || fp?.DeviceMemory || 8;
                    hwTab.cpuChipSelect?.setValue?.(`${concurrency}-${memory}`);
                } else if (fp?.cpuMode) {
                    hwTab.cpuToggle?.setValue?.(fp.cpuMode);
                } else {
                    hwTab.cpuToggle?.setValue?.('random');
                }
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
                if (fp?.screenMode === 'custom' && fp?.screenWidth && fp?.screenHeight) {
                    hwTab.resToggle?.setValue?.('custom');
                    const pr = fp.screenPixelRatio || 1.0;
                    hwTab.resChipSelect?.setValue?.(`${fp.screenWidth}x${fp.screenHeight}x${pr}`);
                } else if (fp?.screenMode) {
                    hwTab.resToggle?.setValue?.(fp.screenMode);
                }

                // Hardware: WebGL - Only set when editing existing profile (not for new create)
                if (this._editProfileId) {
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
            }

            // General: Browser version
            // Only set browser version when editing existing profile (not for new create)
            if (genTab && this._editProfileId) {
                const version = fp?.browserVersion || fp?.BrowserVersion || null;
                genTab.browserVersion?.setValue?.(version);
                const ua = fp?.userAgent || fp?.UserAgent || '';
                if (ua && genTab.uaModeToggle?.getValue?.() === 'custom') {
                    genTab.uaInput?.setValue?.(ua);
                }
            }

            // Network: languages + timezone
            // Only set timezone when editing existing profile (not for new create)
            if (netTab && this._editProfileId) {
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
            const uaMode = window.ProfileModals?.CreateProfile?.GeneralTab?.uaModeToggle?.getValue?.() || 'random';

            // Map DoNotTrack toggle format to DB format: enabled->"1", disabled->"0", default->null
            const doNotTrackValue = v.doNotTrack === 'enabled' ? '1' : (v.doNotTrack === 'disabled' ? '0' : null);

            // Only send hardware/screen values when mode is 'custom' (Real = null, Random = null)
            const sendConcurrency = v.cpuMode === 'custom' ? (v.concurrency || null) : null;
            const sendDeviceMemory = v.cpuMode === 'custom' ? (v.deviceMemory || null) : null;
            const sendScreenWidth = v.screenMode === 'custom' && v.screenWidth ? parseInt(v.screenWidth, 10) : null;
            const sendScreenHeight = v.screenMode === 'custom' && v.screenHeight ? parseInt(v.screenHeight, 10) : null;
            const sendPixelRatio = v.screenMode === 'custom' ? (v.screenPixelRatio || null) : null;

            console.log('[DEBUG:_collectPayload]', JSON.stringify({
                uaMode, doNotTrackValue,
                screenMode: v.screenMode,
                screenWidth: sendScreenWidth, screenHeight: sendScreenHeight, pixelRatio: sendPixelRatio,
                concurrency: sendConcurrency, deviceMemory: sendDeviceMemory,
                webglMode: v.webglMode, webglVendor: v.webglVendor, webglRenderer: v.webglRenderer,
                canvasMode: v.canvasMode, webglImageMode: v.webglImageMode,
                pluginsMode: v.pluginsMode,
                mediaDevices: v.mediaDevices,
                clientRects: v.clientRects,
            }, null, 2));
            return {
                name,
                groupId,
                tagIds: tagIds.length ? tagIds : null,
                browserType: (v.browser || 'chromium').charAt(0).toUpperCase() + (v.browser || 'chromium').slice(1),
                startUrl: v.startUrl || '',
                notes: v.notes || '',
                fingerprint: {
                    platform: v.os || null,
                    osModel: v.osModel || null,
                    // Real mode: no spoof, no UserAgent in DB; Custom mode: save UserAgent
                    uaMode,
                    userAgent: (uaMode === 'real') ? null : (v.userAgent || ''),
                    browserVersion: v.browserVersion || null,
                    languages: v.languages || ['en-US', 'en'],
                    timezone: v.timezone === 'auto' ? null : (v.timezone || null),
                    screenMode: v.screenMode || 'real',
                    screenWidth: sendScreenWidth,
                    screenHeight: sendScreenHeight,
                    screenPixelRatio: sendPixelRatio,
                    hardwareConcurrency: sendConcurrency,
                    deviceMemory: sendDeviceMemory,
                    cpuMode: v.cpuMode || null,
                    audioMode: v.audioMode || null,
                    webglMode: v.webglMode || null,
                    webglVendor: v.webglMode === 'custom' ? (v.webglVendor || null) : null,
                    webglRenderer: v.webglMode === 'custom' ? (v.webglRenderer || null) : null,
                    canvasMode: v.canvasMode || null,
                    // UI 'default' means "no spoof" → send null to backend
                    webglImageMode: v.webglImageMode === 'default' ? null : (v.webglImageMode || null),
                    pluginsMode: v.pluginsMode || null,
                    plugins: v.pluginsMode === 'custom' ? (v.plugins || []) : null,
                    fontsMode: v.fontsMode || null,
                    fonts: v.fontsMode === 'custom' ? (v.customFonts || []) : null,
                    webRtcMode: v.webrtcMode || 'disable',
                    sslMode: v.sslMode || null,
                    portScan: v.portScan || 'protect',
                    portBlockMode: v.portBlockMode || 'block_default',
                    portBlockList: v.portBlockList || [],
                    mediaDevicesMode: v.mediaDevices || null,
                    speechVoicesMode: v.speechVoices || null,
                    clientRectsMode: v.clientRects || null,
                    fontMetricsMode: v.fontMetricsMode || null,
                    doNotTrack: doNotTrackValue,
                    locationMode: v.locationMode || null,
                    latitude: v.locationMode === 'real' || v.locationMode === 'default' ? null : (v.customCoordinates?.lat || null),
                    longitude: v.locationMode === 'real' || v.locationMode === 'default' ? null : (v.customCoordinates?.lng || null),
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
            const uaMode = window.ProfileModals?.CreateProfile?.GeneralTab?.uaModeToggle?.getValue?.() || 'random';
            console.log('[DEBUG:_collectBulkPayload] uaMode source:', uaMode, '| v.uaMode:', v.uaMode);

            // Map DoNotTrack toggle format to DB format: enabled->"1", disabled->"0", default->null
            const doNotTrackValue = v.doNotTrack === 'enabled' ? '1' : (v.doNotTrack === 'disabled' ? '0' : null);

            // Only send hardware/screen values when mode is 'custom' (Real = null, Random = null)
            const sendConcurrency = v.cpuMode === 'custom' ? (v.concurrency || null) : null;
            const sendDeviceMemory = v.cpuMode === 'custom' ? (v.deviceMemory || null) : null;
            const sendScreenWidth = v.screenMode === 'custom' && v.screenWidth ? parseInt(v.screenWidth, 10) : null;
            const sendScreenHeight = v.screenMode === 'custom' && v.screenHeight ? parseInt(v.screenHeight, 10) : null;
            const sendPixelRatio = v.screenMode === 'custom' ? (v.screenPixelRatio || null) : null;

            return {
                quantity: qty,
                prefix: prefix || null,
                groupId,
                tagIds: tagIds.length ? tagIds : null,
                browserType: (v.browser || 'chromium').charAt(0).toUpperCase() + (v.browser || 'chromium').slice(1),
                notes: v.notes || '',
                fingerprint: {
                    platform: v.os || null,
                    osModel: v.osModel || null,
                    // Real mode: no spoof, no UserAgent in DB; Custom mode: save UserAgent
                    uaMode,
                    userAgent: (uaMode === 'real') ? null : (v.userAgent || ''),
                    browserVersion: v.browserVersion || null,
                    languages: v.languages || ['en-US', 'en'],
                    timezone: v.timezone === 'auto' ? null : (v.timezone || null),
                    screenMode: v.screenMode || 'real',
                    screenWidth: sendScreenWidth,
                    screenHeight: sendScreenHeight,
                    screenPixelRatio: sendPixelRatio,
                    hardwareConcurrency: sendConcurrency,
                    deviceMemory: sendDeviceMemory,
                    cpuMode: v.cpuMode || null,
                    audioMode: v.audioMode || null,
                    webglMode: v.webglMode || null,
                    webglVendor: v.webglMode === 'custom' ? (v.webglVendor || null) : null,
                    webglRenderer: v.webglMode === 'custom' ? (v.webglRenderer || null) : null,
                    canvasMode: v.canvasMode || null,
                    // UI 'default' means "no spoof" → send null to backend
                    webglImageMode: v.webglImageMode === 'default' ? null : (v.webglImageMode || null),
                    pluginsMode: v.pluginsMode || null,
                    plugins: v.pluginsMode === 'custom' ? (v.plugins || []) : null,
                    fontsMode: v.fontsMode || null,
                    fonts: v.fontsMode === 'custom' ? (v.customFonts || []) : null,
                    webRTcMode: v.webrtcMode || 'disable',
                    sslMode: v.sslMode || null,
                    portScan: v.portScan || 'protect',
                    portBlockMode: v.portBlockMode || 'block_default',
                    portBlockList: v.portBlockList || [],
                    mediaDevicesMode: v.mediaDevices || null,
                    speechVoicesMode: v.speechVoices || null,
                    clientRectsMode: v.clientRects || null,
                    fontMetricsMode: v.fontMetricsMode || null,
                    doNotTrack: doNotTrackValue,
                    locationMode: v.locationMode || null,
                    latitude: v.locationMode === 'real' || v.locationMode === 'default' ? null : (v.customCoordinates?.lat || null),
                    longitude: v.locationMode === 'real' || v.locationMode === 'default' ? null : (v.customCoordinates?.lng || null),
                    accuracy: v.locationMode === 'real' || v.locationMode === 'default' ? null : (v.customCoordinates?.accuracy || null),
                }
            };
        },

        _clearFieldError(field) {
            if (field) {
                const ctrl = this._getFieldControl(field);
                if (ctrl && typeof ctrl.clearError === 'function') {
                    ctrl.clearError();
                }
            } else {
                const fields = ['userAgent', 'proxy.host', 'proxy.port', 'proxy.saved', 'location.lat', 'location.lng', 'webgl.vendor', 'webgl.renderer', 'display.resolution', 'portBlock.list'];
                fields.forEach(f => {
                    const ctrl = this._getFieldControl(f);
                    if (ctrl && typeof ctrl.clearError === 'function') {
                        ctrl.clearError();
                    }
                });
            }
        },

        _showFieldError(field, message) {
            const ctrl = this._getFieldControl(field);
            if (ctrl && typeof ctrl.setError === 'function') {
                ctrl.setError(message);
            }
        },

        _getFieldControl(field) {
            const genTab = window.ProfileModals?.CreateProfile?.GeneralTab;
            const netTab = window.ProfileModals?.CreateProfile?.NetworkTab;
            const hwTab = window.ProfileModals?.CreateProfile?.HardwareTab;
            const secTab = window.ProfileModals?.CreateProfile?.SecurityTab;

            const map = {
                name: () => this._nameCtrl,
                userAgent: () => genTab?.uaInput,
                'proxy.host': () => netTab?.pHost,
                'proxy.port': () => netTab?.pPort,
                'proxy.saved': () => netTab?.sProxy,
                'location.lat': () => netTab?.latIn,
                'location.lng': () => netTab?.lngIn,
                'webgl.vendor': () => hwTab?._webglVendorSelect,
                'webgl.renderer': () => hwTab?._rendererSelect,
                'display.resolution': () => hwTab?.resChipSelect,
                'portBlock.list': () => secTab?.portBlockListInput,
            };

            const finder = map[field];
            return finder ? finder() : null;
        },

        _validateBeforeSubmit() {
            const genTab = window.ProfileModals?.CreateProfile?.GeneralTab;
            const netTab = window.ProfileModals?.CreateProfile?.NetworkTab;
            const hwTab = window.ProfileModals?.CreateProfile?.HardwareTab;
            const secTab = window.ProfileModals?.CreateProfile?.SecurityTab;
            // #region debug log
            fetch('http://127.0.0.1:7838/ingest/b23e979e-49e7-4b7a-9d09-e180b500a667',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'971020'},body:JSON.stringify({sessionId:'971020',location:'CreateProfileModal.js:452',message:'validate tabs',data:{
                uaMode:genTab?.uaModeToggle?.getValue?.(),
                proxyMode:netTab?.proxyTypeToggle?.getValue?.(),
                locMode:netTab?.locationModeToggle?.getValue?.(),
                webglMode:hwTab?.webglMetaToggle?.getValue?.(),
                resMode:hwTab?.resToggle?.getValue?.(),
                portBlockMode:secTab?.portBlockModeSelect?.getValue?.()
            },timestamp:Date.now()})}).catch(()=>{});
            // #endregion

            const errors = [];

            // Validate userAgent is required when using custom mode
            const uaMode = genTab?.uaModeToggle?.getValue?.() || 'random';
            if (uaMode === 'custom') {
                const uaValue = genTab?.uaInput?.getValue?.()?.trim?.() || '';
                if (!uaValue) {
                    errors.push({ field: 'userAgent', message: 'User-Agent is required when using Custom mode' });
                }
            }

            // Validate Connection Type (Custom proxy)
            const proxyMode = netTab?.proxyTypeToggle?.getValue?.() || 'none';
            if (proxyMode === 'custom') {
                const host = netTab?.pHost?.getValue?.()?.trim();
                const port = netTab?.pPort?.getValue?.()?.trim();

                if (!host) {
                    errors.push({ field: 'proxy.host', message: 'IP address is required' });
                }
                if (!port) {
                    errors.push({ field: 'proxy.port', message: 'Port is required' });
                } else {
                    const portNum = parseInt(port, 10);
                    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
                        errors.push({ field: 'proxy.port', message: 'Port must be between 1 and 65535' });
                    }
                }
            }

            // Validate Connection Type (Saved proxy)
            if (proxyMode === 'saved') {
                const savedProxyId = netTab?.sProxy?.getValue?.() || '';
                if (!savedProxyId) {
                    errors.push({ field: 'proxy.saved', message: 'Please select a saved proxy' });
                }
            }

            // Validate Location Mode (Custom coordinates)
            const locationMode = netTab?.locationModeToggle?.getValue?.() || 'noise';
            if (locationMode === 'custom') {
                const lat = netTab?.latIn?.getValue?.()?.trim?.() || '';
                const lng = netTab?.lngIn?.getValue?.()?.trim?.() || '';
                if (!lat) {
                    errors.push({ field: 'location.lat', message: 'Latitude is required for Custom location mode' });
                } else {
                    const latNum = parseFloat(lat);
                    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
                        errors.push({ field: 'location.lat', message: 'Latitude must be between -90 and 90' });
                    }
                }
                if (!lng) {
                    errors.push({ field: 'location.lng', message: 'Longitude is required for Custom location mode' });
                } else {
                    const lngNum = parseFloat(lng);
                    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
                        errors.push({ field: 'location.lng', message: 'Longitude must be between -180 and 180' });
                    }
                }
            }

            // Validate WebGL Metadata (Custom mode)
            const webglMode = hwTab?.webglMetaToggle?.getValue?.() || 'random';
            if (webglMode === 'custom') {
                const vendor = hwTab?._webglVendorSelect?.getValue?.() || '';
                const renderer = hwTab?._rendererSelect?.getValue?.() || '';
                if (!vendor) {
                    errors.push({ field: 'webgl.vendor', message: 'GPU Vendor is required for Custom WebGL mode' });
                }
                if (!renderer) {
                    errors.push({ field: 'webgl.renderer', message: 'GPU Renderer is required for Custom WebGL mode' });
                }
            }

            // Validate Display & Graphics (Custom mode)
            const resMode = hwTab?.resToggle?.getValue?.() || 'random';
            if (resMode === 'custom') {
                const resolution = hwTab?.resChipSelect?.getValue?.() || '';
                if (!resolution) {
                    errors.push({ field: 'display.resolution', message: 'Please select a resolution preset' });
                }
            }

            // Validate Port Block Mode (allow_list or custom)
            const portBlockMode = secTab?.portBlockModeSelect?.getValue?.() || 'block_default';
            if (['allow_list', 'custom'].includes(portBlockMode)) {
                const portList = secTab?.portBlockListInput?.getValues?.() || [];
                if (!portList || portList.length === 0) {
                    errors.push({ field: 'portBlock.list', message: 'Port list is required for this Port Block mode' });
                }
            }

            return errors.length > 0 ? errors : null;
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
            const cpuMode = v.cpuMode;
            if (!cpuMode || cpuMode === 'real') return 'Real hardware';
            if (cpuMode === 'random') return 'Random hardware';
            if (v.concurrency != null && v.deviceMemory != null) {
                return `${v.concurrency} Cores, ${v.deviceMemory} GB RAM`;
            }
            return 'Custom hardware';
        },

        _fmtWebGL(v) {
            const webglMode = v.webglMode;
            if (!webglMode || webglMode === 'real') return 'Real (no spoof)';
            if (webglMode === 'random') return 'Random spoofed';
            if (v.webglVendor || v.webglRenderer) {
                const parts = [v.webglVendor, v.webglRenderer].filter(Boolean);
                const short = parts.map(p => p.length > 40 ? p.substring(0, 40) + '...' : p);
                return short.join('\n');
            }
            return 'Custom (no selection)';
        },

        _fmtProxy(v) {
            const netTab = window.ProfileModals?.CreateProfile?.NetworkTab;
            const proxyTypeLabel = (type) => netTab ? netTab._proxyTypeLabel(type) : String(type || 'HTTP').toUpperCase();
            
            if (v.proxyMode === 'none') return 'Without Proxy';
            if (v.proxyMode === 'saved') {
                const label = v.proxyDisplayName || `Saved Proxy #${v.savedProxyId || '-'}`;
                return `${label} (${proxyTypeLabel(v.proxyProtocol)})`;
            }
            if (v.proxyMode === 'custom') {
                const cfg = v.proxyConfig || v.customProxy || {};
                const host = cfg.Host || cfg.host || '';
                const port = cfg.Port || cfg.port || '';
                return `${proxyTypeLabel(v.proxyProtocol)}://${host}:${port}`;
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
            // Skip sync during profile loading to prevent overriding loaded values
            if (this._isLoadingProfile) return;
            if (this._syncTimer) clearTimeout(this._syncTimer);
            this._syncTimer = setTimeout(() => this._syncSummary(), 50);
        },

        /**
         * Cascade all OS-dependent controls from template.
         * Called by GeneralTab OS select onChange.
         * @param {string} osValue - The OS value to cascade to
         * @param {boolean} skipRandomize - If true, skip setting random values (used during profile load)
         */
        _cascadeOsChange(osValue, skipRandomize = false) {
            const tmpl = this._fpTemplate;

            const genTab = window.ProfileModals.CreateProfile.GeneralTab;
            const hwTab  = window.ProfileModals.CreateProfile.HardwareTab;
            const netTab = window.ProfileModals.CreateProfile.NetworkTab;
            const secTab = window.ProfileModals.CreateProfile.SecurityTab;
            const osBlock = tmpl.OS?.[osValue];

            //   -   -  GeneralTab: OS model select   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
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
                    // Preserve model if provided (from loaded profile) and exists in options
                    const preserveModel = genTab._preserveOsModelValue;
                    if (preserveModel && osModels.some(m => m.value === preserveModel)) {
                        genTab.osModelSelect.setValue(preserveModel);
                        genTab._preserveOsModelValue = null; // Clear after use
                    } else if (osModels.length > 0) {
                        genTab.osModelSelect.setValue(osModels[0].value);
                    }
                }
            }

            //   -   -  HardwareTab   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
            if (hwTab) {
                hwTab._currentOsBlock = osBlock;

                // HardwareTiers   -->  cpuChipSelect (value = "Concurrency-Memory")
                const tiers = osBlock?.HardwareTiers || [];
                const cpuTierOpts = tiers.map(t => ({
                    label: `${t.Concurrency} Cores / ${t.Memory} GB`,
                    value: `${t.Concurrency}-${t.Memory}`
                }));
                if (hwTab.cpuChipSelect) {
                    hwTab.cpuChipSelect.setOptions(cpuTierOpts);
                    // Only randomize in create mode (not during profile loading)
                    if (!skipRandomize && !this._isLoadingProfile && cpuTierOpts.length > 0) {
                        hwTab.cpuChipSelect.setValue(cpuTierOpts[0].value);
                    }
                }

                // ScreenPresets   -->  resChipSelect
                const presets = osBlock?.ScreenPresets || [];
                const resOpts = presets.map(p => ({
                    label: `${p.Width} Ã— ${p.Height} @${p.PixelRatio}x`,
                    value: `${p.Width}x${p.Height}x${p.PixelRatio}`
                }));
                if (hwTab.resChipSelect) {
                    hwTab.resChipSelect.setOptions(resOpts);
                    if (!skipRandomize && !this._isLoadingProfile && resOpts.length > 0) {
                        hwTab.resChipSelect.setValue(resOpts[0].value);
                    }
                }

                // WebGL vendors   -->  cascade to vendor + renderer
                const vendors = osBlock?.WebGL?.VendorGPUs
                    ? Object.keys(osBlock.WebGL.VendorGPUs)
                    : ['Google Inc. (NVIDIA)'];
                const vendorOpts = vendors.map(v => ({ label: v, value: v }));

                if (hwTab._webglVendorSelect) {
                    hwTab._webglVendorSelect.setOptions(vendorOpts);
                    // Only randomize in create mode
                    if (!skipRandomize && !this._isLoadingProfile && vendorOpts.length > 0) {
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
                    if (!skipRandomize && !this._isLoadingProfile && rendererOpts.length > 0) {
                        const randomRenderer = rendererOpts[Math.floor(Math.random() * rendererOpts.length)].value;
                        hwTab._rendererSelect.setValue(randomRenderer);
                    }
                }

                // Cascade completes — sync overview immediately (vendor/renderer already set above)
                if (this._syncTimer) clearTimeout(this._syncTimer);
                this._syncSummary();
            }

            //   -   -  NetworkTab: language options + timezone   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
            if (netTab) {
                if (netTab._langTagInput) {
                    const langOpts = (tmpl.Languages || []).map(l => ({
                        label: _LANG_LABELS[l] || l,
                        value: l
                    }));
                    netTab._langTagInput.setOptions(langOpts);
                    // Only seed defaults in create mode
                    if (!skipRandomize && !this._isLoadingProfile) {
                        const enOpts = langOpts.filter(o => ['en-US', 'en'].includes(o.value));
                        netTab._langTagInput.setValues(enOpts.map(o => o.value));
                    }
                }
                if (netTab.tzSelect) {
                    const tzOpts = (tmpl.Timezones || []).map(tz => ({ label: tz, value: tz }));
                    netTab.tzSelect.setOptions([{ label: 'Auto (Match IP)', value: 'auto' }, ...tzOpts]);
                    // Only set default in create mode
                    if (!skipRandomize && !this._isLoadingProfile) {
                        netTab.tzSelect.setValue('auto');
                    }
                }
            }

            //   -   -  SecurityTab: font options   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
            if (secTab) {
                if (secTab._fontTagInput) {
                    const fontOpts = (osBlock?.Fonts || []).map(f => ({ label: f, value: f }));
                    secTab._fontTagInput.setOptions(fontOpts);
                    // Only seed defaults in create mode (not during profile loading)
                    if (!skipRandomize && !this._isLoadingProfile) {
                        secTab._fontTagInput.setValues(fontOpts.slice(0, 3).map(o => o.value));
                    }
                }
            }

            this._scheduleSync();
        },

        /** Called when WebGL vendor changes — update renderer select. */
        _cascadeVendorChange(vendor) {
            // Skip cascade during profile loading
            if (this._isLoadingProfile) return;

            const tmpl = this._fpTemplate;
            const genTab = window.ProfileModals.CreateProfile.GeneralTab;
            const hwTab  = window.ProfileModals.CreateProfile.HardwareTab;
            const osVal = genTab?._osSelectCtrl?.getValue?.() || null;
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

        /** Show modal - accepts optional profileId for edit mode */
        async show(profileId) {
            if (this._modal) { this._modal.destroy(); this._modal = null; }
            this._modal = null;
            this._mode = profileId ? 'edit' : 'create';
            this._editProfileId = profileId || null;
            this._originalProfileData = null;
            this._loadedDbValues = null; // clear cached DB values from previous load

            //   -   -  Loading / Error state   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
            const loadingWrap = document.createElement('div');
            loadingWrap.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; height: 100%; gap: 12px;';
            const spinner = document.createElement('div');
            spinner.style.cssText = 'width: 40px; height: 40px; border: 3px solid var(--border-default); border-top-color: var(--accent); border-radius: 50%; animation: duckSpin 0.8s linear infinite;';
            const spinKeyframes = document.createElement('style');
            spinKeyframes.textContent = '@keyframes duckSpin { to { transform: rotate(360deg); } }';
            loadingWrap.appendChild(spinKeyframes);
            loadingWrap.appendChild(spinner);
            const loadingLabel = document.createElement('div');
            loadingLabel.style.cssText = 'font-size: 13px; color: var(--text-secondary);';
            loadingLabel.textContent = this._mode === 'edit' ? 'Loading profile data...' : 'Loading profile data...';
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

            // Modal title based on mode
            const modalTitle = this._mode === 'edit' ? 'Edit Profile' : 'Create Profile';
            const modalSubtitle = this._mode === 'edit'
                ? 'Configure and update the isolated browser fingerprint environment.'
                : 'Configure and generate a new isolated browser fingerprint environment.';
            const modalIcon = this._mode === 'edit' ? 'edit' : 'add_circle';
            const submitButtonText = this._mode === 'edit' ? 'Save Changes' : 'Create Profile';
            const submitButtonIcon = this._mode === 'edit' ? 'save' : 'add';

            // Modal — submit button disabled until data loads
            this._modal = window.DuckControls.Modal.create({
                defaultEnter: true,
                preventAutoFocus: true,
                title: modalTitle,
                subtitle: modalSubtitle,
                icon: modalIcon,
                content: loadingContent,
                size: 'xxl',
                buttons: [
                    { text: 'Cancel', class: 'duck-btn-ghost', onClick: () => this._modal?.close() },
                    {
                        text: submitButtonText, class: 'duck-btn-primary', isDefault: true, icon: submitButtonIcon, disabled: true,
                        onClick: async () => {
                            if (this._isSubmitting) return;
                            this._isSubmitting = true;

                            const _enableSubmit = (disabled) => {
                                const btn = this._modal?._buttons?.find(b => b.element?.classList?.contains('duck-btn-primary'));
                                if (btn) btn.setDisabled(disabled);
                            };
                            _enableSubmit(true);

                            const mode = this._modeCtrl?.getValue?.() || 'single';
                            const qty = mode === 'bulk' ? (this._qtyCtrl?.getValue?.() || 1) : 1;
                            const nameVal = this._nameInput?.querySelector('input')?.value?.trim?.() || null;

                            // Validate before submitting
                            let validationError = null;
                            try {
                                validationError = this._validateBeforeSubmit();
                            } catch (err) {
                                _enableSubmit(false);
                                this._isSubmitting = false;
                                window.DuckControls.Toast?.error?.("Validation crashed: " + (err.message || String(err)));
                                return;
                            }

                            if (validationError) {
                                _enableSubmit(false);
                                this._isSubmitting = false;
                                this._clearFieldError();
                                if (Array.isArray(validationError)) {
                                    validationError.forEach(err => this._showFieldError(err.field, err.message));
                                } else {
                                    this._showFieldError(validationError.field, validationError.message);
                                }
                                return;
                            }
                            this._clearFieldError();

                            try {
                                this._modal.setLoading(true, this._mode === 'edit' ? 'Saving profile...' : (qty > 1 ? `Creating ${qty} profiles...` : 'Creating profile...'));

                                console.log('[DEBUG:submit] mode:', this._mode, 'editProfileId:', this._editProfileId);
                                if (this._mode === 'edit') {
                                    await this._saveProfile();
                                } else {
                                    let results;
                                    if (qty > 1) {
                                        const payload = this._collectBulkPayload(qty, nameVal);
                                        console.log('[DEBUG:ACTUAL_PAYLOAD_BULKCREATE]', JSON.stringify(payload, null, 2));
                                        results = await DuckBridge.call('profile.bulkCreate', payload);
                                    } else {
                                        const payload = this._collectPayload(nameVal || null);
                                        console.log('[DEBUG:FE_TO_BACKEND_CREATE]', JSON.stringify(payload, null, 2));
                                        const result = await DuckBridge.call('profile.create', payload);
                                        console.log('[DEBUG:FE_FROM_BACKEND_CREATE]', JSON.stringify(result, null, 2));
                                        results = [result];
                                    }
                                    try {
                                        window.dispatchEvent(new CustomEvent('profile-created', { detail: results }));
                                    } catch (e) { }
                                    if (this._onCreated) this._onCreated(results);
                                }

                                this._modal.setLoading(false);
                                this._isSubmitting = false;
                                this._modal.close();
                            } catch (err) {
                                this._modal.setLoading(false);
                                const msg = err?.message || String(err);
                                console.error('[CreateProfile] operation failed:', msg);
                                _enableSubmit(false);
                                this._isSubmitting = false;
                                this._clearFieldError();
                                window.DuckControls.Toast?.error?.(msg);
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
                    this._isSubmitting = false;
                    this._mode = 'create';
                    this._editProfileId = null;
                    this._originalProfileData = null;
                    if (this._syncTimer) clearTimeout(this._syncTimer);
                }
            });

            const showError = (msg) => {
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
                const footer = this._modal?.container?.querySelector('.duck-modal-footer');
                if (footer) footer.style.display = 'none';
            };

            this._modal.open();

            //   -   -  Load data   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
            await this._loadEntityData();

            // In edit mode, load profile data and generate defaults for merging
            let profileDefaults = null;
            if (this._mode === 'edit' && this._editProfileId) {
                try {
                    const profile = await DuckBridge.call('profile.get', { id: this._editProfileId });
                    console.log('[DEBUG:FE_FROM_BACKEND_LOAD]', JSON.stringify(profile, null, 2));
                    console.log('[CreateProfile] Raw profile from API:', JSON.stringify(profile, null, 2));
                    console.log('[CreateProfile] profile keys:', Object.keys(profile || {}));
                    console.log('[CreateProfile] profile.ok:', profile?.ok, 'profile.data:', !!profile?.data, 'profile.id:', profile?.id, 'profile.name:', profile?.name);
                    // [DEBUG:EDIT_LOAD] log full profile for backend data inspection
                    console.log('[DEBUG:EDIT_LOAD]', JSON.stringify({
                        id: profile?.id,
                        name: profile?.name,
                        browserType: profile?.browserType,
                        browserVersion: profile?.browserVersion,
                        groupId: profile?.groupId,
                        tagIds: profile?.tagIds,
                        proxyId: profile?.proxyId,
                        notes: profile?.notes,
                        cookies: profile?.cookies,
                        profileData_TYPEOF: typeof profile?.ProfileData,
                        profileData_LENGTH: profile?.ProfileData?.length,
                        profileData_VALUE: profile?.ProfileData,
                        profileDataParsed_EXISTS: profile?.ProfileDataParsed !== undefined,
                        profileDataParsed: profile?.ProfileDataParsed,
                    }, null, 2));
                    if (profile) {
                        this._originalProfileData = profile;
                        loadingLabel.textContent = 'Applying profile settings...';

                        // Generate fingerprint defaults for this platform/browser
                        const platform = profile.BrowserType === 'Firefox' ? 'Linux' : 'Win32';
                        const browserType = profile.BrowserType || null;
                        try {
                            profileDefaults = await DuckBridge.call('profile.generateFingerprint', {
                                platform: platform,
                                browser: browserType,
                                version: profile.BrowserVersion || profile.browserVersion || null,
                                model: null
                            });
                            console.log('[CreateProfile] Generated defaults for merge:', JSON.stringify(profileDefaults, null, 2));
                        } catch (e) {
                            console.warn('[CreateProfile] Failed to generate defaults:', e);
                        }

                        // Parse ProfileData once for use in _buildUpdatePayload
                        if (profile.ProfileData) {
                            try {
                                this._originalProfileData.ProfileDataParsed =
                                    JSON.parse(profile.ProfileData);
                                console.log('[CreateProfile] Parsed ProfileData for update payload:', JSON.stringify(this._originalProfileData.ProfileDataParsed, null, 2));
                            } catch (e) {
                                console.warn('[CreateProfile] Failed to parse ProfileData:', e);
                                this._originalProfileData.ProfileDataParsed = {};
                            }
                        } else {
                            this._originalProfileData.ProfileDataParsed = {};
                        }
                    } else {
                        showError('Profile not found.');
                        return;
                    }
                } catch (e) {
                    console.error('[CreateProfile] Failed to load profile:', e);
                    showError('Failed to load profile data. Please try again.');
                    return;
                }
            }

            const template = await this._loadFingerprintTemplate();

            if (!template) {
                showError('Failed to load profile data. Please check your connection and try again.');
                return;
            }

            this._fpTemplate = template;
            //   -   -  Build form and replace skeleton   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   -   - 
            const container = this._buildFormContainer(template);

            const modalBody = this._modal?.container?.querySelector('.duck-modal-body');
            if (modalBody) {
                modalBody.innerHTML = '';
                modalBody.appendChild(container);
                modalBody.style.cssText = 'display:flex;flex-direction:column;overflow:hidden;padding:0;';
            }

            // Pass data to all tabs AFTER form is built (controls now exist)
            ['GeneralTab', 'NetworkTab', 'HardwareTab', 'SecurityTab', 'CookiesTab', 'NotesTab'].forEach(tabName => {
                const tab = window.ProfileModals.CreateProfile[tabName];
                if (tab?._setTemplate) tab._setTemplate(template);
            });

            // Set up callback for GeneralTab OS change cascade (used by setValues in edit mode)
            const genTab = window.ProfileModals?.CreateProfile?.GeneralTab;
            if (genTab) {
                genTab._onOsChange = (osValue) => this._cascadeOsChange(osValue);
                genTab._onModelChange = (modelValue) => {
                    // Trigger HardwareTab to update based on new OS model
                    const hwTab = window.ProfileModals?.CreateProfile?.HardwareTab;
                    if (hwTab?._onOsModelChange) hwTab._onOsModelChange(modelValue);
                };
            }

            // Apply profile data if in edit mode
            if (this._mode === 'edit' && this._originalProfileData) {
                // Prevent _scheduleSync from running during profile load
                this._isLoadingProfile = true;
                console.log('[CreateProfile] About to call _applyProfileData, _isLoadingProfile=true');
                
                // FIRST: Populate options by calling cascade (skip randomization via flag)
                const genTab = window.ProfileModals?.CreateProfile?.GeneralTab;
                const osValue = genTab?.osSelect?.getValue?.() || 'Windows';
                this._cascadeOsChange(osValue, true);
                
                // THEN: Apply profile values to controls
                this._applyProfileData(this._originalProfileData, profileDefaults);
                
                // Wait for async option hydration in tabs before enabling sync
                setTimeout(() => {
                    this._isLoadingProfile = false;
                    console.log('[CreateProfile] setTimeout fired, calling _scheduleSync');
                    // Sync overview once after loading is complete
                    this._scheduleSync();
                    // Enable submit button after edit profile loads
                    if (this._modal) {
                        const primaryBtn = this._modal._buttons?.find(b => b.element?.classList?.contains('duck-btn-primary'));
                        if (primaryBtn) primaryBtn.setDisabled(false);
                        else this._modal.container.querySelector('.duck-btn-primary').disabled = false;
                    }
                }, 250);
            } else {
                this._cascadeOsChange('Windows');
                // Automatically generate a fingerprint so the modal is fully populated
                this._isLoadingProfile = true;
                DuckBridge.call('profile.generateFingerprint', {
                    platform: 'Windows',
                    browser: 'chromium',
                    version: null,
                    model: null
                }).then(fp => {
                    this._applyFingerprintResponse(fp);
                }).catch(e => {
                    console.warn('[CreateProfile] Auto-generate fingerprint failed', e);
                }).finally(() => {
                    this._isLoadingProfile = false;
                    // Enable submit button after fingerprint is ready (or failed)
                    if (this._modal) {
                        const primaryBtn = this._modal._buttons?.find(b => b.element?.classList?.contains('duck-btn-primary'));
                        if (primaryBtn) primaryBtn.setDisabled(false);
                        else this._modal.container.querySelector('.duck-btn-primary').disabled = false;
                    }
                });
            }

            // Enable submit button now that form is ready
            const primaryBtnFinal = this._modal?._buttons?.find(b => b.element?.classList?.contains('duck-btn-primary'));
            if (primaryBtnFinal) {
                primaryBtnFinal.setDisabled(false);
            } else {
                const submitBtn = this._modal?.container?.querySelector('.duck-btn-primary');
                if (submitBtn) submitBtn.disabled = false;
            }
        },

        /** Apply loaded profile data to all form controls - merge with defaults for missing fields */
        _applyProfileData(profile, profileDefaults) {
            console.log('[CreateProfile] _applyProfileData called - profile.ProfileData:', profile?.ProfileData);
            console.log('[CreateProfile] _applyProfileData - profileDefaults:', JSON.stringify(profileDefaults, null, 2));
            console.log('[CreateProfile] _applyProfileData - tab existence:', {
                GeneralTab: !!window.ProfileModals.CreateProfile.GeneralTab,
                NetworkTab: !!window.ProfileModals.CreateProfile.NetworkTab,
                HardwareTab: !!window.ProfileModals.CreateProfile.HardwareTab,
                SecurityTab: !!window.ProfileModals.CreateProfile.SecurityTab,
                CookiesTab: !!window.ProfileModals.CreateProfile.CookiesTab,
                NotesTab: !!window.ProfileModals.CreateProfile.NotesTab,
            });

            // Parse ProfileData JSON if exists
            let profileData = {};
            if (profile.ProfileData) {
                try {
                    profileData = JSON.parse(profile.ProfileData);
                    console.log('[CreateProfile] Loaded ProfileData:', JSON.stringify(profileData, null, 2));
                } catch (e) {
                    console.warn('[CreateProfile] Failed to parse ProfileData:', e);
                }
            } else {
                console.warn('[CreateProfile] WARNING: No ProfileData in profile! Using defaults.');
            }

            // Helper: merge value from ProfileData, fallback to defaults
            // Treat null/undefined/empty as "missing" and use defaults
            const getValue = (profileValue, defaultValue) => {
                // Check if profileValue is "missing" (undefined, null, empty string, or empty array)
                const isMissing = profileValue === undefined
                    || profileValue === null
                    || profileValue === ''
                    || (Array.isArray(profileValue) && profileValue.length === 0);
                return isMissing ? defaultValue : profileValue;
            };
            // Preserve null as a valid value (for Real mode)
            const getValueOrDefault = (profileValue, defaultValue) => {
                if (profileValue !== undefined && profileValue !== null && profileValue !== '') {
                    return profileValue;
                }
                return defaultValue;
            };
            const toLowerOrNull = (value) => {
                if (value === undefined || value === null || value === '') return null;
                return String(value).toLowerCase();
            };
            // Map null/empty to defaultValue, otherwise lowercase the value
            // For Real/Noise toggles: pass 'real' as defaultValue
            // For Noise-only toggles: pass 'noise' as defaultValue
            const nullMode = (value, defaultValue) => {
                if (value == null || value === '') return defaultValue;
                return String(value).toLowerCase() || defaultValue;
            };

            // NEW SCHEMA HELPERS: TypedConfig<*> has { Mode, Value } structure
            // Extract .Value (or raw value for old schema compatibility)
            const tcValue = (tc) => {
                if (tc == null) return null;
                if (typeof tc === 'object' && 'Value' in tc) return tc.Value; // new TypedConfig schema
                return tc; // old schema: raw value
            };
            const tcMode = (tc) => {
                if (tc == null) return null;
                if (typeof tc === 'object' && 'Mode' in tc) return tc.Mode; // new TypedConfig schema
                return null; // old schema has no mode   -->  treat as null (real)
            };

            // 1. Apply to Name/Group/Tags in sticky header
            const nameInput = this._nameInput?.querySelector('input');
            if (nameInput) {
                nameInput.value = profile.Name || profile.name || '';
            }

            // Set Group value
            if (this._groupCtrl) {
                const groupId = profile.GroupId || profile.groupId;
                if (groupId) {
                    this._groupCtrl.setValue(String(groupId));
                }
            }

            // Set Tags values
            if (this._tagCtrl) {
                const tagIds = profile.TagIds || profile.tagIds || [];
                if (tagIds.length > 0) {
                    this._tagCtrl.setValues(tagIds.map(String));
                }
            }

            // 2. Apply to each tab - parse structure from backend
            const systemConfig = profileData.System || {};
            const fingerprintConfig = profileData.Fingerprint || {};
            const networkConfig = profileData.Network || {};
            const securityConfig = profileData.Security || {};
            const locationConfig = profileData.Location || {};

            // Extract screen values from Screen object
            // Extract screen values - ALWAYS extract from DB (even when Mode=random, backend generated specific values)
            const screenConfig = systemConfig.Screen || {};
            const dbScreenWidth = screenConfig.Width || null;
            const dbScreenHeight = screenConfig.Height || null;
            const dbScreenPixelRatio = screenConfig.PixelRatio || null;
            const hasSpecificScreen = dbScreenWidth != null && dbScreenHeight != null;
            const rawScreenMode = screenConfig.Mode != null ? String(screenConfig.Mode).toLowerCase() : null;
            
            // Respect explicit mode from DB. Fallback to 'custom' if dimensions exist, otherwise 'random'
            const resolvedScreenMode = rawScreenMode === 'random' ? 'random' 
                                     : rawScreenMode === 'real' ? 'real'
                                     : rawScreenMode === 'custom' ? 'custom'
                                     : (hasSpecificScreen ? 'custom' : 'random');

            // screenWidth/screenHeight for HW tab: show only when resolved as 'custom'
            const screenWidth = resolvedScreenMode === 'custom' ? dbScreenWidth : null;
            const screenHeight = resolvedScreenMode === 'custom' ? dbScreenHeight : null;
            const screenPixelRatio = resolvedScreenMode === 'custom' ? dbScreenPixelRatio : null;

            // Extract language from System - defaults may have comma-separated string
            let defaultLanguage = 'en-US';
            if (profileDefaults?.languages) {
                if (typeof profileDefaults.languages === 'string') {
                    defaultLanguage = profileDefaults.languages.split(',')[0].trim();
                } else if (Array.isArray(profileDefaults.languages)) {
                    defaultLanguage = profileDefaults.languages[0];
                }
            }

            // Hardcoded platform mapping (Win32 -> Windows, etc.)
            const platformMap = {
                'Win32': 'Windows', 'Win64': 'Windows',
                'Darwin': 'macOS', 'Linux': 'Linux'
            };

            // Platform: TypedConfig -> extract Value; old schema: raw string
            const platformVal = tcValue(systemConfig.Platform) || 'Win32';
            const mappedOs = platformMap[platformVal] || platformVal || null;

            // OS Model: derive from profile data or template
            const osBlock = this._fpTemplate?.OS?.[mappedOs] || {};
            const osModel = profile.OsModel || profile.osModel
                || (osBlock?.Models?.[0]?.Name || null);

            // Language/AcceptLanguage: TypedConfig or raw string
            const systemLanguage = getValue(
                tcValue(systemConfig.Language) || tcValue(systemConfig.AcceptLanguage),
                defaultLanguage
            );

            // Pre-compute CPU/Hardware mode (needed for _loadedDbValues below)
            const hwConcurrencyEarly = tcValue(systemConfig.HardwareConcurrency);
            const hwModeEarly = tcMode(systemConfig.HardwareConcurrency) || tcMode(systemConfig.DeviceMemory);
            const rawCpuMode = hwModeEarly != null ? String(hwModeEarly).toLowerCase() : null;
            const hasSpecificHardwareEarly = hwConcurrencyEarly != null && hwConcurrencyEarly > 0;
            
            const cpuMode = rawCpuMode === 'random' ? 'random'
                          : rawCpuMode === 'real' ? 'real'
                          : rawCpuMode === 'custom' ? 'custom'
                          : (hasSpecificHardwareEarly ? 'custom' : getValue(toLowerOrNull(fingerprintConfig.CpuMode), 'random'));

            const rawTimezoneEarly = tcValue(systemConfig.Timezone) || tcValue(fingerprintConfig.Timezone) || null;
            const rawTimezoneMode = tcMode(systemConfig.Timezone) || tcMode(fingerprintConfig.Timezone);
            
            let resolvedTimezone = 'auto';
            if (rawTimezoneMode === 'real') {
                resolvedTimezone = 'real';
            } else if (rawTimezoneMode === 'noise') {
                resolvedTimezone = rawTimezoneEarly ? rawTimezoneEarly : 'auto';
            }

            // Pre-compute WebGL mode
            const rawWebglMode = fingerprintConfig.WebGL?.Mode != null ? String(fingerprintConfig.WebGL?.Mode).toLowerCase() : null;
            const hasSpecificWebGL = fingerprintConfig.WebGL?.Vendor || fingerprintConfig.WebGL?.Renderer;
            const resolvedWebGLMode = rawWebglMode === 'random' ? 'random'
                                    : rawWebglMode === 'real' ? 'real'
                                    : rawWebglMode === 'custom' ? 'custom'
                                    : (hasSpecificWebGL ? 'custom' : 'random');

            const genTab = window.ProfileModals.CreateProfile.GeneralTab;
            if (genTab) {
                // UA Mode: read from systemConfig.UaMode (single source of truth)
                // DB null/empty -> 'real' (browser uses real UA)
                // DB 'custom'/'noise'/'random' -> use as-is
                // If DB has a concrete UserAgent -> it's effectively 'custom'
                const rawUaMode = (() => {
                    if (systemConfig.UaMode != null && systemConfig.UaMode !== '') {
                        return String(systemConfig.UaMode).toLowerCase();
                    } else if (fingerprintConfig.UaMode != null && fingerprintConfig.UaMode !== '') {
                        return String(fingerprintConfig.UaMode).toLowerCase();
                    } else if (systemConfig.UseRealUserAgent === true || fingerprintConfig.UseRealUserAgent === true) {
                        return 'real';
                    }
                    return 'real';
                })();
                // Check if DB has a concrete UserAgent (stored in systemConfig.UserAgent)
                const dbUA = tcValue(systemConfig.UserAgent) || tcValue(fingerprintConfig.UserAgent) || '';
                const hasSpecificUA = dbUA !== '';
                // If DB has concrete UA -> mode is 'custom' (editable); otherwise use raw mode
                const uaMode = hasSpecificUA ? 'custom' : (rawUaMode || 'real');

                // Real mode: do NOT load/save any UserAgent (system uses real browser UA)
                // Other modes (random/custom): always load the concrete UA so overview can display it
                const uaRaw = uaMode === 'real' ? '' : (dbUA || getValue(profileDefaults?.userAgent, ''));
                const genValues = {
                    os: mappedOs,
                    osModel: osModel,
                    browser: getValue(profile.BrowserType || profile.browserType, profileDefaults?.browserType || null),
                    browserVersion: getValue(profile.BrowserVersion || profile.browserVersion || systemConfig.BrowserVersion, profileDefaults?.browserVersion || null),
                    userAgent: uaRaw,
                    startUrl: getValue(profileData.Profile?.StartURL, ''),
                    uaMode: uaMode,
                    _dbUserAgent: uaRaw // pass through so GeneralTab can populate the input
                };

                // Store loaded DB values so _syncSummary can read them directly
                this._loadedDbValues = {
                    uaMode: uaMode,
                    userAgent: uaRaw,
                    screenMode: resolvedScreenMode,
                    screenWidth: screenWidth,
                    screenHeight: screenHeight,
                    screenPixelRatio: screenPixelRatio,
                    cpuMode: cpuMode,
                    concurrency: hwConcurrencyEarly || null,
                    deviceMemory: tcValue(systemConfig.DeviceMemory) || null,
                    timezone: resolvedTimezone,
                    webglMode: resolvedWebGLMode,
                    webglVendor: getValue(fingerprintConfig.WebGL?.Vendor, profileDefaults?.webglVendor || null),
                    webglRenderer: getValue(fingerprintConfig.WebGL?.Renderer, profileDefaults?.webglRenderer || null),
                };
                console.log('[CreateProfile] _loadedDbValues stored:', JSON.stringify(this._loadedDbValues, null, 2));
                console.log('[CreateProfile] Applying GeneralTab values:', JSON.stringify(genValues, null, 2));
                console.log('[CreateProfile] genTab exists:', !!genTab, 'genTab.setValues exists:', !!genTab?.setValues);
                if (genTab?.setValues) genTab.setValues(genValues);
            }

            // NetworkTab
            const netTab = window.ProfileModals.CreateProfile.NetworkTab;
            if (netTab) {
                // Parse timezone - use pre-computed rawTimezone
                const timezone = rawTimezoneEarly === null || rawTimezoneEarly === undefined ? 'auto' : (rawTimezoneEarly || 'auto');

                // Parse languages - defaults may have comma-separated string or array
                let defaultLanguages = ['en-US', 'en'];
                if (profileDefaults?.languages) {
                    if (typeof profileDefaults.languages === 'string') {
                        defaultLanguages = profileDefaults.languages.split(',').map(l => l.trim());
                    } else if (Array.isArray(profileDefaults.languages)) {
                        defaultLanguages = profileDefaults.languages;
                    }
                }
                let languages = defaultLanguages;
                const langMode = tcMode(systemConfig.Language) || tcMode(fingerprintConfig.Language);
                if (langMode === 'real') {
                    languages = [];
                } else if (fingerprintConfig.Languages && Array.isArray(fingerprintConfig.Languages) && fingerprintConfig.Languages.length > 0) {
                    languages = fingerprintConfig.Languages;
                } else if (systemLanguage) {
                    languages = Array.isArray(systemLanguage) ? systemLanguage : [systemLanguage];
                }

                const proxyConfig = networkConfig.Proxy || {};
                const proxyMode = toLowerOrNull(proxyConfig.Mode) || 'none';
                // Location Mode: null (Real) -> 'real', otherwise use value or default 'noise'
                const locationMode = nullMode(locationConfig.Mode, nullMode(profileDefaults?.locationMode, 'noise'));
                const netValues = {
                    proxyMode,
                    proxyConfig,
                    savedProxyId: proxyConfig.SavedProxyId || profile.ProxyId || null,
                    timezone,
                    languages,
                    locationMode,
                    customCoordinates: locationMode === 'custom'
                        ? {
                            lat: getValue(locationConfig.Latitude, profileDefaults?.latitude || null),
                            lng: getValue(locationConfig.Longitude, profileDefaults?.longitude || null),
                            accuracy: getValue(locationConfig.Accuracy, profileDefaults?.accuracy || 100)
                        }
                        : null
                };
                console.log('[CreateProfile] Applying NetworkTab values:', JSON.stringify(netValues, null, 2));
                console.log('[CreateProfile] netTab exists:', !!netTab, 'netTab.setValues exists:', !!netTab?.setValues);
                if (netTab?.setValues) netTab.setValues(netValues);
            }

            console.log('[CreateProfile] DEBUG fingerprintConfig keys:', Object.keys(fingerprintConfig));
            console.log('[CreateProfile] DEBUG WebGL config:', JSON.stringify(fingerprintConfig.WebGL, null, 2));
            console.log('[CreateProfile] DEBUG Canvas config:', JSON.stringify(fingerprintConfig.Canvas, null, 2));
            console.log('[CreateProfile] DEBUG MediaDevices config:', JSON.stringify(fingerprintConfig.MediaDevices, null, 2));
            console.log('[CreateProfile] DEBUG SpeechVoicesMode:', fingerprintConfig.SpeechVoicesMode);
            console.log('[CreateProfile] DEBUG ClientRects config:', JSON.stringify(fingerprintConfig.ClientRects, null, 2));
            console.log('[CreateProfile] DEBUG DoNotTrack:', fingerprintConfig.DoNotTrack);

            // HardwareTab
            const hwTab = window.ProfileModals.CreateProfile.HardwareTab;
            if (hwTab) {
                // CPU Hardware: reuse early-computed cpuMode and resolvedScreenMode
                const hwConcurrency = tcValue(systemConfig.HardwareConcurrency) || null;
                const hwMemory = tcValue(systemConfig.DeviceMemory) || null;

                const hwValues = {
                    os: mappedOs,
                    cpuMode,
                    // TypedConfig: extract Value or fall back to raw int
                    concurrency: getValue(hwConcurrency, profileDefaults?.hardwareConcurrency || null),
                    deviceMemory: getValue(hwMemory, profileDefaults?.deviceMemory || null),
                    screenMode: resolvedScreenMode,
                    screenWidth: screenWidth,
                    screenHeight: screenHeight,
                    screenPixelRatio: screenPixelRatio,
                    // Canvas null in DB = 'real' (no spoofing)
                    canvasMode: nullMode(fingerprintConfig.Canvas?.Mode, 'real'),
                    webglMode: resolvedWebGLMode,
                    webglVendor: getValue(fingerprintConfig.WebGL?.Vendor, profileDefaults?.webglVendor || null),
                    webglRenderer: getValue(fingerprintConfig.WebGL?.Renderer, profileDefaults?.webglRenderer || null),
                    // WebGL image mode: 'real' if mode is real, else pattern
                    webglImageMode: fingerprintConfig.WebGL?.ImageSpoofing?.Mode === 'real' 
                        ? 'real' 
                        : nullMode(fingerprintConfig.WebGL?.ImageSpoofing?.Pattern, 'default'),
                    // Plugins null = 'noise'
                    pluginsMode: nullMode(tcMode(fingerprintConfig.Plugins) || fingerprintConfig.PluginsMode, 'noise')
                };
                console.log('[CreateProfile] Applying HardwareTab values:', JSON.stringify(hwValues, null, 2));
                console.log('[CreateProfile] hwTab exists:', !!hwTab, 'hwTab.setValues exists:', !!hwTab?.setValues);
                if (hwTab?.setValues) hwTab.setValues(hwValues, this._fpTemplate);
            }

            // SecurityTab
            const secTab = window.ProfileModals.CreateProfile.SecurityTab;
            if (secTab) {
                // Map DoNotTrack from DB: new schema has { Mode, Value }, old schema has raw string
                const dntConfig = fingerprintConfig.DoNotTrack;
                const dntValue = tcValue(dntConfig) || null; // .Value or raw string
                let doNotTrackValue = 'default';
                if (dntValue === '1' || dntValue === 1) {
                    doNotTrackValue = 'enabled';
                } else if (dntValue === '0' || dntValue === 0) {
                    doNotTrackValue = 'disabled';
                } else if (dntValue !== null && dntValue !== undefined) {
                    if (String(dntValue).toLowerCase() === 'enabled') doNotTrackValue = 'enabled';
                    else if (String(dntValue).toLowerCase() === 'disabled') doNotTrackValue = 'disabled';
                }

                // Fonts: new schema   -->  .FontList array; old schema   -->  raw string[]
                const fontsList = fingerprintConfig.Fonts?.FontList || fingerprintConfig.Fonts || [];
                // FontsMode: new schema   -->  .Mode; old schema   -->  .FontsMode string
                const fontsMode = tcMode(fingerprintConfig.Fonts) || fingerprintConfig.FontsMode || fingerprintConfig.Fonts?.Mode;

                const secValues = {
                    webrtcMode: toLowerOrNull(fingerprintConfig.WebRTcMode || fingerprintConfig.WebRtcMode) || toLowerOrNull(profileDefaults?.WebRTcMode || profileDefaults?.webRtcMode) || 'disable',
                    sslMode: toLowerOrNull(fingerprintConfig.SslMode) || toLowerOrNull(profileDefaults?.SslMode || profileDefaults?.sslMode) || 'noise',
                    portScan: getValue(toLowerOrNull(securityConfig.PortScan), profileDefaults?.portScan || 'protect'),
                    portBlockMode: getValue(securityConfig.PortBlockMode, profileDefaults?.portBlockMode || 'block_default'),
                    portBlockList: getValue(securityConfig.PortBlockList, profileDefaults?.portBlockList || []),
                    // null in DB = 'real' for Real/Noise toggles
                    mediaDevices: nullMode(fingerprintConfig.MediaDevices?.Mode, 'real'),
                    audioMode: nullMode(fingerprintConfig.Audio?.Mode, 'real'),
                    speechVoices: nullMode(fingerprintConfig.SpeechVoicesMode, 'real'),
                    clientRects: nullMode(fingerprintConfig.ClientRects?.Mode, 'real'),
                    fontMetricsMode: (fingerprintConfig.FontMetrics?.Mode === 'real' || !fingerprintConfig.FontMetrics?.Mode) ? 'default' : String(fingerprintConfig.FontMetrics.Mode).toLowerCase(),
                    // null or 'real' fontsMode = 'default' (toggle only has default/custom)
                    fontsMode: (fontsMode === 'real' || !fontsMode) ? 'default' : String(fontsMode).toLowerCase(),
                    customFonts: Array.isArray(fontsList) ? fontsList : [],
                    doNotTrack: doNotTrackValue
                };
                console.log('[CreateProfile] Applying SecurityTab values:', JSON.stringify(secValues, null, 2));
                console.log('[CreateProfile] secTab exists:', !!secTab, 'secTab.setValues exists:', !!secTab?.setValues);
                if (secTab?.setValues) secTab.setValues(secValues);
            }

            // CookiesTab
            const cookiesTab = window.ProfileModals.CreateProfile.CookiesTab;
            const cookiesData = profile.Cookies || profile.cookies || '';
            if (cookiesTab && cookiesData) {
                cookiesTab.setValues({ cookiesData: cookiesData });
            }

            // NotesTab
            const notesTab = window.ProfileModals.CreateProfile.NotesTab;
            if (notesTab) {
                notesTab.setValues({ notes: profile.Notes || profile.notes || '' });
            }

            // Sync overview
            this._scheduleSync();
        },

        /** Save profile in edit mode */
        async _saveProfile() {
            console.log('[DEBUG:_saveProfile] mode:', this._mode, 'editProfileId:', this._editProfileId);
            if (!this._editProfileId) {
                console.error('[DEBUG:_saveProfile] NO editProfileId - returning early');
                return;
            }

            const payload = await this._buildUpdatePayload();
            console.log('[DEBUG:FE_TO_BACKEND_UPDATE]', JSON.stringify(payload, null, 2));
            console.log('[CreateProfile] _saveProfile - full payload:', JSON.stringify(payload, null, 2));
            console.log('[CreateProfile] _saveProfile - profileData parsed:', JSON.parse(payload.profileData || '{}'));
            const result = await DuckBridge.call('profile.update', payload);
            console.log('[DEBUG:FE_FROM_BACKEND_UPDATE]', JSON.stringify(result, null, 2));

            // Reload profiles table
            if (window.ProfilesView?.loadProfiles) {
                window.ProfilesView.loadProfiles();
            }
        },

        /** Build payload for profile update - from UI controls only */
        async _buildUpdatePayload() {
            const v = this._collectTabValues();
            console.log('[CreateProfile] _buildUpdatePayload - collected values:', JSON.stringify({
                screenMode: v.screenMode,
                screenWidth: v.screenWidth,
                screenHeight: v.screenHeight,
                cpuMode: v.cpuMode,
                canvasMode: v.canvasMode,
                webglMode: v.webglMode,
                // UI 'default' means "no spoof" → send null
                webglImageMode: v.webglImageMode === 'default' ? null : (v.webglImageMode || null),
                pluginsMode: v.pluginsMode,
                webrtcMode: v.webrtcMode,
                mediaDevices: v.mediaDevices,
                speechVoices: v.speechVoices,
                clientRects: v.clientRects,
                fontsMode: v.fontsMode
            }, null, 2));

            const groupValue = this._groupCtrl?.getValue?.() || '';
            const groupId = groupValue ? parseInt(groupValue, 10) : null;
            const tagValues = this._tagCtrl?.getValues?.() || [];
            const tagIds = tagValues.map(t => parseInt(t, 10)).filter(n => !isNaN(n));

            // Map OS name to platform string (Windows -> Win32, macOS -> Darwin)
            const osToPlatform = {
                'Windows': 'Win32', 'macOS': 'Darwin', 'Linux': 'Linux'
            };
            const platform = osToPlatform[v.os] || v.os || null;

            // Build ProfileData JSON - merge original with UI values
            // Preserve original values for fields not exposed/changed in UI by reading from _originalProfileData.ProfileDataParsed
            const orig = this._originalProfileData?.ProfileDataParsed || {};
            const origFp = orig.Fingerprint || {};
            const origSys = orig.System || {};
            const origSec = orig.Security || {};
            const origLoc = orig.Location || {};

            const profileData = {
                Profile: {
                    ProfileID: String(this._editProfileId),
                    Profilename: (typeof v.name === 'string' && v.name.trim() === '') ? '' : (v.name || this._originalProfileData?.Name || ''),
                    StartURL: v.startUrl || ''
                },
                System: {
                    // Platform/Language/UserAgent/AcceptLanguage/Timezone are TypedConfig<*>
                    Platform: { Mode: 'noise', Value: platform },
                    // Language: 'noise' when user picks specific lang; 'real' when using defaults
                    Language: {
                        Mode: v.languages?.length > 0 ? 'noise' : 'real',
                        Value: v.languages?.length > 0 ? v.languages[0] : null
                    },
                    UserAgent: v.uaMode === 'real'
                        ? { Mode: 'real', Value: null }
                        : { Mode: 'noise', Value: v.userAgent || origFp.UserAgent || origSys.UserAgent || null },
                    BrowserVersion: v.browserVersion || null,
                    // AcceptLanguage: 'noise' only when user selects specific languages; 'real' when using defaults
                    AcceptLanguage: {
                        Mode: v.languages?.length > 0 ? 'noise' : 'real',
                        Value: v.languages?.length > 0 ? v.languages.join(',') : null
                    },
                    // Timezone: 'real' -> real system, 'auto' -> noise with null, specific -> noise with value
                    Timezone: v.timezone === 'real'
                        ? { Mode: 'real', Value: null }
                        : { Mode: 'noise', Value: v.timezone === 'auto' ? null : (v.timezone || null) },
                    // Hardware fields: TypedConfig<int>
                    // Real mode   -->  Mode='real', Value=null (no spoof, browser uses real hardware)
                    // Custom mode   -->  Mode='noise', Value=user-selected values
                    // Random mode   -->  Mode='noise', Value=null (browser generates random internally)
                    HardwareConcurrency: v.cpuMode === 'real'
                        ? { Mode: 'real', Value: null }
                        : { Mode: 'noise', Value: v.concurrency || null },
                    DeviceMemory: v.cpuMode === 'real'
                        ? { Mode: 'real', Value: null }
                        : { Mode: 'noise', Value: v.deviceMemory || null },
                    Architecture: origSys.Architecture?.Value ? { Mode: 'noise', Value: origSys.Architecture.Value } : { Mode: 'real', Value: null },
                    Bitness: origSys.Bitness?.Value ? { Mode: 'noise', Value: origSys.Bitness.Value } : { Mode: 'real', Value: null },
                    CpuBrand: origSys.CpuBrand?.Value ? { Mode: 'noise', Value: origSys.CpuBrand.Value } : { Mode: 'real', Value: null },
                    Touch: {
                        Mode: 'real',
                        MaxTouchPoints: 0,
                        TouchSupport: false
                    },
                    Languages: v.languages?.length > 0 ? v.languages : (origSys.Languages?.length > 0 ? origSys.Languages : ['en-US', 'en']),
                    Screen: {
                        // Real mode   -->  no Width/Height/PixelRatio spoofing
                        Mode: v.screenMode === 'real' ? 'real' : (v.screenMode || 'real'),
                        Width: v.screenMode === 'real' ? null : (v.screenWidth || null),
                        Height: v.screenMode === 'real' ? null : (v.screenHeight || null),
                        ColorDepth: origSys.Screen?.ColorDepth || 24,
                        PixelRatio: v.screenMode === 'real' ? null : (v.screenPixelRatio || null),
                        AvailWidth: v.screenMode === 'real' ? null : (v.screenWidth || null),
                        AvailHeight: v.screenMode === 'real' ? null : ((v.screenHeight || null) ? v.screenHeight - 40 : null)
                    }
                },
                Fingerprint: {
                    WebGL: {
                        Mode: v.webglMode === 'real' ? 'real' : (v.webglMode || 'noise'),
                        Vendor: v.webglMode === 'real' ? null : (v.webglVendor || null),
                        Renderer: v.webglMode === 'real' ? null : (v.webglRenderer || null),
                        // NoiseSeed/NoiseLevel: only set when NOT Real mode (Real = null, no noise)
                        NoiseSeed: v.webglMode !== 'real' ? (origFp.WebGL?.NoiseSeed || null) : null,
                        NoiseLevel: v.webglMode !== 'real' ? (origFp.WebGL?.NoiseLevel || null) : null,
                        Extensions: origFp.WebGL?.Extensions?.length > 0 ? origFp.WebGL.Extensions : [],
                        MaxTextureSize: origFp.WebGL?.MaxTextureSize || 16384,
                        ImageSpoofing: {
                            // 'default' → no spoof (Mode=null), 'real' → 'real', 'noise'/'solid' → 'noise'
                            Mode: v.webglImageMode === 'default' ? null : (v.webglImageMode === 'real' ? 'real' : 'noise'),
                            TextureSeed: v.webglImageMode === 'default' || v.webglImageMode === 'real' ? null : (origFp.WebGL?.ImageSpoofing?.TextureSeed || null),
                            Pattern: v.webglImageMode === 'default' || v.webglImageMode === 'real' ? 'default' : (v.webglImageMode || 'default')
                        }
                    },
                    Canvas: {
                        Mode: v.canvasMode === 'real' ? 'real' : (v.canvasMode || 'noise'),
                        // NoiseSeed/NoiseLevel: null when Real (browser uses real canvas)
                        NoiseSeed: v.canvasMode !== 'real' ? (origFp.Canvas?.NoiseSeed || null) : null,
                        NoiseLevel: v.canvasMode !== 'real' ? (origFp.Canvas?.NoiseLevel || null) : null
                    },
                    Audio: {
                        Mode: v.audioMode === 'real' ? 'real' : (v.audioMode || 'real'),
                        NoiseSeed: v.audioMode !== 'real' ? (origFp.Audio?.NoiseSeed || null) : null,
                        NoiseLevel: v.audioMode !== 'real' ? (origFp.Audio?.NoiseLevel || null) : null,
                        SampleRate: origFp.Audio?.SampleRate || 48000
                    },
                    ClientRects: {
                        Mode: v.clientRects === 'real' ? 'real' : (v.clientRects || 'noise'),
                        NoiseSeed: v.clientRects !== 'real' ? (origFp.ClientRects?.NoiseSeed || null) : null,
                        NoiseLevel: v.clientRects !== 'real' ? (origFp.ClientRects?.NoiseLevel || null) : null
                    },
                    Fonts: {
                        // Real/Default mode: FontList should be empty or null (browser uses real fonts)
                        Mode: v.fontsMode === 'real' ? 'real' : (v.fontsMode || 'default'),
                        FontList: v.fontsMode === 'custom' ? (v.customFonts || []) : []
                    },
                    Plugins: {
                        Mode: v.pluginsMode === 'real' ? 'real' : (v.pluginsMode || 'default'),
                        PluginList: origFp.Plugins?.PluginList?.length > 0 ? origFp.Plugins.PluginList : [
                            { Name: 'PDF Viewer', Filename: 'internal-pdf-viewer', Description: 'Portable Document Format' },
                            { Name: 'Chrome PDF Viewer', Filename: 'internal-pdf-viewer', Description: '' }
                        ]
                    },
                    MediaDevices: {
                        Mode: v.mediaDevices === 'real' ? 'real' : (v.mediaDevices || 'real'),
                        VideoInputs: v.mediaDevices !== 'real' ? (origFp.MediaDevices?.VideoInputs || null) : null,
                        AudioInputs: v.mediaDevices !== 'real' ? (origFp.MediaDevices?.AudioInputs || null) : null,
                        AudioOutputs: v.mediaDevices !== 'real' ? (origFp.MediaDevices?.AudioOutputs || null) : null
                    },
                    Connection: origFp.Connection || { Mode: 'default', EffectiveType: '4g', Downlink: 10, Rtt: 50, SaveData: false },
                    StorageQuota: origFp.StorageQuota?.Value ? { Mode: 'noise', Value: origFp.StorageQuota.Value } : { Mode: 'real', Value: null },
                    TLSOSMatch: origFp.TLSOSMatch?.Value ? { Mode: 'noise', Value: origFp.TLSOSMatch.Value } : { Mode: 'real', Value: null },
                    DoNotTrack: {
                        Mode: v.doNotTrack === 'enabled' ? 'noise' : (v.doNotTrack === 'disabled' ? 'noise' : 'real'),
                        Value: v.doNotTrack === 'enabled' ? '1' : (v.doNotTrack === 'disabled' ? '0' : null)
                    },
                    WebRTcMode: v.webrtcMode || 'disable',
                    SslMode: v.sslMode || 'noise',
                    SpeechVoicesMode: v.speechVoices || 'noise',
                    FontMetrics: {
                        Mode: v.fontMetricsMode === 'real' ? 'real' : (v.fontMetricsMode || 'real'),
                        // NoiseSeed/NoiseLevel: null when Real or Default (browser uses real/default)
                        NoiseSeed: (v.fontMetricsMode !== 'real' && v.fontMetricsMode !== 'default') ? (origFp.FontMetrics?.NoiseSeed || null) : null,
                        NoiseLevel: (v.fontMetricsMode !== 'real' && v.fontMetricsMode !== 'default') ? (origFp.FontMetrics?.NoiseLevel || null) : null
                    }
                },
                Network: {
                    Proxy: this._buildProxyConfig()
                },
                Security: {
                    PortScan: v.portScan ? String(v.portScan).toLowerCase() : (origSec.PortScan || null),
                    PortBlockMode: v.portBlockMode || origSec.PortBlockMode || null,
                    PortBlockList: v.portBlockList?.length > 0 ? v.portBlockList : (origSec.PortBlockList || null)
                },
                Location: this._buildLocationConfigWithOrig(v, origLoc),
                // UI config (Mode, Headless, WindowSize) is generated dynamically at runtime by DuckBrowserManager
            };

            console.log('[CreateProfile] _buildUpdatePayload - profileData to save:', JSON.stringify(profileData, null, 2));
            // [DEBUG] key fields
            console.log('[DEBUG:_buildUpdatePayload]', JSON.stringify({
                uaMode: v.uaMode,
                screenMode: v.screenMode, screenWidth: v.screenWidth, screenHeight: v.screenHeight,
                cpuMode: v.cpuMode, concurrency: v.concurrency, deviceMemory: v.deviceMemory,
                webglMode: v.webglMode, webglVendor: v.webglVendor, webglRenderer: v.webglRenderer,
                canvasMode: v.canvasMode, webglImageMode: v.webglImageMode,
                pluginsMode: v.pluginsMode,
                mediaDevices: v.mediaDevices, clientRects: v.clientRects,
            }, null, 2));

            return {
                id: this._editProfileId,
                name: (typeof v.name === 'string' && v.name.trim() === '') ? '' : (v.name || this._originalProfileData?.Name || ''),
                groupId,
                tagIds: tagIds.length ? tagIds : null,
                proxyId: v.savedProxyId || null,
                browserType: (v.browser || 'chromium').charAt(0).toUpperCase() + (v.browser || 'chromium').slice(1),
                browserVersion: v.browserVersion || this._originalProfileData?.BrowserVersion || null,
                profileData: JSON.stringify(profileData),
                notes: v.notes || '',
                cookies: v.cookiesData || this._originalProfileData?.Cookies || ''
            };
        },

        /** Build proxy config from tab values */
        _buildProxyConfig() {
            const v = this._collectTabValues();
            const netTab = window.ProfileModals.CreateProfile.NetworkTab;

            if (v.proxyMode === 'none' || !netTab) {
                return { Mode: 'none' };
            }

            if (v.proxyMode === 'saved') {
                return {
                    Mode: 'saved',
                    SavedProxyId: v.savedProxyId
                };
            }

            if (v.proxyMode === 'custom') {
                const cfg = v.proxyConfig || v.customProxy || {};
                return {
                    Mode: 'custom',
                    Type: cfg.Type || cfg.type || 'http',
                    Host: cfg.Host || cfg.host || '',
                    Port: cfg.Port || cfg.port || 0,
                    Username: cfg.Username || cfg.username || '',
                    Password: cfg.Password || cfg.password || ''
                };
            }

            return { Mode: 'none' };
        },

        /** Build location config from tab values */
        _buildLocationConfig(v) {
            const mode = v.locationMode || 'noise';
            const access = v.geolocationAccess ? String(v.geolocationAccess).toLowerCase() : 'block';
            if (mode === 'custom' && v.customCoordinates) {
                return {
                    Mode: 'custom',
                    Access: access,
                    Latitude: v.customCoordinates.lat || 0,
                    Longitude: v.customCoordinates.lng || 0,
                    Accuracy: v.customCoordinates.accuracy || 100
                };
            }
            // Real mode   -->  no coordinates spoofing
            if (mode === 'real') {
                return {
                    Mode: 'real',
                    Access: access,
                    Latitude: null,
                    Longitude: null,
                    Accuracy: null
                };
            }
            // noise or default mode   -->  clear coordinates (no spoof)
            return {
                Mode: 'noise',
                Access: access,
                Latitude: null,
                Longitude: null,
                Accuracy: null
            };
        },

        /** Build location config from tab values - preserves original values for unchanged fields */
        _buildLocationConfigWithOrig(v, origLoc) {
            const mode = v.locationMode || 'noise';
            const access = v.geolocationAccess ? String(v.geolocationAccess).toLowerCase() : (origLoc?.Access || 'block');
            if (mode === 'custom' && v.customCoordinates) {
                return {
                    Mode: 'custom',
                    Access: access,
                    Latitude: v.customCoordinates.lat || 0,
                    Longitude: v.customCoordinates.lng || 0,
                    Accuracy: v.customCoordinates.accuracy || 100
                };
            }
            // Real mode   -->  no coordinates spoofing
            if (mode === 'real') {
                return {
                    Mode: 'real',
                    Access: access,
                    Latitude: null,
                    Longitude: null,
                    Accuracy: null
                };
            }
            // noise or default mode   -->  clear coordinates (no spoof)
            return {
                Mode: 'noise',
                Access: access,
                Latitude: null,
                Longitude: null,
                Accuracy: null
            };
        },

        _buildFormContainer(template) {
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
            stickyHeader.style.cssText = 'display: flex; flex-direction: column; gap: 8px; padding: 20px 24px; border-bottom: 1px solid var(--border-default); background: var(--bg-surface); z-index: 10;';

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

            // Row 1: Mode + Name (hide mode toggle in edit mode)
            const row1 = document.createElement('div');
            row1.style.cssText = this._mode === 'edit' 
                ? 'display: block; width: 100%; margin-bottom: 8px;'
                : 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px; align-items: start; margin-bottom: 8px;';

            const nameWrap = document.createElement('div');
            nameWrap.style.cssText = 'display: flex; gap: 12px; align-items: flex-end; width: 100%;';

            const nameInput = window.DuckControls.Input.create({ label: 'Profile Name', placeholder: 'Enter profile name...', icon: 'badge', fullWidth: true });
            nameInput.element.style.flex = '1';
            this._nameInput = nameInput.element;
            this._nameCtrl = nameInput;

            const qtySpin = window.DuckControls.SpinNumber.create({ value: 1, min: 1, max: 100 });
            this._qtyCtrl = qtySpin;
            const qtyWrap = createLabelWrap('Quantity', qtySpin.element);
            qtyWrap.style.display = 'none';
            qtyWrap.style.width = '120px';
            nameWrap.appendChild(nameInput.element);
            nameWrap.appendChild(qtyWrap);

            // In edit mode, hide the mode toggle (no bulk create)
            if (this._mode === 'edit') {
                row1.appendChild(nameWrap);
            } else {
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
            }
            stickyHeader.appendChild(row1);

            // Row 2: Group + Tags
            const row2 = document.createElement('div');
            row2.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 12px;';

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
                    const genTab = window.ProfileModals.CreateProfile.GeneralTab;
                    const tabValues = this._collectTabValues();
                    this._modal.setLoading(true, 'Generating new fingerprint...');
                    try {
                        const fp = await DuckBridge.call('profile.generateFingerprint', {
                            platform: tabValues.os || null,
                            browser:  tabValues.browser || 'chromium',
                            version:  tabValues.browserVersion || null,
                            model:    tabValues.osModel || null
                        });
                        this._applyFingerprintResponse(fp);
                    } catch (e) {
                        // toast handled by DuckBridge
                    } finally {
                        if (this._modal) this._modal.setLoading(false);
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
            set('Operating System', fp.platform || null);
            set('Browser', `Chromium ${fp.browserVersion || null}`);
            set('User Agent', fp.userAgent ? fp.userAgent.substring(0, 40) + '...' : '—');
            set('Screen Resolution', fp.screen || '—');
            set('Timezone', fp.timezone || 'Auto');
            set('Language', fp.languages || '—');
            set('Hardware', fp.hardware || '—');
            set('WebGL', `${fp.webglVendor || ''} / ${fp.webglRenderer || ''}`);
        }
    });

    // ===== Language display labels =====
    // Auto-init
    window.ProfileModals.CreateProfile._init();
})();






