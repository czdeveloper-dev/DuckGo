// SettingRow.js - A standard layout for a setting with title, description, and control

(function() {
    'use strict';

    window.DuckControls = window.DuckControls || {};

    /**
     * SettingRow Control
     * Options:
     *   - title: string
     *   - desc: string
     *   - control: HTMLElement (the actual input/toggle control)
     *   - alignTop: boolean (align items to the top instead of center)
     *   - fullWidthControl: boolean (let control grow if needed)
     */
    window.DuckControls.SettingRow = {
        create(options = {}) {
            const row = document.createElement('div');
            row.className = 'duck-setting-row';
            if (options.alignTop) {
                row.classList.add('duck-setting-row-top');
            }

            const textWrap = document.createElement('div');
            textWrap.className = 'duck-setting-row-text';

            if (options.title) {
                const title = document.createElement('div');
                title.className = 'duck-setting-row-title';
                title.textContent = options.title;
                textWrap.appendChild(title);
            }

            if (options.desc) {
                const desc = document.createElement('div');
                desc.className = 'duck-setting-row-desc';
                desc.textContent = options.desc;
                textWrap.appendChild(desc);
            }

            row.appendChild(textWrap);

            if (options.control) {
                const controlWrap = document.createElement('div');
                controlWrap.className = 'duck-setting-row-control';
                if (options.fullWidthControl) {
                    controlWrap.classList.add('duck-setting-row-control-full');
                }
                controlWrap.appendChild(options.control);
                row.appendChild(controlWrap);
            }

            return {
                element: row
            };
        }
    };
})();
