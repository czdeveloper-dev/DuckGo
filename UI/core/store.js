// DuckStore - Simple reactive state management

(function() {
    'use strict';

    window.DuckStore = {
        _state: {},
        _listeners: {},

        /**
         * Get a value from the store.
         */
        get(key) {
            return this._state[key];
        },

        /**
         * Get entire state or a sub-key.
         */
        getState(path) {
            if (!path) return { ...this._state };
            const parts = path.split('.');
            let val = this._state;
            for (const part of parts) {
                if (val == null) return undefined;
                val = val[part];
            }
            return val;
        },

        /**
         * Set a value in the store and notify listeners.
         */
        set(key, value) {
            const old = this._state[key];
            this._state[key] = value;
            this._notify(key, value, old);
        },

        /**
         * Merge multiple values.
         */
        merge(values) {
            for (const [key, value] of Object.entries(values)) {
                this.set(key, value);
            }
        },

        /**
         * Subscribe to changes on a key.
         * @param {string} key
         * @param {function} listener - (newValue, oldValue) => void
         * @returns {function} unsubscribe
         */
        subscribe(key, listener) {
            if (!this._listeners[key]) this._listeners[key] = [];
            this._listeners[key].push(listener);
            return () => {
                this._listeners[key] = this._listeners[key].filter(l => l !== listener);
            };
        },

        _notify(key, newValue, oldValue) {
            const listeners = this._listeners[key] || [];
            for (const l of listeners) {
                try { l(newValue, oldValue); } catch (e) { console.error('[DuckStore]', e); }
            }
        },

        /**
         * Clear entire state.
         */
        reset() {
            this._state = {};
            this._listeners = {};
        }
    };
})();
