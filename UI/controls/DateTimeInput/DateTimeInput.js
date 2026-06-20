window.DuckControls = window.DuckControls || {};

window.DuckControls.DateTimeInput = {
    create(options) {
        // Defaults
        const type = options.type || 'date'; // 'date' | 'time'
        const formatStr = options.format || (type === 'date' ? 'DD/MM/YYYY' : 'HH:MM');
        
        const baseOptions = { ...options };
        if (!baseOptions.placeholder) {
            baseOptions.placeholder = formatStr;
        }

        const inputCtrl = DuckControls.Input.create(baseOptions);
        const inputEl = inputCtrl.input;
        
        const inputWrap = inputCtrl.element.querySelector('.search-box');
        if (inputWrap) inputWrap.classList.add('duck-datetime-input');

        // Extract separators and digit slots from format string
        const parseFormat = (fmt) => {
            const pattern = [];
            const separators = [];
            let pureLength = 0;
            for (let i = 0; i < fmt.length; i++) {
                const char = fmt[i];
                if (char.match(/[a-zA-Z]/)) {
                    pattern.push({ type: 'digit', char: char.toUpperCase() });
                    pureLength++;
                } else {
                    pattern.push({ type: 'sep', char: char });
                    separators.push({ pos: pureLength, char: char });
                }
            }
            return { pattern, separators, pureLength, raw: fmt };
        };

        const maskDef = parseFormat(formatStr);

        const applyMask = (val) => {
            let digits = val.replace(/\D/g, '');
            if (digits.length > maskDef.pureLength) {
                digits = digits.substring(0, maskDef.pureLength);
            }

            let formatted = '';
            let digitIdx = 0;

            for (let i = 0; i < maskDef.pattern.length; i++) {
                if (digitIdx >= digits.length) break;
                
                const p = maskDef.pattern[i];
                if (p.type === 'digit') {
                    formatted += digits[digitIdx];
                    digitIdx++;
                } else if (p.type === 'sep') {
                    formatted += p.char;
                }
            }
            
            for (let s of maskDef.separators) {
                if (digitIdx === s.pos && digitIdx < maskDef.pureLength) {
                    formatted += s.char;
                    break;
                }
            }

            return formatted;
        };

        const enforceRanges = (val) => {
            let formatted = applyMask(val);
            if (!formatted) return formatted;
            
            const sep = type === 'date' ? '/' : ':';
            const parts = formatted.split(sep);

            if (type === 'date') {
                if (formatStr.startsWith('DD/MM')) {
                    // Day
                    if (parts.length > 0) {
                        let d = parseInt(parts[0], 10);
                        if (d > 31 && parts[0].length === 2) parts[0] = '31';
                        if (parts[0].length === 1 && d > 3) parts[0] = '0' + parts[0];
                    }
                    // Month
                    if (parts.length > 1) {
                        let m = parseInt(parts[1], 10);
                        if (m > 12 && parts[1].length === 2) parts[1] = '12';
                        if (parts[1].length === 1 && m > 1) parts[1] = '0' + parts[1];
                    }
                } else if (formatStr.startsWith('MM/DD')) {
                    // Month
                    if (parts.length > 0) {
                        let m = parseInt(parts[0], 10);
                        if (m > 12 && parts[0].length === 2) parts[0] = '12';
                        if (parts[0].length === 1 && m > 1) parts[0] = '0' + parts[0];
                    }
                    // Day
                    if (parts.length > 1) {
                        let d = parseInt(parts[1], 10);
                        if (d > 31 && parts[1].length === 2) parts[1] = '31';
                        if (parts[1].length === 1 && d > 3) parts[1] = '0' + parts[1];
                    }
                }
            } else if (type === 'time') {
                // Hour
                if (parts.length > 0) {
                    let h = parseInt(parts[0], 10);
                    if (h > 23 && parts[0].length === 2) parts[0] = '23';
                    if (parts[0].length === 1 && h > 2) parts[0] = '0' + parts[0];
                }
                // Minute
                if (parts.length > 1) {
                    let m = parseInt(parts[1], 10);
                    if (m > 59 && parts[1].length === 2) parts[1] = '59';
                    if (parts[1].length === 1 && m > 5) parts[1] = '0' + parts[1];
                }
                // Second
                if (parts.length > 2 && formatStr.includes('SS')) {
                    let s = parseInt(parts[2], 10);
                    if (s > 59 && parts[2].length === 2) parts[2] = '59';
                    if (parts[2].length === 1 && s > 5) parts[2] = '0' + parts[2];
                }
            }
            
            return applyMask(parts.join(sep));
        };

        let previousValue = inputEl.value;

        inputEl.addEventListener('input', (e) => {
            let cursor = inputEl.selectionStart;
            let val = inputEl.value;

            // Handle backspace over separator
            if (e.inputType === 'deleteContentBackward') {
                if (previousValue.length > val.length) {
                    const deletedChar = previousValue.charAt(cursor);
                    if (deletedChar === '/' || deletedChar === ':') {
                        val = val.substring(0, cursor - 1) + val.substring(cursor);
                        cursor--;
                    }
                }
            }

            let newVal = enforceRanges(val);
            inputEl.value = newVal;

            if (e.inputType !== 'deleteContentBackward') {
                if (newVal.length > val.length) {
                    cursor += (newVal.length - val.length);
                }
                if (newVal.charAt(cursor) === '/' || newVal.charAt(cursor) === ':') {
                    cursor++;
                }
            }
            
            inputEl.setSelectionRange(cursor, cursor);
            previousValue = newVal;
            
            if (options.onChange) {
                options.onChange({ target: { value: newVal } });
            }
        });
        
        if (inputEl.value) {
            inputEl.value = enforceRanges(inputEl.value);
            previousValue = inputEl.value;
        }

        return {
            ...inputCtrl,
            setValue: (val) => {
                inputEl.value = enforceRanges(val);
                previousValue = inputEl.value;
                inputCtrl.clearError();
            }
        };
    }
};
