(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.HardwareTab = {
        _currentOsBlock: null,
        _isLoadingProfile: false,
        _suppressRandomize: false,

        _setTemplate(template) {
            this._fpTemplate = template;
            this._populateHardwareOptions(template);
        },

        _setOsBlock(block) {
            this._currentOsBlock = block;
        },

        _populateHardwareOptions(tmpl, skipRandomize = false) {
            if (!tmpl) return;
            const genTab = window.ProfileModals?.CreateProfile?.GeneralTab;
            const osVal = genTab?._osSelectCtrl?.getValue?.() || 'Windows';
            const osBlock = tmpl.OS?.[osVal] || {};

            // HardwareTiers → cpuChipSelect
            const tiers = osBlock?.HardwareTiers || [];
            const cpuTierOpts = tiers.map(t => ({
                label: `${t.Concurrency} Cores / ${t.Memory} GB`,
                value: `${t.Concurrency}-${t.Memory}`
            }));
            if (this.cpuChipSelect) {
                this.cpuChipSelect.setOptions(cpuTierOpts);
                if (!skipRandomize && cpuTierOpts.length > 0) {
                    this.cpuChipSelect.setValue(cpuTierOpts[0].value);
                }
            }

            // ScreenPresets → resChipSelect
            const presets = osBlock?.ScreenPresets || [];
            const resOpts = presets.map(p => ({
                label: `${p.Width} × ${p.Height} @${p.PixelRatio}x`,
                value: `${p.Width}x${p.Height}x${p.PixelRatio}`
            }));
            if (this.resChipSelect) {
                this.resChipSelect.setOptions(resOpts);
                if (!skipRandomize && resOpts.length > 0) {
                    this.resChipSelect.setValue(resOpts[0].value);
                }
            }

            // WebGL vendors
            const vendors = osBlock?.WebGL?.VendorGPUs
                ? Object.keys(osBlock.WebGL.VendorGPUs)
                : ['Google Inc. (NVIDIA)'];
            const vendorOpts = vendors.map(v => ({ label: v, value: v }));
            if (this._webglVendorSelect) {
                this._webglVendorSelect.setOptions(vendorOpts);
                if (!skipRandomize && vendorOpts.length > 0) {
                    const randomVendor = vendorOpts[Math.floor(Math.random() * vendorOpts.length)].value;
                    this._webglVendorSelect.setValue(randomVendor);
                }
            }

            // WebGL renderer for selected vendor
            const selectedVendor = this._webglVendorSelect?.getValue?.() || vendorOpts[0]?.value;
            if (this._rendererSelect && osBlock?.WebGL?.VendorGPUs?.[selectedVendor]) {
                const renderers = osBlock.WebGL.VendorGPUs[selectedVendor];
                const rendererOpts = renderers.map(r => ({ label: r, value: r }));
                this._rendererSelect.setOptions(rendererOpts);
                if (!skipRandomize && rendererOpts.length > 0) {
                    const randomRenderer = rendererOpts[Math.floor(Math.random() * rendererOpts.length)].value;
                    this._rendererSelect.setValue(randomRenderer);
                }
            }
        },

        _randomizeTier() {
            if (this._suppressRandomize) return;
            const tiers = this._currentOsBlock?.HardwareTiers || [];
            if (!tiers.length) return;
            const tier = tiers[Math.floor(Math.random() * tiers.length)];
            if (this.cpuChipSelect) this.cpuChipSelect.setValue(`${tier.Concurrency}-${tier.Memory}`);
            return tier;
        },

        _randomizeResolution() {
            if (this._suppressRandomize) return;
            const presets = this._currentOsBlock?.ScreenPresets || [];
            if (!presets.length) return;
            const p = presets[Math.floor(Math.random() * presets.length)];
            if (this.resChipSelect) this.resChipSelect.setValue(`${p.Width}x${p.Height}x${p.PixelRatio}`);
            return p;
        },

        _randomizeWebGL() {
            if (this._suppressRandomize) return;
            const osBlock = this._currentOsBlock;
            if (!osBlock?.WebGL?.VendorGPUs) return;
            const vendors = Object.keys(osBlock.WebGL.VendorGPUs);
            if (!vendors.length) return;
            const vendor = vendors[Math.floor(Math.random() * vendors.length)];
            const renderers = osBlock.WebGL.VendorGPUs[vendor];

            if (this._rendererSelect) {
                this._rendererSelect.setOptions(renderers.map(r => ({ label: r, value: r })));
            }

            if (this._webglVendorSelect) this._webglVendorSelect.setValue(vendor);
            if (this._rendererSelect) this._rendererSelect.setValue(renderers[Math.floor(Math.random() * renderers.length)]);

            const currentRenderer = this._rendererSelect?.getValue?.() || '';
            if (currentRenderer !== renderers[0] && !renderers.includes(currentRenderer)) {
                this._rendererSelect?.setValue(renderers[0]);
            }

            return { vendor, renderer: renderers[0] };
        },

        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 24px; width: 100%;';

            const header = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.style.cssText = 'margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;';
            h2.textContent = 'Hardware Setup';
            const subtitle = document.createElement('div');
            subtitle.style.cssText = 'font-size: 13px; color: var(--text-secondary); line-height: 1.5;';
            subtitle.textContent = 'Spoof hardware concurrency, memory, display, graphics (WebGL, Canvas), and environment plugins.';
            header.appendChild(h2);
            header.appendChild(subtitle);
            container.appendChild(header);

            const cpuSec = document.createElement('div');
            cpuSec.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

            this.cpuToggle = window.DuckControls.ToggleGroup.create({
                options: [
                    { label: 'Real', value: 'real' },
                    { label: 'Random', value: 'random' },
                    { label: 'Custom', value: 'custom' }
                ],
                value: 'random'
            });

            const hwTierWrap = document.createElement('div');
            hwTierWrap.setAttribute('data-cpu-tier', 'true');
            hwTierWrap.style.cssText = 'display: none; flex-direction: column; gap: 8px; margin-top: 4px; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px;';
            const hwTierLabel = document.createElement('div');
            hwTierLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary); padding-left: 2px;';
            hwTierLabel.textContent = 'Select Hardware Tier (Cores / RAM)';
            hwTierWrap.appendChild(hwTierLabel);

            this.cpuChipSelect = window.DuckControls.ComboBox.create({
                placeholder: 'Search hardware tier...',
                options: [{ label: 'Loading...', value: '' }],
                onChange: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            this.cpuChipSelect.element.style.width = '100%';
            hwTierWrap.appendChild(this.cpuChipSelect.element);

            cpuSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Hardware Configuration', desc: 'Spoof CPU cores and device memory', control: this.cpuToggle.element, alignTop: false }).element);
            cpuSec.appendChild(hwTierWrap);

            this.cpuToggle.element.addEventListener('click', () => {
                hwTierWrap.style.display = this.cpuToggle.getValue() === 'custom' ? 'flex' : 'none';
                if (this.cpuToggle.getValue() === 'custom') this._randomizeTier?.();
                window.ProfileModals?.CreateProfile?._scheduleSync?.();
            });

            container.appendChild(window.DuckControls.Card.create({ title: 'CPU & Memory', icon: 'memory', desc: 'Configure core and memory footprint', content: cpuSec }).element);

            const gfxSec = document.createElement('div');
            gfxSec.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

            this.resToggle = window.DuckControls.ToggleGroup.create({
                options: [
                    { label: 'Real', value: 'real' },
                    { label: 'Random', value: 'random' },
                    { label: 'Custom', value: 'custom' }
                ],
                value: 'random'
            });

            const resChipWrap = document.createElement('div');
            resChipWrap.setAttribute('data-res-chip', 'true');
            resChipWrap.style.cssText = 'display: none; flex-direction: column; gap: 8px; margin-top: 4px; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px;';
            const resChipLabel = document.createElement('div');
            resChipLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary); padding-left: 2px;';
            resChipLabel.textContent = 'Select Resolution Preset';
            resChipWrap.appendChild(resChipLabel);

            this.resChipSelect = window.DuckControls.ComboBox.create({
                placeholder: 'Search resolution...',
                options: [{ label: 'Loading...', value: '' }],
                onChange: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            this.resChipSelect.element.style.width = '100%';
            resChipWrap.appendChild(this.resChipSelect.element);

            gfxSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Screen Resolution', desc: 'Spoof display width, height and pixel ratio', control: this.resToggle.element, alignTop: false }).element);
            gfxSec.appendChild(resChipWrap);

            this.resToggle.element.addEventListener('click', () => {
                resChipWrap.style.display = this.resToggle.getValue() === 'custom' ? 'flex' : 'none';
                if (this.resToggle.getValue() === 'custom') this._randomizeResolution?.();
                window.ProfileModals?.CreateProfile?._scheduleSync?.();
            });

            container.appendChild(window.DuckControls.Card.create({ title: 'Display & Graphics', icon: 'monitor', desc: 'Screen resolutions and monitor configs', content: gfxSec }).element);

            const emuSec = document.createElement('div');
            emuSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

            this.canvasToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            emuSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Canvas API', desc: 'Add noise to canvas fingerprints', control: this.canvasToggle.element, alignTop: false }).element);

            this.webglImgToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            emuSec.appendChild(window.DuckControls.SettingRow.create({ title: 'WebGL Image', desc: 'Add noise to WebGL rendering fingerprints', control: this.webglImgToggle.element, alignTop: false }).element);

            this.webglMetaToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Real', value: 'real' }, { label: 'Random', value: 'random' }, { label: 'Custom', value: 'custom' }],
                value: 'random',
                onChange: (val) => {
                    // Show/hide WebGL custom box and randomize when switching to Custom
                    // Use this._webglCustomBox (set right after this toggle creation) to avoid closure issue
                    if (this._webglCustomBox) this._webglCustomBox.style.display = val === 'custom' ? 'flex' : 'none';
                    if (val === 'custom') {
                        this._randomizeWebGL();
                    }
                    // Sync overview after the toggle value has updated
                    setTimeout(() => window.ProfileModals?.CreateProfile?._scheduleSync?.(), 0);
                }
            });
            emuSec.appendChild(window.DuckControls.SettingRow.create({ title: 'WebGL Metadata', desc: 'Spoof GPU vendor and renderer strings', control: this.webglMetaToggle.element, alignTop: false }).element);

            const webglCustomBox = document.createElement('div');
            webglCustomBox.setAttribute('data-webgl-custom', 'true');
            webglCustomBox.style.cssText = 'display: none; flex-direction: column; gap: 16px; background: var(--bg-surface); padding: 20px; border-radius: 8px; border: 1px solid var(--border-default);';
            this._webglCustomBox = webglCustomBox;

            this._webglVendorSelect = window.DuckControls.Select.create({
                label: 'Vendor',
                placeholder: 'Select vendor...',
                options: [{ label: 'Loading...', value: '' }],
                width: '100%',
                onChange: () => {
                    // Cascade renderer list when vendor changes
                    const vendor = this._webglVendorSelect?.getValue?.() || '';
                    const osBlock = this._currentOsBlock;
                    const renderers = osBlock?.WebGL?.VendorGPUs?.[vendor] || [];
                    if (this._rendererSelect) {
                        this._rendererSelect.setOptions(renderers.map(r => ({ label: r, value: r })));
                        if (renderers.length > 0) {
                            const randomRenderer = renderers[Math.floor(Math.random() * renderers.length)];
                            this._rendererSelect.setValue(randomRenderer);
                        }
                    }
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            webglCustomBox.appendChild(this._webglVendorSelect.element);

            this._rendererSelect = window.DuckControls.Select.create({
                label: 'Renderer',
                placeholder: 'Select renderer...',
                options: [{ label: 'Loading...', value: '' }],
                width: '100%',
                onChange: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            webglCustomBox.appendChild(this._rendererSelect.element);
            emuSec.appendChild(webglCustomBox);

            this.pluginsToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            emuSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Browser Plugins', desc: 'Spoof standard browser plugin list', control: this.pluginsToggle.element, alignTop: false }).element);

            container.appendChild(window.DuckControls.Card.create({ title: 'Hardware Emulation', icon: 'developer_board', desc: 'Advanced WebGL and graphics overrides', content: emuSec }).element);

            return container;
        },

        getValues() {
            const cpuMode = this.cpuToggle ? this.cpuToggle.getValue() : 'random';
            const resMode = this.resToggle ? this.resToggle.getValue() : 'random';
            const webglMode = this.webglMetaToggle ? this.webglMetaToggle.getValue() : 'random';

            // Real mode = null (no spoofing). Custom mode = parse chip select. Random mode = null (no value).
            let concurrency = null, deviceMemory = null;
            if (cpuMode === 'custom') {
                const key = this.cpuChipSelect ? this.cpuChipSelect.getValue() : '';
                const parts = key.split('-');
                concurrency = parseInt(parts[0], 10) || null;
                deviceMemory = parseInt(parts[1], 10) || null;
            }

            let screenWidth = null, screenHeight = null, screenPixelRatio = null, screenPreset = null;
            if (resMode === 'custom' && this.resChipSelect) {
                const val = this.resChipSelect.getValue() || '';
                const parts = val.split('x');
                if (parts.length === 3) {
                    screenWidth = parseInt(parts[0], 10) || null;
                    screenHeight = parseInt(parts[1], 10) || null;
                    screenPixelRatio = parseFloat(parts[2]) || null;
                    screenPreset = val;
                }
            }

            // [DEBUG] hardware values
            console.log('[DEBUG:HardwareTab.getValues]', JSON.stringify({
                cpuMode, concurrency, deviceMemory,
                resMode, screenWidth, screenHeight, screenPixelRatio,
                canvasMode: this.canvasToggle ? this.canvasToggle.getValue() : 'noise',
                webglImageMode: this.webglImgToggle ? this.webglImgToggle.getValue() : 'noise',
                webglMode, webglVendor: webglMode === 'custom' && this._webglVendorSelect ? this._webglVendorSelect.getValue() : null,
                webglRenderer: webglMode === 'custom' && this._rendererSelect ? this._rendererSelect.getValue() : null,
                pluginsMode: this.pluginsToggle ? this.pluginsToggle.getValue() : 'noise',
            }, null, 2));

            return {
                concurrency,
                deviceMemory,
                cpuMode,
                screenWidth,
                screenHeight,
                screenPixelRatio,
                screenPreset,
                screenMode: resMode,
                canvasMode: this.canvasToggle ? this.canvasToggle.getValue() : 'noise',
                webglImageMode: this.webglImgToggle ? this.webglImgToggle.getValue() : 'noise',
                webglMode,
                webglVendor: webglMode === 'custom' && this._webglVendorSelect ? this._webglVendorSelect.getValue() : null,
                webglRenderer: webglMode === 'custom' && this._rendererSelect ? this._rendererSelect.getValue() : null,
                pluginsMode: this.pluginsToggle ? this.pluginsToggle.getValue() : 'noise',
            };
        },

        /** Set values from loaded profile data */
        setValues(values, fpTemplate) {
            // Suppress _randomizeTier/_randomizeResolution/_randomizeWebGL during load
            // to prevent them from overwriting the chip values we just set
            this._suppressRandomize = true;

            // Use skipRandomize=true to avoid randomizing controls before we apply loaded values
            if (fpTemplate && values.os) {
                this._currentOsBlock = fpTemplate.OS?.[values.os];
                this._populateHardwareOptions(fpTemplate, true);
            }

            // ToggleGroup.setValue now triggers onChange, which handles:
            // - visibility of hwTierWrap/resChipWrap/webglCustomBox
            // - _randomizeTier() / _randomizeResolution() / _randomizeWebGL() for custom modes
            // Suppress randomization during this sequence so only our explicit setValue sticks.
            // Toggles first, then deferred chip values last.

            // CPU settings
            if (values.cpuMode && this.cpuToggle) {
                this.cpuToggle.setValue(values.cpuMode);
                // Manually show/hide CPU tier box (don't rely on click handler)
                const cpuWrap = this.cpuToggle.element?.closest('.duck-card-body')?.querySelector('[data-cpu-tier]');
                if (cpuWrap) cpuWrap.style.display = values.cpuMode === 'custom' ? 'flex' : 'none';
                if (values.cpuMode === 'custom' && values.concurrency && values.deviceMemory && this.cpuChipSelect) {
                    this.cpuChipSelect.setValue(`${values.concurrency}-${values.deviceMemory}`);
                }
            }

            // Screen Resolution settings
            if (values.screenMode && this.resToggle) {
                this.resToggle.setValue(values.screenMode);
                // Manually show/hide resolution chip box
                const resWrap = this.resToggle.element?.closest('.duck-card-body')?.querySelector('[data-res-chip]');
                if (resWrap) resWrap.style.display = values.screenMode === 'custom' ? 'flex' : 'none';
                if (values.screenMode === 'custom' && values.screenWidth && values.screenHeight && values.screenPixelRatio && this.resChipSelect) {
                    this.resChipSelect.setValue(`${values.screenWidth}x${values.screenHeight}x${values.screenPixelRatio}`);
                }
            }

            // Canvas mode - handle null (Real mode) and other valid values
            if (values.canvasMode !== undefined && this.canvasToggle) {
                this.canvasToggle.setValue(values.canvasMode);
            }

            // WebGL Image mode
            if (values.webglImageMode !== undefined && this.webglImgToggle) {
                this.webglImgToggle.setValue(values.webglImageMode);
            }

            // WebGL Metadata settings
            if (values.webglMode !== undefined && this.webglMetaToggle) {
                this.webglMetaToggle.setValue(values.webglMode);
                // Manually show/hide WebGL custom box
                if (this._webglCustomBox) {
                    this._webglCustomBox.style.display = values.webglMode === 'custom' ? 'flex' : 'none';
                }
                if (values.webglMode === 'custom' && values.webglVendor && this._webglVendorSelect) {
                    this._webglVendorSelect.setValue(values.webglVendor);
                    if (values.webglRenderer && this._rendererSelect) {
                        this._rendererSelect.setValue(values.webglRenderer);
                    }
                }
            }

            // Plugins mode - handle null (Real mode) and other valid values
            if (values.pluginsMode !== undefined && this.pluginsToggle) {
                this.pluginsToggle.setValue(values.pluginsMode);
            }

            // Re-enable randomization for user interactions
            this._suppressRandomize = false;
        }
    };
})();
