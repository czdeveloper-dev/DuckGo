// DuckBridge - JS/C# communication via WebView2 WebMessageReceived

(function() {
    'use strict';

    window._duckBridge = {
        _callbacks: {},
        _callbackId: 0,
        _webViewAvailable: false,

        /**
         * Initialize bridge.
         */
        init() {
            // Disable WebView2 for now - use mock mode for UI development
            this._webViewAvailable = false;
            console.log('[DuckBridge] Using mock mode (WebView2 disabled)');
        },

        /**
         * Call a backend action and return a Promise.
         * @param {string} action - e.g. "profile.list"
         * @param {object|null} data - payload
         * @returns {Promise<object>}
         */
        async call(action, data = null) {
            if (!this._webViewAvailable) {
                // Mock mode for development/testing
                return this._mockResponse(action);
            }

            const id = ++this._callbackId;
            const payload = { id, action, data };

            return new Promise((resolve, reject) => {
                this._callbacks[id] = { resolve, reject };

                try {
                    window.chrome.webview.postMessage(payload);
                } catch (e) {
                    delete this._callbacks[id];
                    reject(new Error(`Failed to send: ${e.message}`));
                    return;
                }

                // Timeout after 30s
                setTimeout(() => {
                    if (this._callbacks[id]) {
                        delete this._callbacks[id];
                        reject(new Error(`Timeout: ${action}`));
                    }
                }, 30000);
            });
        },

        /**
         * Internal: resolve/reject a pending call from C#.
         * Called by C# via ExecuteScript.
         */
        resolve(responseJson) {
            try {
                const response = typeof responseJson === 'string' ? JSON.parse(responseJson) : responseJson;
                if (response.id && this._callbacks[response.id]) {
                    const { resolve, reject } = this._callbacks[response.id];
                    delete this._callbacks[response.id];
                    if (response.success !== false && !response.error) {
                        resolve(response.data);
                    } else {
                        reject(new Error(response.error || 'Unknown error'));
                    }
                }
            } catch (e) {
                console.error('[DuckBridge] resolve error:', e);
            }
        },

        /**
         * Push a status update from C# to JS (for real-time profile status changes).
         */
        onStatusUpdate(handler) {
            this._statusHandler = handler;
        },

        _handlePush(data) {
            if (data.type === 'status-update' && this._statusHandler) {
                this._statusHandler(data.profileId, data.status);
            }
        },

        /**
         * Mock response for development/testing.
         */
        _mockResponse(action) {
            // Return mock data matching real API structure
            const mockData = {
                'profile.list': { success: true, data: { items: [], total: 0 } },
                'group.list': { success: true, data: [] },
                'tag.list': { success: true, data: [] }
            };
            const response = mockData[action] || { success: true, data: null };
            return Promise.resolve(response);
        }
    };

    // Auto-initialize
    _duckBridge.init();
})();
