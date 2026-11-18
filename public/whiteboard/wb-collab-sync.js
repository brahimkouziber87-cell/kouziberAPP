/**
 * ============================================================================
 * محرك المزامنة اللحظية والتعاون المباشر للسبورة التفاعلية
 * Real-Time Multi-Tab (BroadcastChannel) & Multi-Device (WebSocket) Sync
 * ============================================================================
 */
(function (window) {
    'use strict';

    class WhiteboardCollabClient {
        constructor(options) {
            this.clientId = 'cli_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
            this.roomCode = '';
            this.role = 'teacher';
            this.displayName = 'الأستاذ';
            this.ws = null;
            this.bc = null;
            this.reconnectTimer = null;
            this.reconnectAttempt = 0;
            this.seenEventIds = [];
            this.seenSet = new Set();
            this.pendingQueue = [];
            this.peerCount = 1;
            this.isConnected = false;
            this.onEvent = (options && options.onEvent) || function () {};
            this.onStatus = (options && options.onStatus) || function () {};
        }

        _markSeen(eventId) {
            if (!eventId) return true;
            if (this.seenSet.has(eventId)) return false;
            this.seenSet.add(eventId);
            this.seenEventIds.push(eventId);
            if (this.seenEventIds.length > 400) {
                const old = this.seenEventIds.shift();
                this.seenSet.delete(old);
            }
            return true;
        }

        connect(roomCode, role, displayName, initialSnapshotFn) {
            const cleanRoom = (window.WbSecurityMath && window.WbSecurityMath.sanitizeRoomCode(roomCode)) || String(roomCode || 'MATH-BAC-2026');
            this.roomCode = cleanRoom;
            this.role = role === 'student' ? 'student' : 'teacher';
            this.displayName = String(displayName || (this.role === 'teacher' ? 'الأستاذ' : 'التلميذ')).slice(0, 60);
            this._initialSnapshotFn = initialSnapshotFn;

            this._setupBroadcastChannel();
            this._connectWebSocket();
        }

        _setupBroadcastChannel() {
            if (this.bc) {
                try { this.bc.close(); } catch (e) {}
                this.bc = null;
            }
            try {
                if (window.BroadcastChannel) {
                    this.bc = new BroadcastChannel('math_whiteboard_collab_' + this.roomCode);
                    this.bc.onmessage = (ev) => {
                        const msg = ev && ev.data;
                        if (!msg || msg.senderId === this.clientId) return;
                        if (msg.eventId && !this._markSeen(msg.eventId)) return;
                        this.onEvent(msg);
                    };
                }
            } catch (e) {}
        }

        _connectWebSocket() {
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            if (this.ws) {
                try { this.ws.close(); } catch (e) {}
                this.ws = null;
            }
            if (!window.WebSocket) {
                this._emitStatus(false, 'local-tab-only');
                return;
            }
            try {
                const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${proto}//${window.location.host}/ws/whiteboard?room=${encodeURIComponent(this.roomCode)}`;
                const ws = new WebSocket(wsUrl);
                this.ws = ws;

                ws.onopen = () => {
                    this.isConnected = true;
                    this.reconnectAttempt = 0;
                    const joinPayload = {
                        type: 'join',
                        roomCode: this.roomCode,
                        role: this.role,
                        displayName: this.displayName,
                        senderId: this.clientId,
                        eventId: 'join_' + this.clientId + '_' + Date.now()
                    };
                    if (this.role === 'teacher' && typeof this._initialSnapshotFn === 'function') {
                        joinPayload.snapshot = this._initialSnapshotFn();
                    }
                    ws.send(JSON.stringify(joinPayload));
                    while (this.pendingQueue.length > 0) {
                        const qMsg = this.pendingQueue.shift();
                        try { ws.send(JSON.stringify(qMsg)); } catch (e) {}
                    }
                    this._emitStatus(true, 'ws-live');
                };

                ws.onmessage = (ev) => {
                    try {
                        const msg = JSON.parse(ev.data);
                        if (!msg) return;
                        if (msg.type === 'room:presence') {
                            this.peerCount = Number(msg.peerCount) || 1;
                            this._emitStatus(this.isConnected, 'ws-live');
                            this.onEvent(msg);
                            return;
                        }
                        if (msg.senderId === this.clientId) return;
                        if (msg.eventId && !this._markSeen(msg.eventId)) return;
                        this.onEvent(msg);
                    } catch (e) {}
                };

                ws.onclose = () => {
                    this.isConnected = false;
                    this._emitStatus(false, 'reconnecting');
                    if (this.roomCode) {
                        const delay = Math.min(12000, 1000 * Math.pow(1.6, this.reconnectAttempt++));
                        this.reconnectTimer = setTimeout(() => {
                            if (this.roomCode) this._connectWebSocket();
                        }, delay);
                    }
                };

                ws.onerror = () => {
                    this.isConnected = false;
                };
            } catch (e) {
                this.isConnected = false;
                this._emitStatus(false, 'local-tab-only');
            }
        }

        _emitStatus(connected, mode) {
            this.onStatus({
                connected,
                mode,
                roomCode: this.roomCode,
                peerCount: this.peerCount
            });
        }

        send(type, payload) {
            if (!this.roomCode) return;
            const msg = Object.assign({
                type,
                roomCode: this.roomCode,
                senderId: this.clientId,
                senderRole: this.role,
                senderName: this.displayName,
                eventId: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
                ts: Date.now()
            }, payload || {});
            this._markSeen(msg.eventId);

            if (this.bc) {
                try { this.bc.postMessage(msg); } catch (e) {}
            }
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                try { this.ws.send(JSON.stringify(msg)); } catch (e) {}
            } else if (type !== 'cursor:move') {
                if (this.pendingQueue.length < 40) this.pendingQueue.push(msg);
            }
        }

        disconnect() {
            this.roomCode = '';
            this.isConnected = false;
            this.peerCount = 1;
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            if (this.bc) {
                try { this.bc.close(); } catch (e) {}
                this.bc = null;
            }
            if (this.ws) {
                try { this.ws.close(); } catch (e) {}
                this.ws = null;
            }
            this._emitStatus(false, 'disconnected');
        }
    }

    window.WbCollabSync = {
        WhiteboardCollabClient
    };
})(window);
