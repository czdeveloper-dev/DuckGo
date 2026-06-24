window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.NewFingerprint = {
    show(selectedIds) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);

        let statusLabel = null;
        let isProcessing = false;

        const updateStatus = (message, isError = false) => {
            if (statusLabel) {
                statusLabel.textContent = message;
                statusLabel.style.color = isError ? 'var(--danger)' : 'var(--text-secondary)';
            }
        };

        DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Generate New Fingerprint',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ${count} selected profiles`,
            icon: 'casino',
            content: `
                <div style="font-size: 13px; color: var(--text-primary); line-height: 1.5;">
                    <p style="margin-bottom: 12px; font-weight: 500;">Do you want to confirm changing the fingerprint for the selected profiles?</p>
                    <div style="background: var(--warning-bg); border: 1px solid var(--warning-border); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                        <div style="color: var(--warning); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <span class="material-symbols-outlined" style="font-size: 16px;">warning</span> Important Warning
                        </div>
                        <ul style="list-style: disc; margin-left: 20px; color: var(--text-secondary); margin-bottom: 0;">
                            <li><strong>New Device Identity:</strong> Changing the fingerprint means websites will recognize this profile as a completely new physical device.</li>
                            <li><strong>Account Security Triggers:</strong> This may trigger security checkpoints (e.g., 2FA, suspicious login alerts) on active accounts.</li>
                            <li><strong>Irreversible Action:</strong> The previous hardware canvas, WebGL, and Audio contexts will be permanently replaced.</li>
                        </ul>
                    </div>
                    <div id="new-fp-status" style="margin-top: 12px; font-size: 12px;"></div>
                </div>
            `,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => {
                    modal.close();
                }},
                { text: 'Change Fingerprint', icon: 'fingerprint', class: 'duck-btn-primary', onClick: async (e, modal) => {
                    modal.setLoading(true, 'Changing...');

                    try {
                        const idsArray = Array.isArray(selectedIds) ? selectedIds : [...selectedIds];
                        await DuckBridge.call('profile.regenerateFingerprint', idsArray);
                        
                        if (window.ProfilesView) {
                            if (window.ProfilesView.loadProfiles) window.ProfilesView.loadProfiles();
                            if (window.ProfilesView.loadGroups) window.ProfilesView.loadGroups();
                            if (window.ProfilesView.loadTags) window.ProfilesView.loadTags();
                        }
                        modal.close();
                    } catch (err) {
                        updateStatus(err.message || 'Failed to request new fingerprint.', true);
                        modal.setLoading(false);
                    }
                }}
            ],
            onContentReady: () => {
                statusLabel = document.getElementById('new-fp-status');
            }
        }).open();
    }
};


