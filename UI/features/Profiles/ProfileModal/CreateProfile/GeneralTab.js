(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.GeneralTab = {
        _fpTemplate: null,
        _browserCatalog: null,
        _defaultStartUrl: '',

        _setTemplate(template) {
            this._fpTemplate = template;
        },

        _setBrowserCatalog(browserCatalog) {
            this._browserCatalog = browserCatalog;
        },

        _getOsModels(osValue) {
            if (!this._fpTemplate) return [];
            const block = this._fpTemplate.OS?.[osValue] || this._fpTemplate.OS?.[osValue.toLowerCase()];
            return (block?.Models || []).map(m => ({ label: m.Name, value: m.Name }));
        },

        _getBrowserOptions() {
            const browsers = this._browserCatalog?.Browsers || [];
            return browsers.map(b => ({ label: b.BrowserType, value: String(b.BrowserType || '').toLowerCase() }));
        },

        _getBrowserVersions(browserValue) {
            const browsers = this._browserCatalog?.Browsers || [];
            const selected = browsers.find(b => String(b.BrowserType || '').toLowerCase() === String(browserValue || '').toLowerCase());
            return (selected?.Versions || []).map(v => ({ label: v.Version, value: v.Version }));
        },

        _buildUserAgent(osVal, modelVal, browserVersion) {
            const block = this._fpTemplate?.OS?.[osVal];
            const model = (block?.Models || []).find(m => m.Name === modelVal) || block?.Models?.[0];
            if (model?.UserAgentTemplate) {
                return model.UserAgentTemplate.replace('{VERSION}', browserVersion || '138');
            }
            return navigator.userAgent || '';
        },

        _syncUaPreview() {
            if (!this.uaInput) return;
            const auto = this.autoGenerateUa ? this.autoGenerateUa.options.checked : true;
            if (auto) return;

            const osVal = this.osSelect ? this.osSelect.getValue() : 'Windows';
            const modelVal = this.osModelSelect ? this.osModelSelect.getValue() : null;
            const browserVersion = this.browserVersion ? this.browserVersion.getValue() : '138';
            this.uaInput.setValue(this._buildUserAgent(osVal, modelVal, browserVersion));
        },

        async _randomizeUserAgent() {
            const osVal = this.osSelect ? this.osSelect.getValue() : 'Windows';
            const modelVal = this.osModelSelect ? this.osModelSelect.getValue() : null;
            const browserVersion = this.browserVersion ? this.browserVersion.getValue() : '138';

            try {
                const ua = await DuckBridge.call('profile.getRandomUserAgent', {
                    os: osVal,
                    model: modelVal,
                    browserVersion
                });
                if (ua) {
                    this.uaInput?.setValue(ua);
                    return;
                }
            } catch (e) {}

            this.uaInput?.setValue(this._buildUserAgent(osVal, modelVal, browserVersion));
        },

        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 32px; width: 100%;';

            const header = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.style.cssText = 'margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;';
            h2.textContent = 'General & OS';
            const subtitle = document.createElement('div');
            subtitle.style.cssText = 'font-size: 13px; color: var(--text-secondary); line-height: 1.5;';
            subtitle.textContent = 'Configure the basic information, start page, and operating system fingerprint for this profile.';
            header.appendChild(h2);
            header.appendChild(subtitle);
            container.appendChild(header);

            const generalSec = document.createElement('div');
            generalSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';
            this.startUrlInput = window.DuckControls.Input.create({
                label: 'Start URL',
                placeholder: 'https://example.com',
                icon: 'link',
                value: this._defaultStartUrl,
                onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            generalSec.appendChild(this.startUrlInput.element);
            container.appendChild(window.DuckControls.Card.create({
                title: 'Profile Startup',
                icon: 'home',
                desc: 'Choose where the browser lands when the profile starts',
                content: generalSec
            }).element);

            const osSec = document.createElement('div');
            osSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';

            const osSelectRow = document.createElement('div');
            osSelectRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 20px;';

            this.osSelect = window.DuckControls.Select.create({
                label: 'Operating System',
                onChange: (e) => {
                    const osVal = e.target.value;
                    const models = this._getOsModels(osVal);
                    this.osModelSelect.setOptions(models);
                    if (models.length > 0) this.osModelSelect.setValue(models[0].value);
                    this._syncUaPreview();
                    if (this._onOsChange) this._onOsChange(osVal);
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            this._osSelectCtrl = this.osSelect;

            this.osModelSelect = window.DuckControls.Select.create({
                label: 'OS Version / Model',
                options: [],
                onChange: (e) => {
                    this._syncUaPreview();
                    if (this._onModelChange) this._onModelChange(e.target.value);
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            this._osModelSelectCtrl = this.osModelSelect;

            osSelectRow.appendChild(this.osSelect.element);
            osSelectRow.appendChild(this.osModelSelect.element);
            osSec.appendChild(osSelectRow);

            const browserRow = document.createElement('div');
            browserRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 20px;';
            const browserOptions = this._getBrowserOptions();
            const initialBrowser = browserOptions[0]?.value || 'chromium';
            const initialVersionOptions = this._getBrowserVersions(initialBrowser);
            this.browserSelect = window.DuckControls.Select.create({
                label: 'Browser Kernel',
                options: browserOptions,
                value: initialBrowser,
                dataField: 'browserType',
                onChange: () => {
                    const selectedBrowser = this.browserSelect?.getValue?.() || initialBrowser;
                    const versionOptions = this._getBrowserVersions(selectedBrowser);
                    this.browserVersion?.setOptions?.(versionOptions);
                    if (versionOptions.length > 0) {
                        this.browserVersion?.setValue?.(versionOptions[0].value);
                    }
                    this._syncUaPreview();
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            this.browserVersion = window.DuckControls.Select.create({
                label: 'Browser Version',
                options: initialVersionOptions,
                value: initialVersionOptions[0]?.value || '',
                onChange: () => {
                    this._syncUaPreview();
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            browserRow.appendChild(this.browserSelect.element);
            browserRow.appendChild(this.browserVersion.element);
            osSec.appendChild(browserRow);

            const uaWrap = document.createElement('div');
            uaWrap.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 4px;';

            const uaModeToggle = window.DuckControls.ToggleGroup.create({
                options: [
                    { label: 'Auto', value: 'auto' },
                    { label: 'Custom', value: 'custom' }
                ],
                value: 'auto',
                onChange: (val) => {
                    uaManualRow.style.display = val === 'custom' ? 'flex' : 'none';
                    if (val === 'custom') this._syncUaPreview();
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            this.uaModeToggle = uaModeToggle;

            uaWrap.appendChild(window.DuckControls.SettingRow.create({
                title: 'User-Agent Masking',
                desc: 'Auto-generate from selected OS model or provide a custom value',
                control: uaModeToggle.element,
                alignTop: false
            }).element);

            const uaManualRow = document.createElement('div');
            uaManualRow.style.cssText = 'display: none; gap: 8px; align-items: flex-end;';
            this.uaInput = window.DuckControls.Input.create({
                label: 'Custom User-Agent',
                placeholder: 'Mozilla/5.0...',
                icon: 'devices',
                onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            this.uaInput.element.style.flex = '1';

            const btnUseCurrentUa = window.DuckControls.Button.create(null, {
                text: 'Use Current',
                variant: 'surface',
                icon: 'my_location',
                onClick: () => {
                    this.uaInput.setValue(navigator.userAgent || '');
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            const btnRandomUa = window.DuckControls.Button.create(null, {
                text: 'Random',
                variant: 'surface',
                icon: 'shuffle',
                onClick: async () => {
                    await this._randomizeUserAgent();
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });

            uaManualRow.appendChild(this.uaInput.element);
            uaManualRow.appendChild(btnUseCurrentUa.element);
            uaManualRow.appendChild(btnRandomUa.element);
            uaWrap.appendChild(uaManualRow);

            osSec.appendChild(uaWrap);

            container.appendChild(window.DuckControls.Card.create({
                title: 'OS & Browser',
                icon: 'devices',
                desc: 'Select operating system and browser versions',
                content: osSec
            }).element);

            return container;
        },

        getValues() {
            const uaMode = this.uaModeToggle ? this.uaModeToggle.getValue() : 'auto';
            return {
                os: this.osSelect ? this.osSelect.getValue() : null,
                osModel: this.osModelSelect ? this.osModelSelect.getValue() : null,
                browser: this.browserSelect ? this.browserSelect.getValue() : null,
                browserVersion: this.browserVersion ? this.browserVersion.getValue() : null,
                autoGenerateUa: uaMode === 'auto',
                userAgent: uaMode === 'custom' && this.uaInput ? this.uaInput.getValue() : '',
                startUrl: this.startUrlInput ? this.startUrlInput.getValue() : this._defaultStartUrl
            };
        }
    };
})();
