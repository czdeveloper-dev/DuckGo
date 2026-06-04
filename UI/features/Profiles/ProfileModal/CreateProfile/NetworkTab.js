(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.NetworkTab = {
        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 24px; padding-bottom: 24px;';

            // --- Proxy Settings Section ---
            const proxySec = document.createElement('div');
            proxySec.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';
            
            const proxyTitle = document.createElement('div');
            proxyTitle.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
            proxyTitle.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; color: var(--accent);">router</span> Proxy Settings';
            proxySec.appendChild(proxyTitle);

            const proxyTypeRow = document.createElement('div');
            proxyTypeRow.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
            const proxyTypeLabel = document.createElement('label');
            proxyTypeLabel.textContent = 'Connection Type';
            proxyTypeLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary);';
            this.proxyTypeToggle = window.DuckControls.ToggleGroup.create({
                options: [
                    { label: 'Without Proxy', value: 'none' },
                    { label: 'Custom Proxy', value: 'custom' },
                    { label: 'Saved Proxy', value: 'saved' }
                ],
                value: 'none',
                onChange: (val) => {
                    customProxyForm.style.display = val === 'custom' ? 'grid' : 'none';
                    savedProxyForm.style.display = val === 'saved' ? 'block' : 'none';
                }
            });
            proxyTypeRow.appendChild(proxyTypeLabel);
            proxyTypeRow.appendChild(this.proxyTypeToggle.element);
            proxySec.appendChild(proxyTypeRow);

            // Custom Proxy Form
            const customProxyForm = document.createElement('div');
            customProxyForm.style.cssText = 'display: none; grid-template-columns: 120px 1fr 1fr; gap: 16px; margin-top: 4px; align-items: end;';
            
            this.pType = window.DuckControls.Select.create({ label: 'Protocol', options: [{label: 'HTTP', value: 'http'}, {label: 'SOCKS5', value: 'socks5'}] });
            this.pHost = window.DuckControls.Input.create({ label: 'Host:Port', placeholder: '127.0.0.1:8080', icon: 'router' });
            this.pAuth = window.DuckControls.Input.create({ label: 'User:Pass (Optional)', placeholder: 'user:pass', icon: 'key' });
            
            customProxyForm.appendChild(this.pType.element);
            customProxyForm.appendChild(this.pHost.element);
            customProxyForm.appendChild(this.pAuth.element);
            
            // Saved Proxy Form
            const savedProxyForm = document.createElement('div');
            savedProxyForm.style.cssText = 'display: none; margin-top: 4px;';
            this.sProxy = window.DuckControls.Select.create({ label: 'Select Proxy', options: [{label: 'Proxy US 1 (192.168.1.1)', value: '1'}] });
            savedProxyForm.appendChild(this.sProxy.element);

            proxySec.appendChild(customProxyForm);
            proxySec.appendChild(savedProxyForm);

            // Check Proxy Button
            const checkProxyBtn = window.DuckControls.Button.create(null, {
                text: 'Check Proxy',
                variant: 'surface',
                icon: 'network_check'
            });
            checkProxyBtn.element.style.alignSelf = 'flex-start';
            proxySec.appendChild(checkProxyBtn.element);

            container.appendChild(proxySec);

            // Divider
            const divider = document.createElement('div');
            divider.style.cssText = 'height: 1px; background: var(--border-default); margin: 8px 0;';
            container.appendChild(divider);

            // --- Geo & Timezone Section ---
            const geoSec = document.createElement('div');
            geoSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';
            
            const geoTitle = document.createElement('div');
            geoTitle.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
            geoTitle.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; color: var(--accent);">public</span> Geolocation & Timezone';
            geoSec.appendChild(geoTitle);

            // Geolocation Mode
            const geoModeRow = document.createElement('div');
            geoModeRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: end;';
            
            const geoModeWrap = document.createElement('div');
            geoModeWrap.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
            const geoModeLbl = document.createElement('label');
            geoModeLbl.textContent = 'Geolocation Access';
            geoModeLbl.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary);';
            this.geoModeToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Prompt', value: 'Prompt' }, { label: 'Allow', value: 'Allow' }, { label: 'Block', value: 'Block' }],
                value: 'Block',
                fullWidth: true
            });
            geoModeWrap.appendChild(geoModeLbl);
            geoModeWrap.appendChild(this.geoModeToggle.element);

            // Timezone
            this.tzSelect = window.DuckControls.ComboBox.create({
                label: 'Timezone',
                placeholder: 'Search timezone...',
                options: [{ label: 'Auto (Match IP)', value: 'auto' }],
                value: 'auto'
            });

            geoModeRow.appendChild(geoModeWrap);
            geoModeRow.appendChild(this.tzSelect.element);
            geoSec.appendChild(geoModeRow);

            // Language
            this.langTagInput = window.DuckControls.TagInput.create({
                label: 'Languages (Accept-Language)',
                placeholder: 'e.g. en-US, en (press Enter)',
                values: ['en-US', 'en']
            });
            geoSec.appendChild(this.langTagInput.element);

            // Custom Coordinates
            const coordWrap = document.createElement('div');
            coordWrap.style.cssText = 'display: flex; flex-direction: column; gap: 8px; margin-top: 4px;';
            
            const coordHeader = document.createElement('div');
            coordHeader.style.cssText = 'display: flex; align-items: center; justify-content: space-between;';
            const coordTitle = document.createElement('label');
            coordTitle.textContent = 'Custom Coordinates';
            coordTitle.style.cssText = 'font-size: 12px; font-weight: 600; color: var(--text-secondary);';
            this.coordSwitch = window.DuckControls.Checkbox.create(null, {
                label: 'Enable',
                checked: false,
                onChange: (e) => {
                    coordInputs.style.display = e.checked ? 'grid' : 'none';
                }
            });
            coordHeader.appendChild(coordTitle);
            coordHeader.appendChild(this.coordSwitch.element);
            coordWrap.appendChild(coordHeader);

            const coordInputs = document.createElement('div');
            coordInputs.style.cssText = 'display: none; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; align-items: end;';
            this.latIn = window.DuckControls.Input.create({ label: 'Latitude', type: 'number', icon: 'my_location' });
            this.lngIn = window.DuckControls.Input.create({ label: 'Longitude', type: 'number', icon: 'location_on' });
            coordInputs.appendChild(this.latIn.element);
            coordInputs.appendChild(this.lngIn.element);
            coordWrap.appendChild(coordInputs);

            geoSec.appendChild(coordWrap);
            container.appendChild(geoSec);

            return container;
        },

        getValues() {
            const proxyType = this.proxyTypeToggle ? this.proxyTypeToggle.getValue() : 'none';
            const proxyConfig = {
                type: proxyType,
                protocol: proxyType === 'custom' ? (this.pType ? this.pType.getValue() : null) : null,
                host: proxyType === 'custom' ? (this.pHost ? this.pHost.getValue() : '') : null,
                auth: proxyType === 'custom' ? (this.pAuth ? this.pAuth.getValue() : '') : null,
                savedProxyId: proxyType === 'saved' ? (this.sProxy ? this.sProxy.getValue() : null) : null
            };

            const geoEnabled = this.coordSwitch ? this.coordSwitch.options.checked : false;

            return {
                proxy: proxyConfig,
                geolocationAccess: this.geoModeToggle ? this.geoModeToggle.getValue() : 'Block',
                timezone: this.tzSelect ? this.tzSelect.getValue() : 'auto',
                languages: this.langTagInput ? this.langTagInput.getValues() : [],
                customCoordinates: geoEnabled ? {
                    lat: this.latIn ? this.latIn.getValue() : '',
                    lng: this.lngIn ? this.lngIn.getValue() : ''
                } : null
            };
        }
    };
})();
