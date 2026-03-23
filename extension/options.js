/**
 * PromptBuddy Extension - Options/Settings Controller
 * 
 * Handles user configuration, including API keys, model preferences,
 * and UI customization (theme and font size).
 */

document.addEventListener('DOMContentLoaded', () => {

    // ------------------------------------------
    // INITIAL SAFETY CHECK
    // ------------------------------------------
    if (typeof chrome === 'undefined' || !chrome.storage) {
        console.error('[PromptBuddy] Chrome storage API is unavailable');
        document.body.innerHTML = `
            <div class="container">
                <h1>Configuration Error</h1>
                <p>Chrome extension APIs are not available in this context.</p>
            </div>`;
        return;
    }

    // ------------------------------------------
    // DOM ELEMENT REFERENCES
    // ------------------------------------------
    const form = document.getElementById('settingsForm');
    const modelSelect = document.getElementById('model');
    const apiKeyInput = document.getElementById('apiKey');
    const geminiModelSelect = document.getElementById('geminiModel');
    const geminiModelGroup = document.getElementById('geminiModelGroup');
    const toneSelect = document.getElementById('tone');
    const maxWordsInput = document.getElementById('maxWords');
    const themeSelect = document.getElementById('theme');
    const fontSizeSlider = document.getElementById('fontSize');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const clearBtn = document.getElementById('clearBtn');
    const toggleVisibility = document.getElementById('toggleVisibility');
    const statusMessage = document.getElementById('statusMessage');
    const providerCards = document.querySelectorAll('.provider-card');

    // ------------------------------------------
    // INITIALIZATION & LOADING
    // ------------------------------------------

    /**
     * Loads saved settings from chrome.storage.sync
     */
    function loadPersistedSettings() {
        chrome.storage.sync.get(
            ['apiKey', 'model', 'tone', 'maxWords', 'theme', 'fontSize'],
            (result) => {
                if (chrome.runtime.lastError) {
                    console.error('[PromptBuddy] Error loading settings:', chrome.runtime.lastError);
                    return;
                }

                // Apply values to form elements
                if (result.model) {
                    modelSelect.value = result.model;
                    updateProviderUI(result.model);
                }
                if (result.apiKey) apiKeyInput.value = result.apiKey;
                if (result.geminiModel) geminiModelSelect.value = result.geminiModel;
                if (result.tone) toneSelect.value = result.tone;
                if (result.maxWords) maxWordsInput.value = result.maxWords;

                // Sync UI for theme and font
                const theme = result.theme || 'system';
                themeSelect.value = theme;
                applyTheme(theme);
                setupThemeListener(theme);

                if (result.fontSize) {
                    fontSizeSlider.value = result.fontSize;
                    fontSizeValue.textContent = result.fontSize;
                }
            }
        );
    }

    // Trigger initial load
    loadPersistedSettings();

    // ------------------------------------------
    // UI UTILITIES
    // ------------------------------------------

    /**
     * Updates the highlighted provider card based on selection
     * @param {string} model 
     */
    function updateProviderUI(model) {
        providerCards.forEach(card => card.classList.remove('active'));
        if (!model) return;

        const activeCard = document.querySelector(`.provider-card[data-provider="${model}"]`);
        if (activeCard) activeCard.classList.add('active');

        // Toggle Gemini Model selection group
        if (geminiModelGroup) {
            geminiModelGroup.style.display = model === 'gemini' ? 'block' : 'none';
        }
    }

    /**
     * Applies the dark/light/system theme
     * @param {string} theme 
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

    let systemThemeQuery = null;
    function setupThemeListener(theme) {
        if (systemThemeQuery) systemThemeQuery.onchange = null;

        if (theme === 'system') {
            systemThemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
            systemThemeQuery.onchange = (e) => {
                document.documentElement.classList.toggle('dark-mode', e.matches);
            };
        }
    }

    /**
     * Standardized status reporting
     */
    function showStatus(message, type = 'info') {
        if (!statusMessage) return;
        statusMessage.textContent = message;
        statusMessage.className = `status-message status-${type}`;
        statusMessage.style.display = 'block';
    }

    function hideStatus() {
        if (statusMessage) statusMessage.style.display = 'none';
    }

    // ------------------------------------------
    // EVENT LISTENERS
    // ------------------------------------------

    // Dynamic UI Updates
    modelSelect.addEventListener('change', () => updateProviderUI(modelSelect.value));
    
    fontSizeSlider.addEventListener('input', (e) => {
        fontSizeValue.textContent = e.target.value;
    });

    // API Key Visiblity Toggle
    toggleVisibility.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = apiKeyInput.type === 'password';
        apiKeyInput.type = isHidden ? 'text' : 'password';
        toggleVisibility.textContent = isHidden ? 'Hide' : 'Show';
    });

    // Form Submission (Save)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const settings = {
            model: modelSelect.value,
            geminiModel: geminiModelSelect.value,
            apiKey: apiKeyInput.value.trim(),
            tone: toneSelect.value || 'professional',
            maxWords: maxWordsInput.value ? parseInt(maxWordsInput.value) : 500,
            theme: themeSelect.value || 'system',
            fontSize: parseInt(fontSizeSlider.value) || 14
        };

        if (!settings.model || !settings.apiKey) {
            showStatus('Model selection and API Key are required.', 'error');
            return;
        }

        try {
            await chrome.storage.sync.set(settings);
            applyTheme(settings.theme);
            setupThemeListener(settings.theme);
            showStatus('Settings saved successfully!', 'success');
            setTimeout(hideStatus, 2000);
        } catch (err) {
            showStatus('Failed to save settings: ' + err.message, 'error');
        }
    });

    // Global Reset (Clear)
    clearBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete all saved settings and API keys?')) return;

        try {
            await chrome.storage.sync.clear();
            form.reset();
            updateProviderUI(null);
            showStatus('All settings have been cleared.', 'success');
            setTimeout(hideStatus, 2000);
        } catch (err) {
            showStatus('Error clearing settings: ' + err.message, 'error');
        }
    });

});
