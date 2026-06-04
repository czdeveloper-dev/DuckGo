(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.NotesTab = {
        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 32px; width: 100%; height: 100%;';

            const header = document.createElement('div');
            header.innerHTML = `
                <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;">Profile Notes</h2>
                <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">Add custom notes or instructions for this profile.</div>
            `;
            container.appendChild(header);

            const textArea = window.DuckControls.Textarea.create({
                placeholder: 'Enter your notes here...',
                rows: 15
            });
            textArea.element.style.flex = '1';
            
            const textareaEl = textArea.element.querySelector('textarea');
            if (textareaEl) {
                textareaEl.style.height = '100%';
                textareaEl.style.resize = 'none';
                textareaEl.style.background = 'var(--bg-surface)';
            }
            
            container.appendChild(textArea.element);

            return container;
        }
    };
})();
