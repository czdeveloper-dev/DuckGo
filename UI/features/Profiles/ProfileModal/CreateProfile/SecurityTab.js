(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.SecurityTab = {
        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 32px; width: 100%;';

            const header = document.createElement('div');
            header.innerHTML = `
                <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;">Security & Privacy</h2>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Protect your identity with WebRTC, media devices, fonts, client rects, and port scanning protections.</div>
            `;
            container.appendChild(header);

            // --- WebRTC & Network Security ---
            const rtcSec = document.createElement('div');
            rtcSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';
            const rtcTitle = document.createElement('div');
            rtcTitle.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
            rtcTitle.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px; color: var(--accent);">shield</span> Network Security`;
            rtcSec.appendChild(rtcTitle);

            // WebRTC
            const rtcRow = document.createElement('div');
            rtcRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 20px;';
            const rtcLabelWrap = document.createElement('div');
            rtcLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">WebRTC Public IP</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Control WebRTC leak</div>';
            const rtcToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Alter', value: 'alter' }, { label: 'Disable', value: 'disable' }, { label: 'Real', value: 'real' }],
                value: 'disable'
            });
            rtcRow.appendChild(rtcLabelWrap);
            rtcRow.appendChild(rtcToggle.element);
            rtcSec.appendChild(rtcRow);

            // SSL
            const sslRow = document.createElement('div');
            sslRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 20px; margin-top: 10px;';
            const sslLabelWrap = document.createElement('div');
            sslLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">SSL</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Spoof SSL certificates</div>';
            const sslToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            sslRow.appendChild(sslLabelWrap);
            sslRow.appendChild(sslToggle.element);
            rtcSec.appendChild(sslRow);
            
            // Port Scan
            const portRow = document.createElement('div');
            portRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 20px; margin-top: 10px;';
            const portLabelWrap = document.createElement('div');
            portLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Port Scan Protection</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Localhost scan block</div>';
            const portToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Protect', value: 'protect' }, { label: 'Decline', value: 'decline' }],
                value: 'protect'
            });
            portRow.appendChild(portLabelWrap);
            portRow.appendChild(portToggle.element);
            rtcSec.appendChild(portRow);

            container.appendChild(rtcSec);

            // Divider
            const divider = document.createElement('div');
            divider.style.cssText = 'height: 1px; background: var(--border-default); margin: 8px 0;';
            container.appendChild(divider);

            // --- Privacy Masks (Media, Fonts, Rects) ---
            const privSec = document.createElement('div');
            privSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';
            const privTitle = document.createElement('div');
            privTitle.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
            privTitle.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px; color: var(--accent);">fingerprint</span> Privacy Masks`;
            privSec.appendChild(privTitle);

            // Media Devices
            const mediaRow = document.createElement('div');
            mediaRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 20px;';
            const mediaLabelWrap = document.createElement('div');
            mediaLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Media Devices</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Microphones & Cameras</div>';
            const mediaToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Block', value: 'block' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            mediaRow.appendChild(mediaLabelWrap);
            mediaRow.appendChild(mediaToggle.element);
            privSec.appendChild(mediaRow);

            // Speech Voices
            const speechRow = document.createElement('div');
            speechRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 20px; margin-top: 10px;';
            const speechLabelWrap = document.createElement('div');
            speechLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Speech Voices</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Web Speech API Voices</div>';
            const speechToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            speechRow.appendChild(speechLabelWrap);
            speechRow.appendChild(speechToggle.element);
            privSec.appendChild(speechRow);

            // Client Rects
            const rectsRow = document.createElement('div');
            rectsRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 20px; margin-top: 10px;';
            const rectsLabelWrap = document.createElement('div');
            rectsLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Client Rects</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">ClientRects API noise</div>';
            const rectsToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            rectsRow.appendChild(rectsLabelWrap);
            rectsRow.appendChild(rectsToggle.element);
            privSec.appendChild(rectsRow);

            // Fonts
            const fontsRow = document.createElement('div');
            fontsRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: start; gap: 20px; margin-top: 10px;';
            const fontsLabelWrap = document.createElement('div');
            fontsLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Fonts</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Installed System Fonts</div>';
            
            const fontsWrap = document.createElement('div');
            fontsWrap.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
            const fontsToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Default', value: 'default' }, { label: 'Custom', value: 'custom' }],
                value: 'default',
                onChange: (val) => {
                    fontCustomBox.style.display = val === 'custom' ? 'flex' : 'none';
                }
            });
            fontsWrap.appendChild(fontsToggle.element);

            const fontCustomBox = document.createElement('div');
            fontCustomBox.style.cssText = 'display: none; justify-content: center; align-items: center; background: var(--bg-surface); padding: 24px; border-radius: 8px; border: 1px solid var(--border-default); margin-top: 16px; width: 100%; box-sizing: border-box;';
            const fontTagInput = window.DuckControls.TagInput.create({
                label: 'Custom Fonts',
                placeholder: 'e.g. Arial, Helvetica (press Enter)',
                values: ['Arial']
            });
            fontTagInput.element.style.width = '600px';
            fontCustomBox.appendChild(fontTagInput.element);

            fontsRow.appendChild(fontsLabelWrap);
            fontsRow.appendChild(fontsWrap);
            privSec.appendChild(fontsRow);
            privSec.appendChild(fontCustomBox);

            container.appendChild(privSec);

            return container;
        }
    };
})();
