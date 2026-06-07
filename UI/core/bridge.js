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
        _middleware: [],

        /** Add middleware that runs before resolve/reject */
        use(fn) { this._middleware.push(fn); },

        /** Auto-detect WebView2 and set up message routing. */
        init() {
            if (window.chrome && window.chrome.webview) {
                this._webViewReady = true;

                // Route ALL incoming C# messages through one entry point
                window.chrome.webview.addEventListener('message', (e) => {
                    if (e.data) window.__duckReceive(e.data);
                });

                // Fallback for ExecuteScript bridge — auto-parse JSON string from C#
                window.__duckReceive = (payload) => {
                    try {
                        if (typeof payload === 'string') {
                            payload = JSON.parse(payload);
                        }
                    } catch (e) {
                        console.warn('[DuckBridge] Failed to parse __duckReceive payload:', e);
                        return;
                    }
                    this._receive(payload);
                };

                console.log('[DuckBridge] WebView2 mode — unified protocol active');
            } else {
                this._webViewReady = false;
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
            if (!this._webViewReady) {
                return this._mockCall(action, payload);
            }

            const id = ++this._callbackId;
            const envelope = { type: 'request', id, action, payload };
            console.log(`[DuckBridge] → ${action}`, payload);

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
            try {
                if (!payload || typeof payload !== 'object') return;

                // ── Response ───────────────────────────────────────────────
                if (payload.type === 'response') {
                    try {
                        const { id, success, error, data, toast } = payload;

                        const cb = this._callbacks[id];
                        if (!cb) {
                            console.warn(`[DuckBridge] Response for unknown id=${id}`);
                            return;
                        }

                        delete this._callbacks[id];

                        // Apply middleware (before resolve/reject)
                        let finalData = data;
                        let finalError = error;
                        for (const mw of this._middleware) {
                            const result = mw(id, { success, error, data }, 'response');
                            if (result) {
                                if (result.data !== undefined) finalData = result.data;
                                if (result.error !== undefined) finalError = result.error;
                            }
                        }

                        // NOTE: Toast handling is delegated to individual components via error rejection.
                        // Do NOT auto-show toasts here - middleware or component-level code handles UI feedback.

                        if ((success === undefined || success === true) && !finalError) {
                            console.log(`[DuckBridge] ✓ id=${id} resolved`, finalData);
                            cb.resolve(finalData ?? null);
                        } else {
                            const errMsg = (finalError === null || finalError === undefined || finalError === 'null' || finalError === '') ? 'Unknown error' : String(finalError);
                            const err = new Error(errMsg);
                            const fieldMatch = (finalError || '').match(/^\[([^\]]+)\]\s*(.*)/);
                            if (fieldMatch) {
                                err._field = fieldMatch[1];
                                err._message = fieldMatch[2];
                            }
                            console.error(`[DuckBridge] ✗ id=${id} rejected:`, errMsg);
                            cb.reject(err);
                        }
                    } catch (parseErr) {
                        console.warn('[DuckBridge] Response parse error:', parseErr);
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
                if (payload.id && payload.action && !payload.type) {
                    if (payload.success !== undefined || payload.error !== undefined) {
                        this._receive({ type: 'response', ...payload });
                    }
                }
            } catch (e) {
                console.warn('[DuckBridge] _receive error (malformed WebView message):', e);
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

        /**
         * Push a message to C# (fire-and-forget, no response expected).
         * Useful for server-initiated events that don't need acknowledgment.
         *
         * @param {string} channel
         * @param {object} payload
         */
        push(channel, payload = null) {
            if (!this._webViewReady) return;
            const envelope = { type: 'push', channel, payload };
            try {
                window.chrome.webview.postMessage(envelope);
            } catch (_) {}
        },

        // ─── Mock handlers for dev mode (no WebView2) ─────────────────────

        _mockCall(action, payload) {
            const delay = 50 + Math.random() * 150;
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (action === 'group.list' || action === 'tag.list') {
                        resolve([]);
                    } else if (action === 'profile.list') {
                        resolve({ Items: [], Total: 0 });
                    } else if (action === 'profile.get') {
                        resolve(null);
                    } else if (action === 'profile.getFingerprintTemplate') {
                        resolve({
                            Timezones: ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'],
                            Languages: ['en-US', 'en-GB', 'zh-CN', 'ja-JP'],
                            OS: {
                                'Windows': {
                                    Models: [{ Name: 'Windows 10', PlatformString: 'Win64' }],
                                    Fonts: ['Arial', 'Segoe UI'],
                                    ScreenPresets: [{ Width: 1920, Height: 1080, PixelRatio: 1 }],
                                    HardwareTiers: [{ Concurrency: 8, Memory: 16 }]
                                }
                            },
                            TimezoneGeo: {}
                        });
                    } else if (action === 'browser.listVersions') {
                        resolve({
                            Browsers: [
                                { BrowserType: 'chrome', Versions: [{ Version: '120.0', Description: 'Chrome 120' }] },
                                { BrowserType: 'firefox', Versions: [{ Version: '121.0', Description: 'Firefox 121' }] }
                            ]
                        });
                    } else {
                        resolve(null);
                    }
                }, delay);
            });
        }
    };
})();
