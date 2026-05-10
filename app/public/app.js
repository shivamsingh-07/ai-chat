(function () {
    const STORAGE_KEY = "sessionId";

    // DOM elements
    const threadEl = document.getElementById("thread");
    const chatScrollEl = document.getElementById("chatScroll");
    const inputEl = document.getElementById("input");
    const sendBtn = document.getElementById("sendBtn");
    const formEl = document.getElementById("composer");
    const bannerEl = document.getElementById("banner");
    const bannerTextEl = document.getElementById("bannerText");
    const retryBtn = document.getElementById("retryBtn");
    const typingRow = document.getElementById("typingRow");
    const chatScrollAnchor = document.getElementById("chatScrollAnchor");
    const composerShell = document.getElementById("composerShell");
    const newSessionBtn = document.getElementById("newSessionBtn");
    const recentSessionsEl = document.getElementById("recentSessions");

    const SVG_CHECK =
        '<svg class="latency-tick__icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>';
    const SVG_X =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';

    let sessionId = null;
    let busy = false;
    let lastFailedAction = null;
    let lastSendText = "";

    // ── Helpers ──────────────────────────────────────────────────────

    function prefersReducedMotion() {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    function showBanner(message) {
        bannerTextEl.textContent = message;
        bannerEl.removeAttribute("hidden");
    }

    function hideBanner() {
        bannerEl.setAttribute("hidden", "");
        bannerTextEl.textContent = "";
    }

    function createElement(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    // ── Layout sync ─────────────────────────────────────────────────

    function syncChatBottomPad() {
        if (!composerShell || !chatScrollEl) return;
        const chatRect = chatScrollEl.getBoundingClientRect();
        const composerRect = composerShell.getBoundingClientRect();
        const overlap = Math.max(0, chatRect.bottom - composerRect.top);
        chatScrollEl.style.paddingBottom = overlap > 1 ? Math.ceil(overlap + 24) + "px" : "";
    }

    function scrollToBottom(options) {
        const instant = Boolean(options && options.instant);

        syncChatBottomPad();

        if (!instant && !prefersReducedMotion()) {
            requestAnimationFrame(function () {
                syncChatBottomPad();
                requestAnimationFrame(function () {
                    chatScrollEl.scrollTo({ top: chatScrollEl.scrollHeight, behavior: "smooth" });
                });
            });
            return;
        }

        // Instant scroll — ensure it sticks even after layout shifts.
        function snapToBottom() {
            syncChatBottomPad();
            if (chatScrollAnchor && chatScrollAnchor.isConnected) {
                chatScrollAnchor.scrollIntoView({ block: "end", inline: "nearest", behavior: "auto" });
            }
            chatScrollEl.scrollTop = chatScrollEl.scrollHeight;
        }

        snapToBottom();
        queueMicrotask(snapToBottom);
        requestAnimationFrame(function () {
            snapToBottom();
            requestAnimationFrame(function () {
                snapToBottom();
                setTimeout(snapToBottom, 0);
                setTimeout(snapToBottom, 260);
            });
        });
    }

    // ── Textarea auto-resize ────────────────────────────────────────

    function autoResizeTextarea() {
        inputEl.style.height = "auto";
        inputEl.style.height = Math.min(inputEl.scrollHeight, 200) + "px";

        // Toggle multiline class for composer layout
        if (!inputEl.value.trim()) {
            formEl.classList.remove("composer--multiline");
            return;
        }
        const styles = getComputedStyle(inputEl);
        const lineHeight = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize) * 1.45;
        const paddingY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
        const isMultiline = inputEl.scrollHeight > Math.ceil(lineHeight + paddingY) + 1;
        formEl.classList.toggle("composer--multiline", isMultiline);

        syncChatBottomPad();
    }

    // ── Typing indicator ────────────────────────────────────────────

    function setTypingVisible(visible) {
        if (visible) {
            typingRow.removeAttribute("hidden");
            typingRow.setAttribute("aria-hidden", "false");
        } else {
            typingRow.setAttribute("hidden", "");
            typingRow.setAttribute("aria-hidden", "true");
        }
        threadEl.setAttribute("aria-busy", visible ? "true" : "false");
    }

    // ── Message rendering ───────────────────────────────────────────

    async function streamAssistantText(bodyEl, text) {
        if (prefersReducedMotion() || text.length < 64) {
            renderMarkdown(bodyEl, text);
            return;
        }

        bodyEl.textContent = "";
        const words = text.split(/(\s+)/);
        let currentText = "";
        for (let i = 0; i < words.length; i++) {
            currentText += words[i];
            bodyEl.textContent = currentText;
            if (i % 4 === 0) scrollToBottom({ instant: true });
            await new Promise(function (resolve) {
                setTimeout(resolve, 14);
            });
        }
        renderMarkdown(bodyEl, text);
    }

    function renderMarkdown(el, text) {
        if (window.marked && window.DOMPurify) {
            const html = marked.parse(text, { gfm: true, breaks: true });
            el.innerHTML = DOMPurify.sanitize(html);
            if (window.hljs) {
                el.querySelectorAll("pre code").forEach((block) => {
                    hljs.highlightElement(block);
                });
            }
        } else {
            el.textContent = text;
        }
    }

    function appendLatencyTick(rowEl, latencyMs) {
        const tick = document.createElement("button");
        tick.type = "button";
        tick.className = "latency-tick";
        const label = "Latency: " + latencyMs + " ms";
        tick.setAttribute("data-latency", label);
        tick.title = label;
        tick.setAttribute("aria-label", "Response completed in " + latencyMs + " milliseconds");
        tick.innerHTML = SVG_CHECK;
        rowEl.appendChild(tick);
    }

    async function appendMessage(role, content, latencyMs, opts) {
        const stream = opts && opts.stream;
        const scrollInstant = Boolean(opts && opts.scrollInstant);

        const row = createElement("div", "row " + role);
        const bubble = createElement("div", "bubble " + role);
        const body = createElement("div", "bubble__text");
        bubble.appendChild(body);
        row.appendChild(bubble);
        threadEl.appendChild(row);

        if (role === "assistant" && stream) {
            await streamAssistantText(body, content);
        } else {
            renderMarkdown(body, content);
        }

        if (role === "assistant" && typeof latencyMs === "number") {
            appendLatencyTick(row, latencyMs);
        }

        scrollToBottom(scrollInstant ? { instant: true } : undefined);
    }

    // ── Busy state ──────────────────────────────────────────────────

    function setBusy(on) {
        busy = on;
        sendBtn.disabled = on;
        inputEl.disabled = on;
        setTypingVisible(on);
        if (!on) autoResizeTextarea();
        scrollToBottom();
    }

    // ── API calls ───────────────────────────────────────────────────

    async function fetchJson(url, options) {
        const hasBody = options && options.body !== undefined && options.body !== null;
        const res = await fetch(url, {
            ...options,
            headers: {
                ...(hasBody ? { "Content-Type": "application/json" } : {}),
                ...(options && options.headers ? options.headers : {}),
            },
        });

        const text = await res.text();
        let data = null;
        if (text) {
            try { data = JSON.parse(text); } catch { data = null; }
        }

        if (!res.ok) {
            const msg = data && data.error ? data.error : "Request failed (" + res.status + ")";
            const err = new Error(msg);
            err.status = res.status;
            throw err;
        }
        return data;
    }

    async function createSession() {
        const data = await fetchJson("/api/sessions", { method: "POST" });
        if (!data || !data.sessionId) throw new Error("Invalid session response");
        sessionId = data.sessionId;
        localStorage.setItem(STORAGE_KEY, sessionId);
        threadEl.innerHTML = "";
        hideBanner();
        loadRecentSessions().catch(() => {});
    }

    async function loadRecentSessions() {
        if (!recentSessionsEl) return;
        const data = await fetchJson("/api/sessions", { method: "GET" });
        recentSessionsEl.innerHTML = "";
        const sessions = (data && data.sessions) || [];
        
        for (let i = 0; i < sessions.length; i++) {
            const s = sessions[i];
            const li = document.createElement("li");
            li.className = "session-row";
            if (s.sessionId === sessionId) li.classList.add("session-row--active");
            
            const btn = document.createElement("button");
            btn.className = "session-item";
            btn.textContent = s.title || "New chat";
            btn.title = btn.textContent;
            
            btn.addEventListener("click", async () => {
                if (busy || s.sessionId === sessionId) return;
                hideBanner();
                sessionId = s.sessionId;
                localStorage.setItem(STORAGE_KEY, sessionId);
                await runWithRetry(async () => {
                    await loadHistory();
                    await loadRecentSessions();
                }, "Failed to load session");
            });

            const delBtn = document.createElement("button");
            delBtn.className = "session-delete";
            delBtn.innerHTML = SVG_X;
            delBtn.title = "Delete chat";
            
            delBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                if (busy) return;
                if (!confirm("Are you sure you want to delete this chat?")) return;
                
                await runWithRetry(async () => {
                    await fetchJson("/api/sessions/" + encodeURIComponent(s.sessionId), { method: "DELETE" });
                    if (s.sessionId === sessionId) {
                        localStorage.removeItem(STORAGE_KEY);
                        sessionId = null;
                        await bootstrap();
                    } else {
                        await loadRecentSessions();
                    }
                }, "Failed to delete session");
            });
            
            li.appendChild(btn);
            li.appendChild(delBtn);
            recentSessionsEl.appendChild(li);
        }
    }

    async function loadHistory() {
        if (!sessionId) return;
        const data = await fetchJson("/api/sessions/" + encodeURIComponent(sessionId) + "/messages", {
            method: "GET",
        });
        threadEl.innerHTML = "";
        const messages = (data && data.messages) || [];
        for (let i = 0; i < messages.length; i++) {
            const m = messages[i];
            const latency = m.role === "assistant" && typeof m.latencyMs === "number" ? m.latencyMs : null;
            await appendMessage(m.role, m.content, latency, { scrollInstant: true });
        }
        scrollToBottom();
    }

    async function sendMessage(text) {
        if (!sessionId) throw new Error("No active session");
        return fetchJson("/api/sessions/" + encodeURIComponent(sessionId) + "/chat", {
            method: "POST",
            body: JSON.stringify({ message: text }),
        });
    }

    // ── Error-safe action runner (for retry support) ────────────────

    async function runWithRetry(action, fallbackMessage) {
        lastFailedAction = action;
        setBusy(true);
        try {
            await action();
        } catch (e) {
            showBanner(e && e.message ? e.message : fallbackMessage);
        } finally {
            setBusy(false);
            inputEl.focus();
        }
    }

    // ── Bootstrap ───────────────────────────────────────────────────

    async function bootstrap() {
        hideBanner();
        setBusy(true);
        try {
            const existing = localStorage.getItem(STORAGE_KEY);
            if (existing) {
                sessionId = existing;
                try {
                    await loadHistory();
                    await loadRecentSessions();
                    return;
                } catch {
                    localStorage.removeItem(STORAGE_KEY);
                    sessionId = null;
                }
            }
            await createSession();
            await loadHistory();
            await loadRecentSessions();
        } catch (e) {
            lastFailedAction = function () { return bootstrap(); };
            showBanner(e && e.message ? e.message : "Failed to start session");
        } finally {
            setBusy(false);
            inputEl.focus();
        }
    }

    // ── Event handlers ──────────────────────────────────────────────

    formEl.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        if (busy) return;
        const text = (inputEl.value || "").trim();
        if (!text) return;

        hideBanner();
        await appendMessage("user", text, null);
        inputEl.value = "";
        autoResizeTextarea();
        scrollToBottom();
        lastSendText = text;

        async function attemptSend() {
            const data = await sendMessage(lastSendText);
            const latency = typeof data.latencyMs === "number" ? data.latencyMs : null;
            await appendMessage("assistant", data.reply, latency, { stream: true });
            lastSendText = "";
            hideBanner();
            loadRecentSessions().catch(() => {});
        }

        await runWithRetry(attemptSend, "Send failed");
    });

    inputEl.addEventListener("input", autoResizeTextarea);

    inputEl.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            formEl.requestSubmit();
        }
    });

    retryBtn.addEventListener("click", async function () {
        if (!lastFailedAction) return;
        hideBanner();
        await runWithRetry(lastFailedAction, "Retry failed");
    });

    newSessionBtn.addEventListener("click", async function () {
        if (busy) return;
        hideBanner();

        async function startNewSession() {
            localStorage.removeItem(STORAGE_KEY);
            sessionId = null;
            await createSession();
            await loadHistory();
        }

        await runWithRetry(startNewSession, "Failed to create session");
    });

    // ── Resize handling ─────────────────────────────────────────────

    let resizeTimer;
    window.addEventListener("resize", function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            autoResizeTextarea();
            syncChatBottomPad();
        }, 80);
    }, { passive: true });

    if (composerShell && typeof ResizeObserver !== "undefined") {
        new ResizeObserver(function () { syncChatBottomPad(); }).observe(composerShell);
    }

    // ── Start ───────────────────────────────────────────────────────

    bootstrap();
    requestAnimationFrame(function () { syncChatBottomPad(); });
})();
