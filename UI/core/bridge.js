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

        /** Add middleware that runs before resolve/reject */
        use(fn) { this._pushHandlers['middleware'] = fn; },

        /** Auto-detect WebView2 and set up message routing. */
        init() {
            if (window.chrome && window.chrome.webview) {
                this._webViewReady = true;

                window.chrome.webview.addEventListener('message', (e) => {
                    if (e.data) window.__duckReceive(e.data);
                });

                window.__duckReceive = (payload) => {
                    try {
                        if (typeof payload === 'string') {
                            payload = JSON.parse(payload);
                        }
                    } catch (e) {
                        return;
                    }
                    this._receive(payload);
                };
            } else {
                this._webViewReady = false;
                window.__duckReceive = () => {};
            }
        },

        /**
         * Send a request to C# and return a Promise.
         * @param {string} action - The action name
         * @param {object|null} payload - The payload
         * @param {object} options - Optional settings { signal: AbortSignal }
         */
        async call(action, payload = null, options = null) {
            if (!this._webViewReady) {
                return this._mockCall(action, payload);
            }

            const id = ++this._callbackId;
            const envelope = { type: 'request', id, action, payload };

            return new Promise((resolve, reject) => {
                this._callbacks[id] = { resolve, reject };

                // Handle abort signal
                if (options?.signal) {
                    const abortHandler = () => {
                        delete this._callbacks[id];
                        reject(new DOMException('Aborted', 'AbortError'));
                    };
                    if (options.signal.aborted) {
                        abortHandler();
                        return;
                    }
                    options.signal.addEventListener('abort', abortHandler, { once: true });
                }

                try {
                    window.chrome.webview.postMessage(envelope);
                } catch (err) {
                    delete this._callbacks[id];
                    reject(new Error(`WebView send failed: ${err.message}`));
                    return;
                }

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
         */
        _receive(payload) {
            try {
                if (!payload || typeof payload !== 'object') return;

                if (payload.type === 'response') {
                    const { id, success, error, data } = payload;
                    const cb = this._callbacks[id];
                    if (!cb) {
                        return;
                    }

                    delete this._callbacks[id];

                    if ((success === undefined || success === true) && !error) {
                        console.log('[DuckBridge] ProfileData FOUND in response, length:', data?.ProfileData?.length);
                        console.log('[DuckBridge] Full response keys:', Object.keys(data || {}));
                        console.log('[DuckBridge] Response data:', JSON.stringify(data, null, 2));
                        cb.resolve(data || null);
                    } else {
                        const errMsg = (error === null || error === undefined || error === 'null' || error === '') ? 'Unknown error' : String(error);
                        const err = new Error(errMsg);
                        const fieldMatch = (error || '').match(/^\[([^\]]+)\]\s*(.*)/);
                        if (fieldMatch) {
                            err._field = fieldMatch[1];
                            err._message = fieldMatch[2];
                        }
                        cb.reject(err);
                    }
                    return;
                }

                if (payload.type === 'push') {
                    const { channel, payload: p } = payload;

                    if (channel === 'toast' && p) {
                        if (window.Toast) {
                            window.Toast.push(p);
                        }
                    }

                    if (channel === 'profile.status' && p) {
                        this._handleProfileStatus(p);
                    }

                    if (channel === 'profile.message' && p) {
                        this._handleProfileMessage(p);
                    }

                    const handler = this._pushHandlers[channel];
                    if (handler) {
                        try { handler(p); } catch (e) { }
                    }
                    return;
                }

                if (payload.id && payload.action && !payload.type) {
                    if (payload.success !== undefined || payload.error !== undefined) {
                        this._receive({ type: 'response', ...payload });
                    }
                }
            } catch (e) { }
        },

        _handleProfileStatus(payload) {
            if (!payload) return;

            var profileId = payload.profileId || payload.ProfileId;
            var status = payload.status || payload.Status || '';
            var message = payload.message || payload.Message || '';

            window.dispatchEvent(new CustomEvent('profile-status-update', {
                detail: { profileId: profileId, status: status, message: message }
            }));

            const handler = this._pushHandlers['profile.status'];
            if (handler) {
                try { handler(payload); } catch (e) { }
            }
        },

        _handleProfileMessage(payload) {
            if (!payload) return;

            var profileId = payload.profileId || payload.ProfileId;
            var message = payload.message || payload.Message || '';

            window.dispatchEvent(new CustomEvent('profile-message-update', {
                detail: { profileId: profileId, message: message }
            }));

            const handler = this._pushHandlers['profile.message'];
            if (handler) {
                try { handler(payload); } catch (e) { }
            }
        },

        /**
         * Subscribe to a server-initiated push channel.
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
         * Push a message to C# (fire-and-forget).
         */
        push(channel, payload = null) {
            if (!this._webViewReady) return;
            const envelope = { type: 'push', channel, payload };
            try {
                window.chrome.webview.postMessage(envelope);
            } catch (_) {}
        },

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
                                { BrowserType: 'chromium', Versions: [{ Version: '150.0.7849.0', Description: 'Chromium 150' }] },
                                { BrowserType: 'firefox', Versions: [{ Version: '121.0', Description: 'Firefox 121' }] },
                                { BrowserType: 'edge', Versions: [{ Version: '120.0.2210.91', Description: 'Edge 120' }] }
                            ]
                        });
                    } else if (action === 'profile.getCatalog') {
                        resolve({
                            browsers: [
                                { type: 'chromium', name: 'Chromium', defaultVersion: '150.0.7849.0' },
                                { type: 'firefox', name: 'Firefox', defaultVersion: '121.0' },
                                { type: 'edge', name: 'Edge', defaultVersion: '120.0.2210.91' }
                            ],
                            platforms: [
                                { osKey: 'Windows', displayName: 'Windows', platformString: 'Win32', bitness: '64' },
                                { osKey: 'macOS', displayName: 'macOS', platformString: 'Darwin', bitness: '64' },
                                { osKey: 'Linux', displayName: 'Linux', platformString: 'Linux', bitness: '64' }
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
