window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.SyncActions = {
    _modal: null,
    
    show(allProfiles = [], selectedIds = new Set()) {
        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex; gap:16px; align-items: stretch;';
        
        // Load saved state early so we can use it
        const savedStateJson = localStorage.getItem('duck_sync_actions_state');
        let savedState = {};
        if (savedStateJson) {
            try { savedState = JSON.parse(savedStateJson); } catch (e) {}
        }
        
        const maxGrid = 5;
        let cols = savedState.cols !== undefined ? savedState.cols : 2;
        let rows = savedState.rows !== undefined ? savedState.rows : 2;

        // Forward declare controls for saveState
        let delaySpin, monitorCombo, modeRadio, scaleCb, gapSpin, pasteTa;

        const saveState = () => {
            const state = {
                delay: delaySpin ? delaySpin.getValue() : 1000,
                monitor: monitorCombo ? monitorCombo.element.querySelector('.duck-combobox-select').textContent === 'Secondary Monitor' ? '2' : '1' : '1',
                layoutMode: modeRadio ? modeRadio.getValue() : 'grid',
                cols: cols,
                rows: rows,
                autoScale: scaleCb ? scaleCb.isChecked() : true,
                gap: gapSpin ? gapSpin.getValue() : 10
            };
            localStorage.setItem('duck_sync_actions_state', JSON.stringify(state));
        };

        // --- Left Column (Text Syncing) ---
        const leftCol = document.createElement('div');
        leftCol.style.cssText = 'flex: 1; display:flex; flex-direction:column; gap:12px; background: var(--bg-surface); padding: 16px; border-radius: var(--r-md); border: 1px solid var(--border-default);';
        
        const pasteTitleWrap = document.createElement('div');
        pasteTitleWrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        
        const pasteTitle = document.createElement('div');
        pasteTitle.style.cssText = 'font-size: 15px; font-weight: 600; color: var(--text-primary); display:flex; align-items:center; gap: 8px;';
        pasteTitle.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px; color: var(--accent);">text_snippet</span> Text Syncing';
        pasteTitleWrap.appendChild(pasteTitle);
        
        const pasteBadge = document.createElement('div');
        pasteBadge.style.cssText = 'font-size: 12px; color: var(--text-secondary); background: var(--bg-surface-hover, #f8f9fa); padding: 8px 12px; border-radius: 6px; border: 1px dashed var(--border-default); line-height: 1.4; display: flex; align-items: center; gap: 6px;';
        pasteBadge.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; color: var(--info, #0dcaf0);">info</span> <span><b>Enter</b> = Next Browser &bull; <b>Shift+Enter</b> = Newline</span>';
        pasteTitleWrap.appendChild(pasteBadge);
        
        leftCol.appendChild(pasteTitleWrap);
        
        pasteTa = window.DuckControls.Textarea.create({
            placeholder: 'Text for browser 1...\nText for browser 2...\n(Press Shift+Enter for multiple lines in the same browser)',
            rows: 6
        });
        
        
        pasteTa.textarea.addEventListener('input', saveState);

        pasteTa.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                // Backend parses regular Enter as split between browsers
            }
        });
        
        pasteTa.element.style.flex = '1';
        pasteTa.element.style.display = 'flex';
        pasteTa.element.style.flexDirection = 'column';
        pasteTa.textarea.style.height = '100%'; 
        pasteTa.textarea.style.minHeight = '140px';
        pasteTa.textarea.style.resize = 'none';
        pasteTa.textarea.style.fontFamily = "'Consolas', 'Courier New', monospace";
        pasteTa.textarea.style.fontSize = "13px";
        
        const pasteBtnWrap = document.createElement('div');
        pasteBtnWrap.style.cssText = 'margin-top:auto; padding-top: 12px;'; 
        
        const pasteBtn = document.createElement('button');
        pasteBtn.className = 'duck-btn duck-btn-primary';
        pasteBtn.style.width = '100%';
        pasteBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px; margin-right:4px;">send</span> Execute Text Sync';
        pasteBtn.addEventListener('click', () => {
            // Functionality to be implemented
        });
        pasteBtnWrap.appendChild(pasteBtn);
        
        leftCol.appendChild(pasteTa.element);
        leftCol.appendChild(pasteBtnWrap);
        
        modalBody.appendChild(leftCol);
        
        // --- Divider between columns ---
        const mainDiv = document.createElement('div');
        mainDiv.style.cssText = 'width: 1px; background: var(--border-default);';
        modalBody.appendChild(mainDiv);
        
        // --- Right Column (Settings) ---
        const rightCol = document.createElement('div');
        rightCol.style.cssText = 'flex: 1.2; display:flex; flex-direction:column; gap:12px;';
        
        // 1. Sync Flow Title & Intro
        const rightTitleWrap = document.createElement('div');
        rightTitleWrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        
        const rightTitle = document.createElement('div');
        rightTitle.style.cssText = 'font-size: 15px; font-weight: 600; color: var(--text-primary); display:flex; align-items:center; gap: 8px;';
        rightTitle.innerHTML = '<span class="material-symbols-outlined" style="font-size:20px; color: var(--accent);">route</span> Synchronization Flow';
        rightTitleWrap.appendChild(rightTitle);
        
        const rightBadge = document.createElement('div');
        rightBadge.style.cssText = 'font-size: 12px; color: var(--text-secondary); background: var(--bg-surface-hover, #f8f9fa); padding: 8px 12px; border-radius: 6px; border: 1px dashed var(--border-default); line-height: 1.4;';
        rightBadge.innerHTML = 'Mirrors mouse movements, clicks, and keystrokes from the <b>Master Profile</b> to all <b>Target Profiles</b> in real-time.';
        rightTitleWrap.appendChild(rightBadge);
        
        rightCol.appendChild(rightTitleWrap);
        
        // 2. Connection Block
        const connectionBlock = document.createElement('div');
        connectionBlock.style.cssText = 'display: flex; flex-direction: column; background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px; padding: 12px; position: relative;';

        const masterRow = document.createElement('div');
        masterRow.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
        const masterLabel = document.createElement('div');
        masterLabel.style.cssText = 'font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0px;';
        masterLabel.textContent = 'Master Profile (Source)';
        masterRow.appendChild(masterLabel);
        
        const opts = allProfiles.map(p => ({ label: p.name, value: String(p.id) }));
        let masterVal = opts.length ? opts[0].value : '';
        const masterComboCtrl = window.DuckControls.ComboBox.create({
            options: opts,
            value: masterVal,
            onChange: (e) => masterVal = e.target.value
        });
        masterRow.appendChild(masterComboCtrl.element);
        
        const targetsRow = document.createElement('div');
        targetsRow.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-top: 12px;';
        const targetsLabel = document.createElement('div');
        targetsLabel.style.cssText = 'font-size: 11px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px;';
        targetsLabel.textContent = 'Target Profiles (Destination)';
        targetsRow.appendChild(targetsLabel);
        
        const countWrap = document.createElement('div');
        countWrap.style.cssText = 'display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--accent-subtle); border: 1px solid var(--accent); border-radius: 8px; color: var(--accent); font-size: 13px; font-weight: 500;';
        countWrap.innerHTML = `
            <span class="material-symbols-outlined" style="font-size:18px;">devices</span>
            <div><strong>${selectedIds.size}</strong> profile(s) selected and ready to sync</div>
        `;
        targetsRow.appendChild(countWrap);
        
        connectionBlock.appendChild(masterRow);
        connectionBlock.appendChild(targetsRow);
        
        rightCol.appendChild(connectionBlock);

        // 3. Settings (Delay, Screen)
        const configRow = document.createElement('div');
        configRow.style.cssText = 'display:flex; gap:16px; align-items:flex-end;';
        
        const delayWrap = document.createElement('div');
        delayWrap.style.cssText = 'flex: 1; display:flex; flex-direction:column; gap:4px;';
        const delayLabel = document.createElement('label');
        delayLabel.className = 'ui-label';
        delayLabel.textContent = 'Delay (ms)';
        delayWrap.appendChild(delayLabel);
        delaySpin = window.DuckControls.SpinNumber.create({ 
            value: savedState.delay !== undefined ? savedState.delay : 1000, min: 0, max: 10000, step: 100,
            onChange: saveState
        });
        delayWrap.appendChild(delaySpin.element);
        
        const monitorWrap = document.createElement('div');
        monitorWrap.style.flex = '1.5';
        let currentMonitor = savedState.monitor || '1';
        monitorCombo = window.DuckControls.ComboBox.create({
            label: 'Target Screen',
            options: [
                { label: 'Primary Monitor', value: '1' },
                { label: 'Secondary Monitor', value: '2' }
            ],
            value: currentMonitor,
            onChange: (e) => {
                currentMonitor = e.target.value;
                saveState();
            }
        });
        monitorWrap.appendChild(monitorCombo.element);
        
        configRow.appendChild(delayWrap);
        configRow.appendChild(monitorWrap);
        
        rightCol.appendChild(configRow);
        
        const div1 = document.createElement('div');
        div1.style.cssText = 'height: 1px; background: var(--border-default);';
        rightCol.appendChild(div1);
        
        // 4. Window Layout
        const layoutSection = document.createElement('div');
        layoutSection.style.cssText = 'display:flex; flex-direction:column; gap:10px;';
        
        const layoutHeader = document.createElement('div');
        layoutHeader.style.cssText = 'font-size: 14px; font-weight: 600; color: var(--text-primary); display:flex; align-items:center; gap: 8px; margin-bottom: -4px;';
        layoutHeader.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px; color: var(--accent);">grid_view</span> Window Layout';
        layoutSection.appendChild(layoutHeader);
        
        const modeWrap = document.createElement('div');
        modeWrap.style.alignSelf = 'flex-start';
        modeRadio = window.DuckControls.ChipSelect.create({
            name: 'layoutMode',
            options: [
                { label: 'Auto Split Evenly', value: 'auto' },
                { label: 'Grid Layout', value: 'grid' }
            ],
            value: savedState.layoutMode || 'grid',
            onChange: (val) => {
                if (val !== 'grid') {
                    gridSettingsWrap.style.opacity = '0.3';
                    gridSettingsWrap.style.pointerEvents = 'none';
                } else {
                    gridSettingsWrap.style.opacity = '1';
                    gridSettingsWrap.style.pointerEvents = 'auto';
                }
                saveState();
            }
        });
        modeRadio.element.style.width = 'max-content';
        modeWrap.appendChild(modeRadio.element);
        layoutSection.appendChild(modeWrap);
        
        const gridSettingsWrap = document.createElement('div');
        gridSettingsWrap.style.cssText = 'display:flex; flex-direction:column; gap: 10px; transition: all 0.3s ease;';
        if (modeRadio.getValue() !== 'grid') {
            gridSettingsWrap.style.opacity = '0.3';
            gridSettingsWrap.style.pointerEvents = 'none';
        }
        
        const layoutGrid = document.createElement('div');
        layoutGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; align-items: end;';
        
        const colWrap = document.createElement('div');
        colWrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        const colLabel = document.createElement('label');
        colLabel.className = 'ui-label';
        colLabel.textContent = 'Columns';
        colWrap.appendChild(colLabel);
        const colSpin = window.DuckControls.SpinNumber.create({ 
            value: cols, min: 1, max: maxGrid, step: 1, 
            onChange: (val) => { cols = val; saveState(); } 
        });
        colWrap.appendChild(colSpin.element);
        
        const rowWrap = document.createElement('div');
        rowWrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        const rowLabel = document.createElement('label');
        rowLabel.className = 'ui-label';
        rowLabel.textContent = 'Rows';
        rowWrap.appendChild(rowLabel);
        const rowSpin = window.DuckControls.SpinNumber.create({ 
            value: rows, min: 1, max: maxGrid, step: 1, 
            onChange: (val) => { rows = val; saveState(); } 
        });
        rowWrap.appendChild(rowSpin.element);
        
        const gapWrap = document.createElement('div');
        gapWrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        const gapLabel = document.createElement('label');
        gapLabel.className = 'ui-label';
        gapLabel.textContent = 'Gap (px)';
        gapWrap.appendChild(gapLabel);
        gapSpin = window.DuckControls.SpinNumber.create({ 
            value: savedState.gap !== undefined ? savedState.gap : 10, min: 0, max: 100, step: 1,
            onChange: saveState
        });
        gapWrap.appendChild(gapSpin.element);
        
        const scaleCbWrap = document.createElement('div');
        scaleCbWrap.style.cssText = 'padding-bottom: 6px;';
        scaleCb = window.DuckControls.Checkbox.create(scaleCbWrap, { 
            label: 'Auto-scale to fit', 
            checked: savedState.autoScale !== undefined ? savedState.autoScale : true,
            onChange: saveState
        });
        
        layoutGrid.appendChild(colWrap);
        layoutGrid.appendChild(rowWrap);
        layoutGrid.appendChild(gapWrap);
        layoutGrid.appendChild(scaleCbWrap);
        
        gridSettingsWrap.appendChild(layoutGrid);
        
        layoutSection.appendChild(gridSettingsWrap);
        rightCol.appendChild(layoutSection);
        
        modalBody.appendChild(rightCol);

        // --- Footer ---
        const footerWrap = document.createElement('div');
        footerWrap.style.cssText = 'display:flex; justify-content:flex-end; gap:12px; width:100%;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'duck-btn duck-btn-surface';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this._modal && this._modal.close());
        
        let isSyncing = false;
        const startBtn = document.createElement('button');
        startBtn.className = 'duck-btn duck-btn-primary';
        startBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">play_arrow</span> Start Sync';
        startBtn.addEventListener('click', () => {
            isSyncing = !isSyncing;
            if (isSyncing) {
                startBtn.classList.remove('duck-btn-primary');
                startBtn.classList.add('duck-btn-danger'); // Assuming danger class exists for red, else we can use inline style or just change text
                startBtn.style.background = 'var(--danger, #dc3545)';
                startBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">stop</span> Stop Sync';
                console.log(`Starting Sync: Layout ${cols}x${rows}`);
            } else {
                startBtn.classList.add('duck-btn-primary');
                startBtn.classList.remove('duck-btn-danger');
                startBtn.style.background = '';
                startBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">play_arrow</span> Start Sync';
                console.log('Stopping Sync');
            }
        });
        
        footerWrap.appendChild(cancelBtn);
        footerWrap.appendChild(startBtn);

        this._modal = window.DuckControls.Modal.create({
            title: 'Synchronize Actions',
            subtitle: 'Arrange windows and synchronize mouse/keyboard events across multiple profiles.',
            icon: 'sync',
            content: modalBody,
            footer: footerWrap,
            size: 'lg', // Spacious but clean
            closeOnOverlay: false,
            onClose: () => { this._modal = null; }
        });

        const modalContainer = this._modal.container;
        if (modalContainer) {
            modalContainer.style.maxWidth = '1000px';
            modalContainer.style.width = '90vw';
        }

        this._modal.open();
    }
};
