window.ProxyModals = window.ProxyModals || {};

window.ProxyModals.DeleteProxies = {
    show(selectedIds, onConfirm) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);
        if (count === 0) return;

        const isSingle = count === 1;
        const title = isSingle ? 'Delete Proxy' : 'Delete Selected Proxies';
        
        DuckControls.Modal.create({
            defaultEnter: true,
            title: title,
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Selected: ${count} proxy${count > 1 ? 'ies' : ''}`,
            icon: 'delete',
            content: `
                <div style="font-size: 13px; color: var(--text-primary); line-height: 1.5;">
                    <p style="margin-bottom: 12px; font-weight: 500;">Are you sure you want to permanently delete the selected proxy${count > 1 ? 'ies' : ''}?</p>
                    <div style="background: var(--danger-bg); border: 1px solid var(--danger-border); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                        <div style="color: var(--danger); font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <span class="material-symbols-outlined" style="font-size: 16px;">warning</span> Irreversible Action
                        </div>
                        <ul style="list-style: disc; margin-left: 20px; color: var(--text-secondary); margin-bottom: 0;">
                            <li><strong>Data Loss:</strong> All proxy data including credentials, status, and usage history will be permanently deleted.</li>
                            <li><strong>Profiles:</strong> Any profiles using these proxies will be updated to use Direct connection (no proxy).</li>
                            <li><strong>Cannot be undone:</strong> Once deleted, you cannot recover ${isSingle ? 'this proxy' : 'these proxies'}.</li>
                        </ul>
                    </div>
                    <p style="color: var(--text-tertiary); font-style: italic;">Please confirm your action below.</p>
                </div>
            `,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Delete', icon: 'delete_forever', class: 'duck-btn-danger', onClick: (e, modal) => {
                    modal.close();
                    if (onConfirm) {
                        const ids = Array.isArray(selectedIds) ? selectedIds : Array.from(selectedIds);
                        onConfirm(ids);
                    }
                }}
            ]
        }).open();
    }
};

