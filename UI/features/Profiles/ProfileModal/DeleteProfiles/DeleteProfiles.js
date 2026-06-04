window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.DeleteProfiles = {
    show(selectedIds, onConfirm) {
        if (!selectedIds) selectedIds = new Set();
        const count = selectedIds.size !== undefined ? selectedIds.size : (selectedIds.length || 0);
        if (count === 0) return;

        const isSingle = count === 1;
        const title = isSingle ? 'Delete Profile' : 'Delete Selected Profiles';
        
        DuckControls.Modal.create({
            title: title,
            subtitle: `<span class="material-symbols-outlined" style="font-size:14px;">check_circle</span> Selected: ${count} profile${count > 1 ? 's' : ''}`,
            icon: 'delete',
            content: `
                <div style="font-size: 13px; color: var(--text-primary); line-height: 1.5;">
                    <p style="margin-bottom: 12px; font-weight: 500;">Are you sure you want to permanently delete the selected profile${count > 1 ? 's' : ''}?</p>
                    <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                        <div style="color: #ef4444; font-weight: 600; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                            <span class="material-symbols-outlined" style="font-size: 16px;">warning</span> Irreversible Action
                        </div>
                        <ul style="list-style: disc; margin-left: 20px; color: var(--text-secondary); margin-bottom: 0;">
                            <li><strong>Data Loss:</strong> All cookies, history, and local storage associated with ${isSingle ? 'this profile' : 'these profiles'} will be destroyed.</li>
                            <li><strong>Cannot be undone:</strong> Once deleted, you cannot recover ${isSingle ? 'this profile' : 'these profiles'}.</li>
                        </ul>
                    </div>
                    <p style="color: var(--text-tertiary); font-style: italic;">Please confirm your action below.</p>
                </div>
            `,
            size: 'md',
            buttons: [
                { text: 'Cancel', class: 'duck-btn-surface', onClick: (e, modal) => modal.close() },
                { text: 'Delete', class: 'duck-btn-danger', onClick: (e, modal) => {
                    if (onConfirm) onConfirm(Array.from(selectedIds));
                    modal.close();
                }}
            ]
        }).open();
    }
};
