/**
 * PromptBuddy Extension - Popup Controller
 * 
 * Logic for the Chrome Extension popup, including UI interactions,
 * AI model selection, mode switching, and prompt enhancement.
 */

// ==========================================
// STATE & CONFIGURATION
// ==========================================

let activeTabId = null;
let isListening = false;
let selectedMode = 'general';
let selectedModel = null;
let chatHistory = [];

// Constants for UI behavior
const MAX_TEXTAREA_HEIGHT = 200;
const MIN_TEXTAREA_HEIGHT = 24;

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Get active tab ID safely from background script
 */
chrome.runtime.sendMessage({ type: "get-active-tab" }, (response) => {
    if (response?.tabId) {
        activeTabId = response.tabId;
        console.log("[PromptBuddy] Connected to Active Tab ID:", activeTabId);
    } else {
        console.warn("[PromptBuddy] No active tab found contextually");
    }
});

/**
 * Main Initialization on DOM Load
 */
document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------
    // DOM ELEMENT REFERENCES
    // ------------------------------------------
    const chatMessages = document.getElementById('chatMessages');
    const originalPromptTextarea = document.getElementById('originalPrompt');
    const enhanceBtn = document.getElementById('enhanceBtn');
    const statusMessage = document.getElementById('statusMessage');
    const settingsLink = document.getElementById('settingsLink');
    const voiceIndicator = document.getElementById('voiceIndicator');
    const modeBtn = document.querySelector('.mode-btn');
    const modeMenu = document.querySelector('.mode-menu');
    const modeItems = document.querySelectorAll('.mode-item');
    const modelBtn = document.querySelector('.model-btn');
    const modelMenu = document.querySelector('.model-menu');
    const modelItems = document.querySelectorAll('.model-item');
    const loginMsg = document.getElementById('loginMsg');

    // Basic null check for critical elements
    if (!chatMessages || !originalPromptTextarea || !enhanceBtn || !statusMessage || !settingsLink) {
        console.error('[PromptBuddy] Critical DOM elements missing, aborting init');
        return;
    }

    /**
     * Updates the UI based on login status
     * @param {boolean} isLoggedIn 
     */
    function updateAuthUI(isLoggedIn) {
        if (isLoggedIn) {
            loginMsg.style.display = 'none';
            // Only enable if API key is also configured
            chrome.storage.sync.get(['apiKey', 'model'], (result) => {
                const isConfigured = result.apiKey && result.model;
                enhanceBtn.disabled = !isConfigured;
                if (!isConfigured) {
                    addSystemMessage('Please configure your API key and model in Settings.');
                }
            });
            modeBtn.disabled = false;
            modelBtn.disabled = false;
            originalPromptTextarea.disabled = false;
        } else {
            loginMsg.style.display = 'block';
            enhanceBtn.disabled = true;
            modeBtn.disabled = true;
            modelBtn.disabled = true;
            originalPromptTextarea.disabled = true;
        }
    }

    // Check if user is logged in
    chrome.storage.local.get(['accessToken'], (result) => {
        updateAuthUI(!!result.accessToken);
    });

    // Listen for storage changes (e.g. login/logout in options page)
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.accessToken) {
            updateAuthUI(!!changes.accessToken.newValue);
        }
    });

    // ------------------------------------------
    // BOOTSTRAP: THEME & SETTINGS
    // ------------------------------------------
    
    // Load persisted theme and font settings
    chrome.storage.sync.get(['theme', 'fontSize', 'model'], (result) => {
        applyTheme(result.theme || 'system');
        setupSystemThemeListener(result.theme || 'system');
        
        if (result.fontSize) {
            document.documentElement.style.setProperty('--base-font-size', result.fontSize + 'px');
        }

        if (result.model) {
            selectedModel = result.model;
            updateModelButtonUI(result.model);
        }
    });

    // Initial configuration check
    chrome.storage.sync.get(['apiKey', 'model'], (result) => {
        if (!result.apiKey || !result.model) {
            chrome.storage.local.get(['accessToken'], (auth) => {
                if (auth.accessToken) {
                    addSystemMessage('Please configure your API key and model in Settings to start enhancing prompts.');
                    enhanceBtn.disabled = true;
                }
            });
        }
    });

    // ------------------------------------------
    // UI CORE UTILITIES
    // ------------------------------------------

    /**
     * Applies the dark/light/system theme to the document
     * @param {string} theme - 'dark', 'light', or 'system'
     */
    function applyTheme(theme) {
        const root = document.documentElement;
        root.classList.remove('dark-mode');

        if (theme === 'dark') {
            root.classList.add('dark-mode');
        } else if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) root.classList.add('dark-mode');
        }
    }

    /**
     * Sets up a listener for OS theme changes if theme is set to 'system'
     * @param {string} theme 
     */
    function setupSystemThemeListener(theme) {
        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.onchange = (e) => applyTheme('system');
        }
    }

    /**
     * Auto-resizes the textarea based on content
     */
    function autoResizeTextarea() {
        originalPromptTextarea.style.height = 'auto';
        const scrollHeight = originalPromptTextarea.scrollHeight;
        const newHeight = Math.max(MIN_TEXTAREA_HEIGHT, Math.min(scrollHeight, MAX_TEXTAREA_HEIGHT));
        
        originalPromptTextarea.style.height = newHeight + 'px';
        originalPromptTextarea.style.overflowY = scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
    }

    /**
     * Shows a status message in the UI
     * @param {string} message 
     * @param {string} type - 'error', 'success', 'info'
     */
    function showStatus(message, type = 'info') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.style.display = 'block';
    }

    function hideStatus() {
        statusMessage.style.display = 'none';
    }

    // ------------------------------------------
    // EVENT HANDLERS: CORE LOGIC
    // ------------------------------------------

    /**
     * Logic for toggling the Mic vs Send icons based on input
     */
    function toggleMainIcon() {
        const hasText = originalPromptTextarea.value.trim().length > 0;
        if (hasText) {
            enhanceBtn.innerHTML = '<i class="ri-send-plane-fill"></i>';
            enhanceBtn.title = "Enhance & Send";
        } else {
            enhanceBtn.innerHTML = '<i class="ri-mic-fill"></i>';
            enhanceBtn.title = "Voice Input";
        }
    }

    /**
     * Toggles voice recording state and communicates with content script
     */
    function toggleVoiceRecording() {
        if (!activeTabId) {
            showStatus("Open a standard website to use Voice Input.", "error");
            return;
        }

        chrome.tabs.sendMessage(activeTabId, { ping: true }, (res) => {
            if (chrome.runtime.lastError) {
                showStatus("Microphone unavailable on this page. Try a normal site.", "error");
                stopVoiceUI();
                return;
            }

            if (!isListening) {
                chrome.tabs.sendMessage(activeTabId, { type: "start-mic" });
                startVoiceUI();
            } else {
                chrome.tabs.sendMessage(activeTabId, { type: "stop-mic" });
                stopVoiceUI();
            }
        });
    }

    function startVoiceUI() {
        isListening = true;
        enhanceBtn.innerHTML = `<i class="ri-mic-off-fill"></i>`;
        if (voiceIndicator) voiceIndicator.style.display = "flex";
    }

    function stopVoiceUI() {
        isListening = false;
        toggleMainIcon();
        if (voiceIndicator) voiceIndicator.style.display = "none";
    }

    /**
     * The main function to trigger AI enhancement
     */
    async function handleEnhanceRequest() {
        const prompt = originalPromptTextarea.value.trim();
        if (!prompt) return;

        // Load latest settings
        const settings = await chrome.storage.sync.get(['apiKey', 'model', 'geminiModel', 'tone', 'maxWords']);
        if (!settings.apiKey || !settings.model) {
            showStatus('Please configure Settings first!', 'error');
            return;
        }

        // UI Reset
        addUserMessageToUI(prompt);
        originalPromptTextarea.value = '';
        autoResizeTextarea();
        originalPromptTextarea.blur();
        
        const loadingId = addTypingIndicator();
        enhanceBtn.disabled = true;
        hideStatus();

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'enhancePrompt',
                prompt,
                settings: {
                    apiKey: settings.apiKey,
                    model: settings.model,
                    geminiModel: settings.geminiModel,
                    tone: settings.tone || 'professional',
                    maxWords: settings.maxWords || 500,
                    mode: selectedMode
                }
            });

            removeTypingIndicator(loadingId);

            if (response.success) {
                addAssistantMessageToUI(response.enhancedPrompt);
                showStatus('Enhanced successfully!', 'success');
                setTimeout(hideStatus, 2000);
            } else {
                addErrorMessageToUI(response.error || 'Enhancement failed');
            }
        } catch (err) {
            removeTypingIndicator(loadingId);
            addErrorMessageToUI('System Error: ' + err.message);
        } finally {
            enhanceBtn.disabled = false;
        }
    }

    // ------------------------------------------
    // EVENT LISTENERS
    // ------------------------------------------

    // Main action button (Mic or Enhance)
    enhanceBtn.addEventListener("click", () => {
        if (isListening) {
            chrome.tabs.sendMessage(activeTabId, { type: "stop-mic" });
            stopVoiceUI();
        }

        if (originalPromptTextarea.value.trim()) {
            handleEnhanceRequest();
        } else {
            toggleVoiceRecording();
        }
    });

    // Textarea interactions
    originalPromptTextarea.addEventListener('input', () => {
        toggleMainIcon();
        autoResizeTextarea();
        if (isListening && originalPromptTextarea.value.trim() !== "") {
            chrome.tabs.sendMessage(activeTabId, { type: "stop-mic" });
            stopVoiceUI();
        }
    });

    originalPromptTextarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEnhanceRequest();
        }
    });

    // Settings Link
    settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: 'options.html' });
    });

    // Mode Selection
    modeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modeMenu.classList.toggle('show');
        modelMenu.classList.remove('show');
    });

    modeItems.forEach(item => {
        item.addEventListener('click', () => {
            selectedMode = item.dataset.mode;
            const icons = { general: '+', development: '💻', image: '🎨' };
            modeBtn.textContent = icons[selectedMode] || '+';
            modeMenu.classList.remove('show');
        });
    });

    // Model Selection
    modelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        modelMenu.classList.toggle('show');
        modeMenu.classList.remove('show');
    });

    modelItems.forEach(item => {
        item.addEventListener('click', () => {
            const model = item.dataset.model;
            selectedModel = model;
            chrome.storage.sync.set({ model });
            updateModelButtonUI(model);
            modelMenu.classList.remove('show');
        });
    });

    function updateModelButtonUI(model) {
        const icons = { Gemini: '🧠', ChatGPT: '💻', Claude: '🎨' };
        modelBtn.innerHTML = icons[model] || '<i class="ri-arrow-up-s-line"></i>';
        modelBtn.title = model || 'Select Model';
    }

    // Global click to close menus
    document.addEventListener('click', () => {
        modeMenu.classList.remove('show');
        modelMenu.classList.remove('show');
    });

    // ------------------------------------------
    // CHAT UI BUILDER
    // ------------------------------------------

    function addUserMessageToUI(text) {
        const div = createMessageDiv('user-message', `
            <div class="message-content">${escapeHtml(text)}</div>
            <div class="message-time">${getCurrentTime()}</div>
        `);
        chatMessages.appendChild(div);
        animateMessage(div);
    }

    function addAssistantMessageToUI(text) {
        const div = createMessageDiv('assistant-message', `
            <div class="message-content fade-in">${escapeHtml(text)}</div>
            <div class="message-actions">
                <button class="action-btn copy-btn" data-text="${escapeAttr(text)}">📋 Copy</button>
                <button class="action-btn insert-btn" data-text="${escapeAttr(text)}">➤ Insert</button>
            </div>
            <div class="message-time">${getCurrentTime()}</div>
        `);

        div.querySelector('.copy-btn').onclick = () => copyToClipboard(text);
        div.querySelector('.insert-btn').onclick = () => insertToTab(text);
        
        chatMessages.appendChild(div);
        animateMessage(div);
    }

    function addTypingIndicator() {
        const id = 'typing-' + Date.now();
        const div = createMessageDiv('assistant-message typing-indicator', `
            <div class="message-content"><div class="typing-dots"><span></span><span></span><span></span></div></div>
        `);
        div.id = id;
        chatMessages.appendChild(div);
        animateMessage(div);
        return id;
    }

    function removeTypingIndicator(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.add('message-exit');
            setTimeout(() => el.remove(), 200);
        }
    }

    function addErrorMessageToUI(error) {
        const div = createMessageDiv('error-message', `
            <div class="message-content">⚠️ ${escapeHtml(error)}</div>
        `);
        chatMessages.appendChild(div);
        animateMessage(div);
    }

    function addSystemMessage(text) {
        const div = createMessageDiv('system-message', `
            <div class="message-content">ℹ️ ${escapeHtml(text)}</div>
        `);
        chatMessages.appendChild(div);
        animateMessage(div);
    }

    // ------------------------------------------
    // HELPERS & MESSAGING
    // ------------------------------------------

    function createMessageDiv(className, innerHTML) {
        const div = document.createElement('div');
        div.className = `message ${className} message-enter`;
        div.innerHTML = innerHTML;
        return div;
    }

    function animateMessage(div) {
        requestAnimationFrame(() => {
            div.classList.add('message-visible');
            chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
        });
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            showStatus('Copied!', 'success');
            setTimeout(hideStatus, 2000);
        });
    }

    function insertToTab(text) {
        chrome.tabs.sendMessage(activeTabId, { action: 'insertText', text: text }, () => {
            if (chrome.runtime.lastError) {
                showStatus('Cannot insert here. Is the page loaded?', 'error');
            } else {
                showStatus('Inserted!', 'success');
                setTimeout(hideStatus, 2000);
            }
        });
    }

    // Listen for incoming voice text from content script
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === "voice-text") {
            originalPromptTextarea.value = msg.text;
            toggleMainIcon();
            autoResizeTextarea();
        }
        if (msg.type === "voice-error") stopVoiceUI();
    });

    // Shared Helper Utilities
    function getCurrentTime() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function escapeAttr(t) { return t.replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

});
