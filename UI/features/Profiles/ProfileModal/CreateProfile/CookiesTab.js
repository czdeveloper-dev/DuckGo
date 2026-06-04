(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.CookiesTab = {
        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 32px; width: 100%;';

            const header = document.createElement('div');
            header.innerHTML = `
                <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;">Cookies & Storage</h2>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Import cookies to warm up the profile before starting.</div>
            `;
            container.appendChild(header);

            const importWrap = document.createElement('div');
            importWrap.style.cssText = 'display: flex; flex-direction: column; gap: 16px; background: var(--bg-surface); padding: 24px; border-radius: 8px; border: 1px solid var(--border-default);';
            
            const importTitle = document.createElement('div');
            importTitle.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 8px;';
            importTitle.innerHTML = `<span class="material-symbols-outlined" style="font-size: 18px; color: var(--accent);">cookie</span> Import Cookies`;
            importWrap.appendChild(importTitle);

            const fileRow = document.createElement('div');
            fileRow.style.cssText = 'display: flex; align-items: center; gap: 16px;';
            const uploadBtn = window.DuckControls.Button.create(null, {
                text: 'Select File',
                variant: 'surface',
                icon: 'file_upload'
            });
            const fileStatus = document.createElement('span');
            fileStatus.style.cssText = 'font-size: 13px; color: var(--text-secondary);';
            fileStatus.textContent = 'No file selected (JSON or Netscape format)';
            fileRow.appendChild(uploadBtn.element);
            fileRow.appendChild(fileStatus);
            importWrap.appendChild(fileRow);

            const orDivider = document.createElement('div');
            orDivider.style.cssText = 'font-size: 12px; color: var(--text-muted); text-align: center; margin: 8px 0; position: relative;';
            orDivider.innerHTML = '<span style="background: var(--bg-surface); padding: 0 12px; position: relative; z-index: 2;">OR PASTE TEXT</span><div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--border-default); z-index: 1;"></div>';
            importWrap.appendChild(orDivider);

            const textArea = window.DuckControls.Textarea.create({
                placeholder: 'Paste your JSON or Netscape cookies here...',
                rows: 8
            });
            textArea.element.style.fontFamily = 'monospace';
            textArea.element.style.fontSize = '12px';
            importWrap.appendChild(textArea.element);

            container.appendChild(importWrap);

            return container;
        }
    };
})();
