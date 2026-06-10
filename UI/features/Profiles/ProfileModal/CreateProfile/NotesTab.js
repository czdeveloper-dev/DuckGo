(function() {
    'use strict';

    window.ProfileModals = window.ProfileModals || {};
    window.ProfileModals.CreateProfile = window.ProfileModals.CreateProfile || {};

    window.ProfileModals.CreateProfile.NotesTab = {
        render() {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 32px; width: 100%; height: 100%;';

            const header = document.createElement('div');
            const h2 = document.createElement('h2');
            h2.style.cssText = 'margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: var(--text-primary); letter-spacing: -0.5px;';
            h2.textContent = 'Profile Notes';
            const subtitle = document.createElement('div');
            subtitle.style.cssText = 'font-size: 13px; color: var(--text-secondary); line-height: 1.5;';
            subtitle.textContent = 'Add custom notes or instructions for this profile.';
            header.appendChild(h2);
            header.appendChild(subtitle);
            container.appendChild(header);

            const notesTextarea = window.DuckControls.Textarea.create({
                label: 'Notes',
                placeholder: 'Enter your notes here...',
                rows: 15,
                onInput: () => window.ProfileModals?.CreateProfile?._scheduleSync?.()
            });
            notesTextarea.element.style.flex = '1';

            if (notesTextarea.textarea) {
                notesTextarea.textarea.style.height = '100%';
                notesTextarea.textarea.style.resize = 'none';
                notesTextarea.textarea.style.background = 'var(--bg-surface)';
            }

            container.appendChild(notesTextarea.element);
            this._textArea = notesTextarea;

            return container;
        },

        getValues() {
            return {
                notes: this._textArea ? this._textArea.getValue() : '',
            };
        },

        /** Set values from loaded profile data */
        setValues(values) {
            if (values.notes !== undefined && this._textArea) {
                this._textArea.setValue(values.notes || '');
            }
        }
    };
})();
