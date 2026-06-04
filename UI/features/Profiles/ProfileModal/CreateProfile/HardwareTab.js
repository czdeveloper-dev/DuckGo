(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.HardwareTab = {
        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 32px; width: 100%;';

            const header = document.createElement('div');
            header.innerHTML = `
                <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;">Hardware Setup</h2>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Spoof hardware concurrency, memory, display, graphics (WebGL, Canvas), and environment plugins.</div>
            `;
            container.appendChild(header);

            // --- CPU & Memory ---
            const cpuSec = document.createElement('div');
            cpuSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';
            const cpuTitle = document.createElement('div');
            cpuTitle.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
            cpuTitle.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px; color: var(--accent);">memory</span> CPU & Memory`;
            cpuSec.appendChild(cpuTitle);

            const cpuRow = document.createElement('div');
            cpuRow.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 20px;';
            
            const cpuSelect = window.DuckControls.Select.create({
                label: 'Hardware Concurrency',
                options: [{ label: '8 Cores', value: '8' }, { label: '16 Cores', value: '16' }]
            });
            const memSelect = window.DuckControls.Select.create({
                label: 'Device Memory',
                options: [{ label: '8 GB', value: '8' }, { label: '16 GB', value: '16' }]
            });
            cpuRow.appendChild(cpuSelect.element);
            cpuRow.appendChild(memSelect.element);
            cpuSec.appendChild(cpuRow);
            container.appendChild(cpuSec);

            // Divider
            const divider1 = document.createElement('div');
            divider1.style.cssText = 'height: 1px; background: var(--border-default); margin: 8px 0;';
            container.appendChild(divider1);

            // --- Display & Graphics ---
            const gfxSec = document.createElement('div');
            gfxSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';
            const gfxTitle = document.createElement('div');
            gfxTitle.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
            gfxTitle.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px; color: var(--accent);">monitor</span> Display & Graphics`;
            gfxSec.appendChild(gfxTitle);

            // Screen Resolution
            const resRow = document.createElement('div');
            resRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: start; gap: 20px;';
            const resLabelWrap = document.createElement('div');
            resLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Screen Resolution</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Monitor width, height & depth</div>';
            
            const resWrap = document.createElement('div');
            resWrap.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
            const resToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Real', value: 'real' }, { label: 'Random', value: 'random' }, { label: 'Custom', value: 'custom' }],
                value: 'real',
                onChange: (val) => {
                    resCustomBox.style.display = val === 'custom' ? 'flex' : 'none';
                }
            });
            resWrap.appendChild(resToggle.element);
            
            const resCustomBox = document.createElement('div');
            resCustomBox.style.cssText = 'display: none; justify-content: center; align-items: center; gap: 32px; background: var(--bg-surface); padding: 24px; border-radius: 8px; border: 1px solid var(--border-default); margin-top: 16px; width: 100%; box-sizing: border-box;';
            
            const wSelect = window.DuckControls.Select.create({
                label: 'Width (px)',
                options: [{value: '1920', label: '1920'}, {value: '2560', label: '2560'}, {value: '1366', label: '1366'}, {value: '1280', label: '1280'}],
                value: '1920',
                width: '120px'
            });
            const hSelect = window.DuckControls.Select.create({
                label: 'Height (px)',
                options: [{value: '1080', label: '1080'}, {value: '1440', label: '1440'}, {value: '768', label: '768'}, {value: '720', label: '720'}],
                value: '1080',
                width: '120px'
            });
            const dSelect = window.DuckControls.Select.create({
                label: 'Color Depth',
                options: [{value: '24', label: '24-bit'}, {value: '32', label: '32-bit'}, {value: '16', label: '16-bit'}],
                value: '24',
                width: '120px'
            });
            resCustomBox.appendChild(wSelect.element);
            resCustomBox.appendChild(hSelect.element);
            resCustomBox.appendChild(dSelect.element);

            resRow.appendChild(resLabelWrap);
            resRow.appendChild(resWrap);
            gfxSec.appendChild(resRow);
            gfxSec.appendChild(resCustomBox);

            // Canvas
            const canvasRow = document.createElement('div');
            canvasRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 20px; margin-top: 10px;';
            const canvasLabelWrap = document.createElement('div');
            canvasLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Canvas Spoofing</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Add noise to Canvas API</div>';
            const canvasToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Block', value: 'block' }, { label: 'Off', value: 'off' }],
                value: 'noise'
            });
            canvasRow.appendChild(canvasLabelWrap);
            canvasRow.appendChild(canvasToggle.element);
            gfxSec.appendChild(canvasRow);

            // WebGL Image
            const webglImgRow = document.createElement('div');
            webglImgRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 20px; margin-top: 10px;';
            const webglImgLabelWrap = document.createElement('div');
            webglImgLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">WebGL Image Data</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Add noise to WebGL</div>';
            const webglImgToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Block', value: 'block' }, { label: 'Off', value: 'off' }],
                value: 'noise'
            });
            webglImgRow.appendChild(webglImgLabelWrap);
            webglImgRow.appendChild(webglImgToggle.element);
            gfxSec.appendChild(webglImgRow);

            // WebGL Metadata
            const webglMetaRow = document.createElement('div');
            webglMetaRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: start; gap: 20px; margin-top: 10px;';
            const webglMetaLabelWrap = document.createElement('div');
            webglMetaLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">WebGL Metadata</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Vendor and Renderer</div>';
            
            const webglMetaWrap = document.createElement('div');
            webglMetaWrap.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
            const webglMetaToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Real', value: 'real' }, { label: 'Random', value: 'random' }, { label: 'Custom', value: 'custom' }],
                value: 'random',
                onChange: (val) => {
                    webglCustomBox.style.display = val === 'custom' ? 'flex' : 'none';
                }
            });
            webglMetaWrap.appendChild(webglMetaToggle.element);
            
            const webglCustomBox = document.createElement('div');
            webglCustomBox.style.cssText = 'display: none; justify-content: center; align-items: center; gap: 32px; background: var(--bg-surface); padding: 24px; border-radius: 8px; border: 1px solid var(--border-default); margin-top: 16px; width: 100%; box-sizing: border-box;';
            
            const vendorSelect = window.DuckControls.Select.create({
                label: 'Unmasked Vendor',
                placeholder: 'Select vendor...',
                options: [{ label: 'Google Inc. (Apple)', value: 'apple' }, { label: 'Google Inc. (NVIDIA)', value: 'nvidia' }, { label: 'Google Inc. (Intel)', value: 'intel' }],
                value: 'apple',
                width: '180px'
            });
            webglCustomBox.appendChild(vendorSelect.element);

            // Renderer Input + Random Button
            const rendererRow = document.createElement('div');
            rendererRow.style.cssText = 'display: flex; gap: 12px; align-items: flex-end; width: 460px;';
            const rendererIn = window.DuckControls.Input.create({ label: 'Unmasked Renderer', placeholder: 'ANGLE (Apple, Apple M1 Pro, OpenGL 4.1)' });
            rendererIn.element.style.flex = '1';
            const rndBtn = window.DuckControls.Button.create(null, { icon: 'shuffle', variant: 'surface' });
            rndBtn.element.title = 'Generate random renderer';
            rendererRow.appendChild(rendererIn.element);
            rendererRow.appendChild(rndBtn.element);

            webglCustomBox.appendChild(rendererRow);

            webglMetaRow.appendChild(webglMetaLabelWrap);
            webglMetaRow.appendChild(webglMetaWrap);
            gfxSec.appendChild(webglMetaRow);
            gfxSec.appendChild(webglCustomBox);

            container.appendChild(gfxSec);

            // Divider
            const divider2 = document.createElement('div');
            divider2.style.cssText = 'height: 1px; background: var(--border-default); margin: 8px 0;';
            container.appendChild(divider2);

            // --- Environment ---
            const envSec = document.createElement('div');
            envSec.style.cssText = 'display: flex; flex-direction: column; gap: 20px;';
            const envTitle = document.createElement('div');
            envTitle.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px; margin-bottom: 4px;';
            envTitle.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px; color: var(--accent);">extension</span> Environment & Plugins`;
            envSec.appendChild(envTitle);

            // Plugins
            const pluginsRow = document.createElement('div');
            pluginsRow.style.cssText = 'display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 20px;';
            const pluginsLabelWrap = document.createElement('div');
            pluginsLabelWrap.innerHTML = '<div style="font-size: 13px; font-weight: 600; color: var(--text-primary);">Browser Plugins</div><div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Spoof plugin list</div>';
            const pluginsToggle = window.DuckControls.ToggleGroup.create({
                options: [{ label: 'Noise', value: 'noise' }, { label: 'Real', value: 'real' }],
                value: 'noise'
            });
            pluginsRow.appendChild(pluginsLabelWrap);
            pluginsRow.appendChild(pluginsToggle.element);
            envSec.appendChild(pluginsRow);

            container.appendChild(envSec);

            return container;
        }
    };
})();
