window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.ChangeBookmark = {
    _modal: null,

    show(selectedIds) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);

        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex;flex-direction:column;gap:16px;';

        // Action ComboBox - using DuckControls.ComboBox properly
        let selectedAction = 'add';

        const actionCombo = window.DuckControls.ComboBox.create({
            label: 'Action',
            options: [
                { label: 'Add (Append to existing)', value: 'add' },
                { label: 'Replace (Overwrite existing)', value: 'replace' },
                { label: 'Delete (Remove matched)', value: 'delete' }
            ],
            value: selectedAction,
            onChange: (e) => {
                selectedAction = e.target.value;
            }
        });
        modalBody.appendChild(actionCombo.element);

        // Textarea for Bookmarks
        const textareaWrap = document.createElement('div');
        const textareaCtrl = DuckControls.Textarea.create({
            label: 'Bookmarks (Format: Name|URL)',
            placeholder: 'Example:\nGoogle|https://google.com\nFacebook|https://facebook.com',
            rows: 6
        });
        textareaWrap.appendChild(textareaCtrl.element);

        // Help text
        const helpText = document.createElement('div');
        helpText.style.cssText = 'font-size: 12px; color: var(--text-secondary);';
        helpText.innerHTML = `Enter one bookmark per line. Separate title and URL with a pipe symbol (<code>|</code>).`;
        textareaWrap.appendChild(helpText);

        modalBody.appendChild(textareaWrap);

        this._modal = DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Change Bookmarks',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ${count} selected profiles`,
            icon: 'bookmark_add',
            content: modalBody,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Execute Update', class: 'duck-btn-primary', onClick: (e, modal) => {
                    console.log('Change Bookmark Executed:', {
                        targetProfiles: Array.from(selectedIds),
                        actionType: actionCombo.getValue(),
                        bookmarksData: textareaCtrl.getValue()
                    });
                    modal.close();
                }}
            ],
            onClose: () => {
                actionCombo.destroy();
                this._modal = null;
            }
        });

        this._modal.open();
    }
};
