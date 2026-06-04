(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.GeneralTab = {
        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 32px; width: 100%;';

            // Title
            const header = document.createElement('div');
            header.innerHTML = `
                <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;">General & OS</h2>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Configure the basic information and operating system fingerprint for this profile.</div>
            `;
            container.appendChild(header);

            // --- OS & Browser Section ---
            const osSec = document.createElement('div');
            osSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';
            
            const osSecTitle = document.createElement('div');
            osSecTitle.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
            osSecTitle.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px; color: var(--accent);">devices</span> OS & Browser`;
            osSec.appendChild(osSecTitle);

            // OS Select
            const osSelectRow = document.createElement('div');
            osSelectRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 20px;';
            this.osSelect = window.DuckControls.Select.create({
                label: 'Operating System',
                options: [
                    { label: 'Windows', value: 'windows' },
                    { label: 'macOS', value: 'macos' },
                    { label: 'Linux', value: 'linux' },
                    { label: 'Android', value: 'android' }
                ]
            });
            this.osModelSelect = window.DuckControls.Select.create({
                label: 'OS Version / Model',
                options: [{ label: 'Windows 10', value: 'win10' }, { label: 'Windows 11', value: 'win11' }]
            });
            osSelectRow.appendChild(this.osSelect.element);
            osSelectRow.appendChild(this.osModelSelect.element);
            osSec.appendChild(osSelectRow);

            // Browser Select
            const browserRow = document.createElement('div');
            browserRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 20px;';
            this.browserSelect = window.DuckControls.Select.create({
                label: 'Browser Kernel',
                options: [{ label: 'Chromium', value: 'chromium' }]
            });
            this.browserVersion = window.DuckControls.Select.create({
                label: 'Browser Version',
                options: [{ label: '138', value: '138' }, { label: '137', value: '137' }]
            });
            browserRow.appendChild(this.browserSelect.element);
            browserRow.appendChild(this.browserVersion.element);
            osSec.appendChild(browserRow);

            // User Agent
            const uaWrap = document.createElement('div');
            uaWrap.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 4px;';
            
            const uaHeader = document.createElement('div');
            uaHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';
            const uaTitle = document.createElement('label');
            uaTitle.textContent = 'User-Agent Masking';
            uaTitle.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary);';
            
            this.autoGenerateUa = window.DuckControls.Checkbox.create(null, {
                label: 'Auto-generate',
                checked: true,
                onChange: (e) => {
                    uaManualRow.style.display = e.checked ? 'none' : 'flex';
                }
            });

            uaHeader.appendChild(uaTitle);
            uaHeader.appendChild(this.autoGenerateUa.element);
            uaWrap.appendChild(uaHeader);

            const uaManualRow = document.createElement('div');
            uaManualRow.style.cssText = 'display: none; gap: 8px; align-items: flex-end;';
            this.uaInput = window.DuckControls.Input.create({ placeholder: 'Mozilla/5.0...', icon: 'devices' });
            this.uaInput.element.style.flex = '1';
            
            const btnRandomUa = window.DuckControls.Button.create(null, {
                variant: 'surface',
                icon: 'shuffle'
            });
            btnRandomUa.element.title = 'Random UA';
            
            uaManualRow.appendChild(this.uaInput.element);
            uaManualRow.appendChild(btnRandomUa.element);
            uaWrap.appendChild(uaManualRow);
            
            osSec.appendChild(uaWrap);

            container.appendChild(osSec);

            return container;
        },

        getValues() {
            return {
                os: this.osSelect ? this.osSelect.getValue() : null,
                osModel: this.osModelSelect ? this.osModelSelect.getValue() : null,
                browser: this.browserSelect ? this.browserSelect.getValue() : null,
                browserVersion: this.browserVersion ? this.browserVersion.getValue() : null,
                autoGenerateUa: this.autoGenerateUa ? this.autoGenerateUa.options.checked : true,
                userAgent: this.uaInput ? this.uaInput.getValue() : ''
            };
        }
    };

})();
