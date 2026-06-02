window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.UpdateStartUrl = {
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

        let isBulkMode = false;

        // Mode Toggle Checkbox
        const toggleWrap = document.createElement('div');
        toggleWrap.style.cssText = 'background: var(--bg-subtle); padding: 12px; border-radius: 6px; border: 1px solid var(--border-light);';
        
        DuckControls.Checkbox.create(toggleWrap, {
            label: 'Bulk Mode (Enter different Start URLs per Profile)',
            checked: isBulkMode,
            onChange: (e) => {
                isBulkMode = e.checked;
                updateVisibility();
            }
        });
        
        modalBody.appendChild(toggleWrap);

        // Single Input Container
        const singleWrap = document.createElement('div');
        const singleInput = DuckControls.Input.create({
            label: 'Start URL (Apply to all selected profiles)',
            placeholder: 'https://example.com'
        });
        singleWrap.appendChild(singleInput.element);
        
        const singleHelp = document.createElement('div');
        singleHelp.style.cssText = 'font-size: 12px; color: var(--text-secondary); margin-top: 6px;';
        singleHelp.textContent = `This URL will be set as the startup page for all ${count} selected profiles.`;
        singleWrap.appendChild(singleHelp);
        
        modalBody.appendChild(singleWrap);

        // Bulk Textarea Container
        const bulkWrap = document.createElement('div');
        const bulkTextarea = DuckControls.Textarea.create({
            label: 'Start URLs (Format: ProfileName|URL)',
            placeholder: 'Profile 1|https://google.com\nProfile 2|https://facebook.com',
            rows: 6
        });
        bulkWrap.appendChild(bulkTextarea.element);
        
        const bulkHelp = document.createElement('div');
        bulkHelp.style.cssText = 'font-size: 12px; color: var(--text-secondary); margin-top: 6px;';
        bulkHelp.innerHTML = `Enter one configuration per line. Separate Profile Name and URL with a pipe symbol (<code>|</code>).`;
        bulkWrap.appendChild(bulkHelp);
        
        modalBody.appendChild(bulkWrap);

        // Visibility Toggler
        const updateVisibility = () => {
            if (isBulkMode) {
                singleWrap.style.display = 'none';
                bulkWrap.style.display = 'block';
            } else {
                singleWrap.style.display = 'block';
                bulkWrap.style.display = 'none';
            }
        };
        updateVisibility();

        this._modal = DuckControls.Modal.create({
            title: 'Update Start URL',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ${count} selected profiles`,
            icon: 'link',
            content: modalBody,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Save Start URL', class: 'duck-btn-primary', onClick: (e, modal) => {
                    const data = isBulkMode ? bulkTextarea.getValue() : singleInput.getValue();
                    console.log('Update Start URL Executed:', {
                        targetProfiles: Array.from(selectedIds),
                        mode: isBulkMode ? 'bulk' : 'single',
                        data: data
                    });
                    modal.close();
                }}
            ],
            onClose: () => {
                this._modal = null;
            }
        });

        this._modal.open();
    }
};
