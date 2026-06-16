// FieldValidator.js - Centralized field validation utility
// Maps field names to control instances and shows inline error labels.
//
// Usage:
//   const validator = new FieldValidator();
//   validator.register('name', nameInput);        // control must have setError/clearError
//   validator.register('proxyHost', proxyInput);
//
//   // Validate with local errors:
//   if (!validator.validate({ name: 'Name is required' })) return;
//
//   // Or apply backend validation errors:
//   validator.applyBackendErrors(backendErrorsObject);

(function() {
    'use strict';

    window.FieldValidator = class FieldValidator {
        constructor() {
            this._fields = {}; // fieldName -> control instance
        }

        /**
         * Register a control instance by field name.
         * Control must expose setError(message) and clearError().
         */
        register(name, controlInstance) {
            this._fields[name] = controlInstance;
        }

        /**
         * Show errors on controls.
         * @param {Object} errors - { fieldName: 'error message' }
         * @returns {boolean} true if NO errors, false if errors were shown
         */
        validate(errors = {}) {
            let hasError = false;
            Object.entries(errors).forEach(([field, message]) => {
                const ctrl = this._fields[field];
                if (ctrl && typeof ctrl.setError === 'function') {
                    ctrl.setError(message);
                    hasError = true;
                }
            });
            return !hasError;
        }

        /**
         * Apply backend validation errors.
         * Backend returns { errors: { fieldName: 'message' } } or { fieldErrors: {...} }
         * @param {Object} backendResponse
         * @returns {boolean} true if backend had field errors (and they were displayed)
         */
        applyBackendErrors(backendResponse) {
            if (!backendResponse) return false;
            const errors = backendResponse.errors || backendResponse.fieldErrors || backendResponse.fieldError;
            if (!errors || typeof errors !== 'object') return false;
            const hadErrors = Object.keys(errors).length > 0;
            this.validate(errors);
            return hadErrors;
        }

        /** Clear specific field error */
        clear(name) {
            const ctrl = this._fields[name];
            if (ctrl && typeof ctrl.clearError === 'function') ctrl.clearError();
        }

        /** Clear all registered field errors */
        clearAll() {
            Object.values(this._fields).forEach(ctrl => {
                if (ctrl && typeof ctrl.clearError === 'function') ctrl.clearError();
            });
        }

        /** Remove all registrations and clear errors */
        destroy() {
            this.clearAll();
            this._fields = {};
        }
    };
})();
