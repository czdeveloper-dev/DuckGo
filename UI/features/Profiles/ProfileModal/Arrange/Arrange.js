window.ProfileModals = window.ProfileModals || {};

window.ProfileModals.Arrange = {
    _modal: null,

    show(selectedIds) {
        if (this._modal) {
            this._modal.destroy();
            this._modal = null;
        }

        if (!selectedIds || selectedIds.size === 0) {
            return;
        }

        // State tracking
        const savedStateJson = localStorage.getItem('duck_arrange_state');
        let savedState = {};
        if (savedStateJson) {
            try { savedState = JSON.parse(savedStateJson); } catch (e) {}
        }
        
        let cols = savedState.cols !== undefined ? savedState.cols : 2;
        let rows = savedState.rows !== undefined ? savedState.rows : 2;

        const saveState = () => {
            const state = {
                monitor: monitorCombo ? monitorCombo.element.querySelector('.duck-combobox-select').textContent === 'Secondary Monitor' ? '2' : '1' : '1',
                layoutMode: modeRadio.getValue(),
                cols: cols,
                rows: rows,
                autoScale: scaleCb.isChecked(),
                gap: gapSpin.getValue()
            };
            localStorage.setItem('duck_arrange_state', JSON.stringify(state));
        };

        const modalBody = document.createElement('div');
        modalBody.style.cssText = 'display:flex; flex-direction:column; gap:12px; padding-top: 8px;';

        const genSection = document.createElement('div');
        genSection.style.cssText = 'display:flex; flex-direction:column; gap:12px;';

        let currentMonitor = savedState.monitor || '1';
        const monitorCombo = window.DuckControls.ComboBox.create({
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
        genSection.appendChild(monitorCombo.element);
        
        modalBody.appendChild(genSection);

        const div1 = document.createElement('div');
        div1.style.cssText = 'height: 1px; background: var(--border-default);';
        modalBody.appendChild(div1);

        const layoutSection = document.createElement('div');
        layoutSection.style.cssText = 'display:flex; flex-direction:column; gap:12px;';
        
        const modeWrap = document.createElement('div');
        modeWrap.style.alignSelf = 'flex-start';
        const modeLabel = document.createElement('div');
        modeLabel.className = 'ui-label';
        modeLabel.textContent = 'Layout Mode';
        modeLabel.style.marginBottom = '6px';
        modeWrap.appendChild(modeLabel);
        
        const modeRadio = window.DuckControls.ChipSelect.create({
            name: 'arrangeMode',
            options: [
                { label: 'Auto Split', value: 'auto' },
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
        gridSettingsWrap.style.cssText = 'display:flex; flex-direction:column; gap:10px; transition: all 0.3s ease;';
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
            value: cols, min: 1, max: 10, step: 1, 
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
            value: rows, min: 1, max: 10, step: 1, 
            onChange: (val) => { rows = val; saveState(); } 
        });
        rowWrap.appendChild(rowSpin.element);
        
        const gapWrap = document.createElement('div');
        gapWrap.style.cssText = 'display:flex; flex-direction:column; gap:4px;';
        const gapLabel = document.createElement('label');
        gapLabel.className = 'ui-label';
        gapLabel.textContent = 'Gap (px)';
        gapWrap.appendChild(gapLabel);
        const gapSpin = window.DuckControls.SpinNumber.create({ 
            value: savedState.gap !== undefined ? savedState.gap : 10, min: 0, max: 100, step: 1,
            onChange: (v) => { saveState(); }
        });
        gapWrap.appendChild(gapSpin.element);
        
        const scaleCbWrap = document.createElement('div');
        scaleCbWrap.style.cssText = 'padding-bottom: 6px;';
        const scaleCb = window.DuckControls.Checkbox.create(scaleCbWrap, { 
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
        modalBody.appendChild(layoutSection);

        // Footer buttons
        const footerWrap = document.createElement('div');
        footerWrap.style.cssText = 'display:flex; justify-content:flex-end; gap:12px; width:100%;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'duck-btn duck-btn-surface';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this._modal && this._modal.close());
        
        const arrangeBtn = document.createElement('button');
        arrangeBtn.className = 'duck-btn duck-btn-primary';
        arrangeBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px; margin-right: 4px;">grid_view</span> Arrange Windows';
        arrangeBtn.addEventListener('click', () => {
            console.log('Arrange Windows initiated with config:', {
                monitor: currentMonitor,
                layoutMode: modeRadio.getValue(),
                cols, rows, gap: gapSpin.getValue(), autoScale: scaleCb.isChecked()
            });
            if (this._modal) this._modal.close();
        });
        
        footerWrap.appendChild(cancelBtn);
        footerWrap.appendChild(arrangeBtn);

        this._modal = window.DuckControls.Modal.create({
            title: 'Arrange Windows',
            subtitle: 'Arrange selected profiles dynamically across your monitors.',
            icon: 'grid_view',
            content: modalBody,
            footer: footerWrap,
            size: 'sm',
            closeOnOverlay: true,
            onClose: () => { this._modal = null; }
        });

        this._modal.open();
    }
};
