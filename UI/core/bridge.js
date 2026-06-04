/**
 * DuckBridge — Unified JS ↔ C# communication layer (WebView2)
 *
 * Protocol:
 *   JS  → C#   { type: "request", id, action, payload }
 *   C#  → JS   { type: "response", id, success, error, data }
 *   C#  → JS   { type: "push", channel, payload }   (server-initiated, no id)
 *
 * Usage:
 *   const data = await DuckBridge.call('group.list');
 *   const data = await DuckBridge.call('tag.create', { name: 'VIP' });
 *   const data = await DuckBridge.call('profile.list', { groupId: 1 });
 *
 * Push subscriptions:
 *   DuckBridge.on('profile.changed', (payload) => { ... });
 */
(function () {
    'use strict';

    window.DuckBridge = {
        _callbacks: {},
        _callbackId: 0,
        _webViewReady: false,
        _pushHandlers: {},

        /** Auto-detect WebView2 and set up message routing. */
        init() {
            if (window.chrome && window.chrome.webview) {
                this._webViewReady = true;

                // Route ALL incoming C# messages through one entry point
                window.chrome.webview.addEventListener('message', (e) => {
                    if (e.data) window.__duckReceive(e.data);
                });

                // Fallback for ExecuteScript bridge (if C# uses ExecuteScriptAsync directly)
                window.__duckReceive = (payload) => this._receive(payload);

                console.log('[DuckBridge] WebView2 mode — unified protocol active');
            } else {
                this._webViewReady = false;
                // Provide a no-op receiver for dev without backend
                window.__duckReceive = () => {};
                console.log('[DuckBridge] Mock mode — UI dev without backend');
            }
        },

        /**
         * Send a request to C# and return a Promise.
         *
         * @param {string} action   "entity.verb"   e.g. "group.list", "tag.create"
         * @param {object|null} payload  request payload
         * @returns {Promise<any>}  resolves with response `data`, rejects on error
         */
        async call(action, payload = null) {
            // Mock mode: delegate to built-in mock handler
            if (!this._webViewReady) {
                return this._mockCall(action, payload);
            }

            const id = ++this._callbackId;
            const envelope = { type: 'request', id, action, payload };

            return new Promise((resolve, reject) => {
                this._callbacks[id] = { resolve, reject };

                try {
                    window.chrome.webview.postMessage(envelope);
                } catch (err) {
                    delete this._callbacks[id];
                    reject(new Error(`WebView send failed: ${err.message}`));
                    return;
                }

                // 30-second request timeout
                setTimeout(() => {
                    if (this._callbacks[id]) {
                        delete this._callbacks[id];
                        reject(new Error(`Timeout (30s) for: ${action}`));
                    }
                }, 30000);
            });
        },

        /**
         * Receive and dispatch a message from C#.
         * Called by window.__duckReceive (wired in init()).
         *
         * @param {object} payload
         */
        _receive(payload) {
            if (!payload || typeof payload !== 'object') return;

            // ── Response ───────────────────────────────────────────────
            if (payload.type === 'response') {
                const { id, success, error, data } = payload;
                const cb = this._callbacks[id];
                if (!cb) return;

                delete this._callbacks[id];
                if (success !== false && !error) {
                    cb.resolve(data);
                } else {
                    cb.reject(new Error(error || 'Unknown error'));
                }
                return;
            }

            // ── Push / Server-initiated ────────────────────────────────
            if (payload.type === 'push') {
                const { channel, payload: p } = payload;
                const handler = this._pushHandlers[channel];
                if (handler) {
                    try { handler(p); } catch (e) { console.error(`[DuckBridge] Push handler error (${channel}):`, e); }
                }
                return;
            }

            // Legacy flat { id, action, data } (backward compat with old bridge calls)
            // When C# dispatcher is configured to use resolve() directly
            if (payload.id && payload.action && !payload.type) {
                // Try to route as response using a synthetic id from legacy format
                // The old bridge calls resolve({ id, success, error, data })
                // which maps directly to our response format
                if (payload.success !== undefined || payload.error !== undefined) {
                    this._receive({ type: 'response', ...payload });
                }
            }
        },

        /**
         * Subscribe to a server-initiated push channel.
         *
         * @param {string}   channel   "entity.changed"  e.g. "profile.changed"
         * @param {function}  handler   called with the payload
         */
        on(channel, handler) {
            this._pushHandlers[channel] = handler;
        },

        /**
         * Unsubscribe from a push channel.
         */
        off(channel) {
            delete this._pushHandlers[channel];
        },

        // ── Mock layer for development without a running app ───────────────

        async _mockCall(action, payload) {
            const delay = (ms = 60) => new Promise(r => setTimeout(r, ms));

            await delay();

            // Helper to create mock entity items
            const mockItem = (overrides) => ({ id: Date.now(), createdAt: new Date().toISOString(), ...overrides });

            switch (action) {
                // Group
                case 'group.list':
                    return [
                        { Id: 1, Name: 'Marketing Team', CreatedAt: '2026-01-01T00:00:00Z' },
                        { Id: 2, Name: 'Dev Accounts',  CreatedAt: '2026-01-02T00:00:00Z' },
                    ];
                case 'group.create':
                    return mockItem({ Id: Date.now(), Name: payload?.name || 'New Group' });
                case 'group.update':
                    return null;
                case 'group.delete':
                    return null;

                // Tag
                case 'tag.list':
                    return [
                        { Id: 1, Name: 'VIP',    CreatedAt: '2026-01-01T00:00:00Z' },
                        { Id: 2, Name: 'Test',   CreatedAt: '2026-01-02T00:00:00Z' },
                        { Id: 3, Name: 'Blocked', CreatedAt: '2026-01-03T00:00:00Z' },
                    ];
                case 'tag.create':
                    return mockItem({ Id: Date.now(), Name: payload?.name || 'New Tag' });
                case 'tag.delete':
                    return null;

                // Profile
                case 'profile.list':
                    return {
                        Items: [
                            mockItem({ Id: 101, Name: 'Google Account Farm - 01', GroupId: 1, BrowserType: 'Chromium' }),
                            mockItem({ Id: 102, Name: 'Facebook Ads Manager - 02', GroupId: 2, BrowserType: 'Firefox' }),
                        ],
                        Total: 2
                    };
                case 'profile.get':
                    return mockItem({ Id: payload?.id || 1, Name: 'Profile', BrowserType: 'Chromium' });
                case 'profile.create':
                    return mockItem({ Id: Date.now(), Name: payload?.name || 'New Profile' });
                case 'profile.update':
                    return mockItem({ Id: payload?.id || 1, ...payload });
                case 'profile.delete':
                    return null;
                case 'profile.duplicate':
                    return mockItem({ Id: Date.now(), Name: `${payload?.name || 'Profile'} (Copy)` });

                // Proxy
                case 'proxy.list':
                    return [];
                case 'proxy.create':
                    return mockItem({ Id: Date.now(), Name: payload?.name || 'New Proxy' });
                case 'proxy.update':
                    return null;
                case 'proxy.delete':
                    return null;

                default:
                    console.warn(`[DuckBridge] No mock for "${action}"`);
                    return null;
            }
        }
    };

    // Auto-initialize
    window.DuckBridge.init();

    // ── Legacy alias for backward compatibility with existing code ──────────
    // Old code references _duckBridge.call(); keep it working.
    window._duckBridge = {
        call: (action, data) => window.DuckBridge.call(action, data),
        on:   (channel, handler) => window.DuckBridge.on(channel, handler),
        off:  (channel) => window.DuckBridge.off(channel)
    };
})();
