window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.SetBrowserVersion = {
    _modal: null,

    show(selectedIds) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);

        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'font-size: 13px; color: var(--text-primary); line-height: 1.5; min-height: 150px; position: relative;';

        // Loading state - simple CSS class-based spinner
        const loader = document.createElement('div');
        loader.style.cssText = 'position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-base); z-index: 10; transition: opacity 0.3s;';
        loader.innerHTML = `
            <div class="duck-spinner-ring" style="width:28px;height:28px;margin-bottom:12px;"></div>
            <div style="color: var(--text-secondary);">Fetching available versions...</div>
        `;
        modalBody.appendChild(loader);

        // Content (hidden initially)
        const contentWrap = document.createElement('div');
        contentWrap.style.cssText = 'opacity: 0; transition: opacity 0.3s; display: flex; flex-direction: column; gap: 16px; pointer-events: none;';
        modalBody.appendChild(contentWrap);

        let autoUpdateUA = true;
        let versionCombo = null;

        this._modal = DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Set Browser Version',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ${count} selected profiles`,
            icon: 'manage_history',
            content: modalBody,
            size: 'md',
            closeOnOverlay: true,
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Update Version', class: 'duck-btn-primary', onClick: (e, modal) => {
                    const version = versionCombo ? versionCombo.getValue() : '';
                    console.log('Updating browser version to:', version, 'AutoUpdateUA:', autoUpdateUA, 'for profiles:', Array.from(selectedIds));
                    modal.close();
                }}
            ],
            onClose: () => {
                this._modal = null;
            }
        });

        this._modal.open();

        // Initially disable the submit button
        const submitBtn = this._modal.element.querySelector('.duck-btn-primary');
        if (submitBtn) submitBtn.disabled = true;

        // Simulate backend fetch
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 300);

            // Version selector using DuckControls.ComboBox
            const versionWrap = document.createElement('div');
            versionWrap.style.cssText = 'background: var(--bg-subtle); padding: 16px; border-radius: 6px; border: 1px solid var(--border-light); display: flex; flex-direction: column; gap: 12px;';

            versionCombo = DuckControls.ComboBox.create({
                label: 'Select Target Version',
                options: [
                    { label: 'Chromium 120.0.6099.109 (Stable) - 145 MB', value: '120.0.6099.109' },
                    { label: 'Chromium 119.0.6045.199 - 143 MB', value: '119.0.6045.199' },
                    { label: 'Chromium 118.0.5993.117 - 142 MB', value: '118.0.5993.117' }
                ],
                value: '120.0.6099.109'
            });
            versionWrap.appendChild(versionCombo.element);

            const note = document.createElement('div');
            note.style.cssText = 'font-size: 12px; color: var(--text-secondary); line-height: 1.5;';
            note.innerHTML = `<span style="color: var(--accent); font-weight: 500;">Note:</span> This action will securely switch the core browser version. It will trigger a download if the core is not already cached locally.`;
            versionWrap.appendChild(note);
            contentWrap.appendChild(versionWrap);

            // Auto-update UserAgent checkbox
            const cbWrap = document.createElement('div');
            contentWrap.appendChild(cbWrap);

            DuckControls.Checkbox.create(cbWrap, {
                label: 'Automatically update User-Agent to match browser version (Recommended)',
                checked: true,
                onChange: (e) => {
                    autoUpdateUA = e.checked;
                }
            });

            // Reveal content + enable submit
            contentWrap.style.opacity = '1';
            contentWrap.style.pointerEvents = 'auto';
            if (submitBtn) submitBtn.disabled = false;
        }, 1200);
    }
};
