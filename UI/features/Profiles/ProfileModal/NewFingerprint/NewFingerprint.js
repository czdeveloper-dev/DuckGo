window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.NewFingerprint = {
    show(selectedIds) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);

        DuckControls.Modal.create({
            defaultEnter: true,
            title: 'Generate New Fingerprint',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ${count} selected profiles`,
            icon: 'casino',
            content: `
                <div style="font-size: 13px; color: var(--text-primary); line-height: 1.5;">
                    <p style="margin-bottom: 12px; font-weight: 500;">Do you want to confirm changing the fingerprint for the selected profiles?</p>
                    <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.2); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                        <div style="color: #eab308; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <span class="material-symbols-outlined" style="font-size: 16px;">warning</span> Important Warning
                        </div>
                        <ul style="list-style: disc; margin-left: 20px; color: var(--text-secondary); margin-bottom: 0;">
                            <li><strong>New Device Identity:</strong> Changing the fingerprint means websites will recognize this profile as a completely new physical device.</li>
                            <li><strong>Account Security Triggers:</strong> This may trigger security checkpoints (e.g., 2FA, suspicious login alerts) on active accounts.</li>
                            <li><strong>Irreversible Action:</strong> The previous hardware canvas, WebGL, and Audio contexts will be permanently replaced.</li>
                        </ul>
                    </div>
                </div>
            `,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Change Fingerprint', class: 'duck-btn-primary', onClick: (e, modal) => {
                    console.log('Generating new fingerprint for:', Array.from(selectedIds));
                    modal.close();
                }}
            ]
        }).open();
    }
};
