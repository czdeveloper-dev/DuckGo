window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.ClearCache = {
    show(selectedIds) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);
        
        DuckControls.Modal.create({
            title: 'Clear Profile Cache',
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Applied to ${count} selected profiles`,
            icon: 'cleaning_services',
            content: `
                <div style="font-size: 13px; color: var(--text-primary); line-height: 1.5;">
                    <p style="margin-bottom: 12px; font-weight: 500;">Are you sure you want to clear the cache for the selected profiles?</p>
                    <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.2); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                        <div style="color: #eab308; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <span class="material-symbols-outlined" style="font-size: 16px;">warning</span> Important Warning
                        </div>
                        <ul style="list-style: disc; margin-left: 20px; color: var(--text-secondary); margin-bottom: 0;">
                            <li><strong>Deleted Data:</strong> Static cookies (if configured), browsing history, temporary files, and local website data.</li>
                            <li><strong>Impact:</strong> The browser will launch from a clean state. You may need to log in again if cookies are cleared.</li>
                        </ul>
                    </div>
                </div>
            `,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Confirm Clear', class: 'duck-btn-danger', onClick: (e, modal) => {
                    console.log('Clearing cache for selected profiles:', Array.from(selectedIds));
                    modal.close();
                }}
            ]
        }).open();
    }
};
