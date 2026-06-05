window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.RemoveProxy = {
    show(selectedIds, onConfirm) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);
        if (count === 0) return;

        const isSingle = count === 1;
        const title = isSingle ? 'Remove Proxy' : 'Remove Proxy for Selected';
        
        DuckControls.Modal.create({
            defaultEnter: true,
            title: title,
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Selected: ${count} profile${count > 1 ? 's' : ''}`,
            icon: 'wifi_off',
            content: `
                <div style="font-size: 13px; color: var(--text-primary); line-height: 1.5;">
                    <p style="margin-bottom: 12px; font-weight: 500;">Are you sure you want to remove the proxy from the selected profile${count > 1 ? 's' : ''}?</p>
                    <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.2); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                        <div style="color: #eab308; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <span class="material-symbols-outlined" style="font-size: 16px;">warning</span> Important Warning
                        </div>
                        <ul style="list-style: disc; margin-left: 20px; color: var(--text-secondary); margin-bottom: 0;">
                            <li><strong>Direct Connection:</strong> ${isSingle ? 'This profile' : 'These profiles'} will now connect directly to the internet using your real IP address.</li>
                            <li><strong>Anonymity Risk:</strong> Websites may detect your actual location and network identity.</li>
                            <li><strong>Action:</strong> You can always re-assign a new proxy later from the Proxy settings.</li>
                        </ul>
                    </div>
                </div>
            `,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Remove Proxy', class: 'duck-btn-danger', onClick: (e, modal) => {
                    if (onConfirm) onConfirm(Array.from(selectedIds));
                    modal.close();
                }}
            ]
        }).open();
    }
};
