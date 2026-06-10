(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.CookiesTab = {
        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 32px; width: 100%;';

            const header = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.style.cssText = 'margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;';
            h2.textContent = 'Cookies & Storage';
            const subtitle = document.createElement('div');
            subtitle.style.cssText = 'font-size: 13px; color: var(--text-secondary); line-height: 1.5;';
            subtitle.textContent = 'Import cookies to warm up the profile before starting.';
            header.appendChild(h2);
            header.appendChild(subtitle);
            container.appendChild(header);

            const importWrap = document.createElement('div');
            importWrap.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

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

            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json,.txt,.cookies';
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                fileStatus.textContent = file.name;
                try {
                    const text = await file.text();
                    this._cookiesFileName = file.name;
                    this._cookiesRawData = text;
                    textArea.setValue(text);
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                } catch {
                    fileStatus.textContent = 'Failed to read file';
                }
            });
            uploadBtn.options.onClick = () => fileInput.click();
            importWrap.appendChild(fileInput);

            const orDivider = document.createElement('div');
            orDivider.style.cssText = 'font-size: 12px; color: var(--text-muted); text-align: center; margin: 8px 0; position: relative;';
            const orSpan = document.createElement('span');
            orSpan.style.cssText = 'background: var(--bg-surface); padding: 0 12px; position: relative; z-index: 2;';
            orSpan.textContent = 'OR PASTE TEXT';
            const orLine = document.createElement('div');
            orLine.style.cssText = 'position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--border-default); z-index: 1;';
            orDivider.appendChild(orSpan);
            orDivider.appendChild(orLine);
            importWrap.appendChild(orDivider);

            const textArea = window.DuckControls.Textarea.create({
                placeholder: 'Paste your JSON or Netscape cookies here...',
                rows: 8,
                onInput: (e) => {
                    this._cookiesRawData = e.target.value;
                    window.ProfileModals?.CreateProfile?._scheduleSync?.();
                }
            });
            textArea.element.style.fontFamily = 'monospace';
            textArea.element.style.fontSize = '12px';
            importWrap.appendChild(textArea.element);
            this._textArea = textArea;

            container.appendChild(window.DuckControls.Card.create({
                title: 'Import Cookies',
                icon: 'cookie',
                desc: 'Load session cookies from file or text block',
                content: importWrap
            }).element);

            return container;
        },

        getValues() {
            const data = this._textArea ? this._textArea.getValue() : (this._cookiesRawData || '');
            return {
                cookiesData: data || null,
                cookiesFileName: this._cookiesFileName || null,
            };
        },

        /** Set values from loaded profile data */
        setValues(values) {
            if (values.cookiesData && this._textArea) {
                this._textArea.setValue(values.cookiesData);
                this._cookiesRawData = values.cookiesData;
            }
        }
    };
})();
