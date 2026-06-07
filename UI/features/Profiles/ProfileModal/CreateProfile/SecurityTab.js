(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.SecurityTab = {
        _browserFonts() {
            const seen = new Set();
            const fallbacks = [
                'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Verdana', 'Georgia', 'Palatino',
                'Trebuchet MS', 'Comic Sans MS', 'Impact', 'Segoe UI', 'Tahoma', 'Roboto', 'Noto Sans'
            ];
            return fallbacks.filter(f => {
                const ok = !seen.has(f);
                seen.add(f);
                return ok;
            });
        },

        _portOptions() {
            return [
                { label: '80 (HTTP)', value: '80' },
                { label: '443 (HTTPS)', value: '443' },
                { label: '1080 (SOCKS)', value: '1080' },
                { label: '3000 (Dev Server)', value: '3000' },
                { label: '3306 (MySQL)', value: '3306' },
                { label: '5432 (PostgreSQL)', value: '5432' },
                { label: '6379 (Redis)', value: '6379' },
                { label: '8080 (Alt HTTP)', value: '8080' },
                { label: '9222 (Chrome Debug)', value: '9222' },
                { label: '27017 (MongoDB)', value: '27017' }
            ];
        },

        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 24px; width: 100%;';

            const header = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.style.cssText = 'margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;';
            h2.textContent = 'Security & Privacy';
            const subtitle = document.createElement('div');
            subtitle.style.cssText = 'font-size: 13px; color: var(--text-secondary); line-height: 1.5;';
            subtitle.textContent = 'Protect your identity with WebRTC, media devices, fonts, client rects, and port scanning protections.';
            header.appendChild(h2);
            header.appendChild(subtitle);
            container.appendChild(header);

            const rtcSec = document.createElement('div');
            rtcSec.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

            this.rtcToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Alter', value: 'alter' }, { label: 'Disable', value: 'disable' }, { label: 'Real', value: 'real' }],
                value: 'disable'
            });
            rtcSec.appendChild(window.DuckControls.SettingRow.create({ title: 'WebRTC Public IP', desc: 'Control WebRTC leak and spoof public IPs', control: this.rtcToggle.element, alignTop: false }).element);

            this.sslToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            rtcSec.appendChild(window.DuckControls.SettingRow.create({ title: 'SSL', desc: 'Spoof SSL certificates dynamically', control: this.sslToggle.element, alignTop: false }).element);

            this.portToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Protect', value: 'protect' }, { label: 'Decline', value: 'decline' }],
                value: 'protect'
            });
            rtcSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Port Scan Protection', desc: 'Block aggressive localhost port scanning', control: this.portToggle.element, alignTop: false }).element);

            this.portBlockModeSelect = window.DuckControls.ChipSelect.create({
                options: [
                    { label: 'Block Default', value: 'block_default' },
                    { label: 'Block All', value: 'block_all' },
                    { label: 'Allow List', value: 'allow_list' },
                    { label: 'Custom', value: 'custom' }
                ],
                value: 'block_default',
                onChange: (val) => {
                    portListWrap.style.display = ['allow_list', 'custom'].includes(val) ? 'flex' : 'none';
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });

            const portBlockWrap = document.createElement('div');
            portBlockWrap.style.cssText = 'display:flex; flex-direction:column; gap:12px;';
            portBlockWrap.appendChild(window.DuckControls.SettingRow.create({ title: 'Port Block Mode', desc: 'Choose how localhost and internal ports are filtered', control: this.portBlockModeSelect.element, alignTop: true }).element);

            const portListWrap = document.createElement('div');
            portListWrap.style.cssText = 'display:none; flex-direction:column; gap:12px; margin-left: 0; padding: 16px; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border-default);';
            this.portBlockListInput = window.DuckControls.ComboBoxTag.create({
                label: 'Port Block List',
                placeholder: 'Select or type a port and press Enter',
                values: [],
                options: this._portOptions(),
                allowCustom: true,
                onChange: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            portListWrap.appendChild(this.portBlockListInput.element);
            portBlockWrap.appendChild(portListWrap);
            rtcSec.appendChild(portBlockWrap);

            container.appendChild(window.DuckControls.Card.create({ title: 'Network Security', icon: 'shield', desc: 'Prevent network-level fingerprinting', content: rtcSec }).element);

            const privSec = document.createElement('div');
            privSec.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

            this.mediaToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Block', value: 'block' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            privSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Media Devices', desc: 'Spoof available Microphones & Cameras', control: this.mediaToggle.element, alignTop: false }).element);

            this.speechToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            privSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Speech Voices', desc: 'Mask Web Speech API Voices', control: this.speechToggle.element, alignTop: false }).element);

            this.doNotTrackToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Default', value: 'default' }, { label: 'Enabled', value: 'enabled' }, { label: 'Disabled', value: 'disabled' }],
                value: 'default'
            });
            privSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Do Not Track', desc: 'Send Do Not Track header to websites', control: this.doNotTrackToggle.element, alignTop: false }).element);

            this.rectsToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            privSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Client Rects', desc: 'Add noise to getClientRects API', control: this.rectsToggle.element, alignTop: false }).element);

            this.fontsToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Default', value: 'default' }, { label: 'Custom', value: 'custom' }],
                value: 'default',
                onChange: (val) => {
                    fontCustomBox.style.display = val === 'custom' ? 'flex' : 'none';
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });

            const fontCustomBox = document.createElement('div');
            fontCustomBox.style.cssText = 'display: none; flex-direction: column; gap: 12px; background: var(--bg-surface); padding: 20px; border-radius: 8px; border: 1px solid var(--border-default); width: 100%; box-sizing: border-box;';
            const fontTagInput = window.DuckControls.ComboBoxTag.create({
                label: 'Custom Fonts',
                placeholder: 'e.g. Arial, Helvetica (press Enter)',
                values: this._browserFonts().slice(0, 3),
                options: this._browserFonts().map(f => ({ label: f, value: f })),
                allowCustom: true
            });
            fontTagInput.element.style.width = '100%';
            fontCustomBox.appendChild(fontTagInput.element);

            const fontBtnRow = document.createElement('div');
            fontBtnRow.style.cssText = 'display:flex; justify-content:flex-end;';
            const useCurrentFontsBtn = window.DuckControls.Button.create(null, {
                text: 'Use Current Browser Fonts',
                variant: 'surface',
                icon: 'text_fields',
                onClick: () => {
                    const currentFonts = this._browserFonts();
                    fontTagInput.setOptions(currentFonts.map(f => ({ label: f, value: f })));
                    fontTagInput.setValues(currentFonts.slice(0, 3));
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            fontBtnRow.appendChild(useCurrentFontsBtn.element);
            fontCustomBox.appendChild(fontBtnRow);
            this._fontTagInput = fontTagInput;

            privSec.appendChild(window.DuckControls.SettingRow.create({ title: 'Fonts Masking', desc: 'Spoof installed system fonts', control: this.fontsToggle.element, alignTop: false }).element);
            privSec.appendChild(fontCustomBox);

            container.appendChild(window.DuckControls.Card.create({ title: 'Privacy Masks', icon: 'fingerprint', desc: 'Advanced browser API spoofing', content: privSec }).element);

            return container;
        },

        getValues() {
            const fontsMode = this.fontsToggle ? this.fontsToggle.getValue() : 'default';
            return {
                webrtcMode: this.rtcToggle ? this.rtcToggle.getValue() : 'disable',
                sslMode: this.sslToggle ? this.sslToggle.getValue() : 'noise',
                portScan: this.portToggle ? this.portToggle.getValue() : 'protect',
                portBlockMode: this.portBlockModeSelect ? this.portBlockModeSelect.getValue() : 'block_default',
                portBlockList: this.portBlockListInput ? this.portBlockListInput.getValues() : [],
                mediaDevices: this.mediaToggle ? this.mediaToggle.getValue() : 'noise',
                speechVoices: this.speechToggle ? this.speechToggle.getValue() : 'noise',
                clientRects: this.rectsToggle ? this.rectsToggle.getValue() : 'noise',
                fontsMode: fontsMode,
                customFonts: fontsMode === 'custom' && this._fontTagInput ? this._fontTagInput.getValues() : [],
                doNotTrack: this.doNotTrackToggle ? this.doNotTrackToggle.getValue() : 'default',
            };
        }
    };
})();
