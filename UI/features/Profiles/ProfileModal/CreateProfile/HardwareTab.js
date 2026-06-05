(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.HardwareTab = {
        _currentOsBlock: null,

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
            hwTierWrap.style.cssText = 'display: none; flex-direction: column; gap: 8px; margin-top: 4px; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px;';
            const hwTierLabel = document.createElement('div');
            hwTierLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary); padding-left: 2px;';
            hwTierLabel.textContent = 'Select Hardware Tier (Cores / RAM)';
            hwTierWrap.appendChild(hwTierLabel);

            this.cpuChipSelect = window.DuckControls.ComboBox.create({
                placeholder: 'Search hardware tier...',
                options: [{ label: 'Loading...', value: '' }]
            });
            this.cpuChipSelect.element.style.width = '100%';
            hwTierWrap.appendChild(this.cpuChipSelect.element);

            cpuSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Hardware Configuration', desc: 'Spoof CPU cores and device memory', control: this.cpuToggle.element, alignTop: false }).element);
            cpuSec.appendChild(hwTierWrap);

            this.cpuToggle.element.addEventListener('click', () => {
                hwTierWrap.style.display = this.cpuToggle.getValue() === 'custom' ? 'flex' : 'none';
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
            resChipWrap.style.cssText = 'display: none; flex-direction: column; gap: 8px; margin-top: 4px; padding: 16px; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px;';
            const resChipLabel = document.createElement('div');
            resChipLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary); padding-left: 2px;';
            resChipLabel.textContent = 'Select Resolution Preset';
            resChipWrap.appendChild(resChipLabel);

            this.resChipSelect = window.DuckControls.ComboBox.create({
                placeholder: 'Search resolution...',
                options: [{ label: 'Loading...', value: '' }]
            });
            this.resChipSelect.element.style.width = '100%';
            resChipWrap.appendChild(this.resChipSelect.element);

            gfxSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Screen Resolution', desc: 'Spoof display width, height and pixel ratio', control: this.resToggle.element, alignTop: false }).element);
            gfxSec.appendChild(resChipWrap);

            this.resToggle.element.addEventListener('click', () => {
                resChipWrap.style.display = this.resToggle.getValue() === 'custom' ? 'flex' : 'none';
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
            emuSec.appendChild(window.DuckControls.SettingRow.create({ title: 'WebGL Image', desc: 'Add noise to WebGL renderings', control: this.webglImgToggle.element, alignTop: false }).element);

            this.webglMetaToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Real', value: 'real' }, { label: 'Random', value: 'random' }, { label: 'Custom', value: 'custom' }],
                value: 'random'
            });
            emuSec.appendChild(window.DuckControls.SettingRow.create({ title: 'WebGL Metadata', desc: 'Spoof GPU vendor and renderer strings', control: this.webglMetaToggle.element, alignTop: false }).element);

            const webglCustomBox = document.createElement('div');
            webglCustomBox.style.cssText = 'display: none; flex-direction: column; gap: 16px; background: var(--bg-surface); padding: 20px; border-radius: 8px; border: 1px solid var(--border-default);';

            this._webglVendorSelect = window.DuckControls.Select.create({
                label: 'Vendor',
                placeholder: 'Select vendor...',
                options: [{ label: 'Loading...', value: '' }],
                width: '100%'
            });
            webglCustomBox.appendChild(this._webglVendorSelect.element);

            this._rendererSelect = window.DuckControls.Select.create({
                label: 'Renderer',
                placeholder: 'Select renderer...',
                options: [{ label: 'Loading...', value: '' }],
                width: '100%'
            });
            webglCustomBox.appendChild(this._rendererSelect.element);

            this.webglMetaToggle.element.addEventListener('click', () => {
                webglCustomBox.style.display = this.webglMetaToggle.getValue() === 'custom' ? 'flex' : 'none';
            });
            emuSec.appendChild(webglCustomBox);

            this.pluginsToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            emuSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Browser Plugins', desc: 'Spoof standard browser plugin list', control: this.pluginsToggle.element, alignTop: false }).element);

            container.appendChild(window.DuckControls.Card.create({ title: 'Hardware Emulation', icon: 'developer_board', desc: 'Advanced WebGL and graphics overrides', content: emuSec }).element);

            return container;
        },

        _randomizeTier() {
            const tiers = this._currentOsBlock?.HardwareTiers || [];
            if (!tiers.length) return;
            const tier = tiers[Math.floor(Math.random() * tiers.length)];
            if (this.cpuChipSelect) this.cpuChipSelect.setValue(`${tier.Concurrency}-${tier.Memory}`);
            return tier;
        },

        _randomizeResolution() {
            const presets = this._currentOsBlock?.ScreenPresets || [];
            if (!presets.length) return;
            const p = presets[Math.floor(Math.random() * presets.length)];
            if (this.resChipSelect) this.resChipSelect.setValue(`${p.Width}x${p.Height}x${p.PixelRatio}`);
            return p;
        },

        _randomizeWebGL() {
            const osBlock = this._currentOsBlock;
            if (!osBlock?.WebGL?.VendorGPUs) return;
            const vendors = Object.keys(osBlock.WebGL.VendorGPUs);
            if (!vendors.length) return;
            const vendor = vendors[Math.floor(Math.random() * vendors.length)];
            const renderers = osBlock.WebGL.VendorGPUs[vendor];
            const renderer = renderers[Math.floor(Math.random() * renderers.length)];
            if (this._webglVendorSelect) this._webglVendorSelect.setValue(vendor);
            if (this._rendererSelect) this._rendererSelect.setValue(renderer);
            return { vendor, renderer };
        },

        _setOsBlock(block) {
            this._currentOsBlock = block;
        },

        getValues() {
            const cpuMode = this.cpuToggle ? this.cpuToggle.getValue() : 'random';
            const resMode = this.resToggle ? this.resToggle.getValue() : 'random';
            const webglMode = this.webglMetaToggle ? this.webglMetaToggle.getValue() : 'random';

            let concurrency = null, deviceMemory = null;
            if (cpuMode === 'custom' && this.cpuChipSelect) {
                const key = this.cpuChipSelect.getValue() || '';
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
        }
    };
})();
