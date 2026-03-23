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
    // DOM ELEMENT REFERENCES (AUTH)
    // ------------------------------------------
    const loggedOutView = document.getElementById('loggedOutView');
    const loggedInView = document.getElementById('loggedInView');
    const authTitle = document.getElementById('authTitle');
    const authDesc = document.getElementById('authDesc');
    const usernameGroup = document.getElementById('usernameGroup');
    const fullNameGroup = document.getElementById('fullNameGroup');
    const confirmPasswordGroup = document.getElementById('confirmPasswordGroup');
    const signupBtn = document.getElementById('signupBtn');
    const authSwitchAction = document.getElementById('authSwitchAction');
    const authSwitchText = document.getElementById('authSwitchText');

    const avatarInput = document.getElementById('avatar');
    const usernameInput = document.getElementById('username');
    const fullNameInput = document.getElementById('fullName');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');

    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const userAvatar = document.getElementById('userAvatar');
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    let isLoginMode = false;
    const BACKEND_URL = 'http://localhost:3000/api/v1';

    // ------------------------------------------
    // AUTH LOGIC
    // ------------------------------------------

    /**
     * Toggles between Login and Signup modes
     */
    function toggleAuthMode(e) {

        // prevent default behavior of the link
        if (e) e.preventDefault();

        // toggle between login and signup
        isLoginMode = !isLoginMode;

        if (isLoginMode) {
            authTitle.textContent = 'Welcome Back';
            authDesc.textContent = 'Log in to access your synced prompts.';
            usernameGroup.style.display = 'none';
            if (fullNameGroup) fullNameGroup.style.display = 'none';
            if (avatarInput) avatarInput.parentElement.style.display = 'none';
            confirmPasswordGroup.style.display = 'none';
            signupBtn.textContent = 'Log In';
            authSwitchText.textContent = "Don't have an account?";
            authSwitchAction.textContent = 'Sign Up';
        } else {
            authTitle.textContent = 'Create an Account';
            authDesc.textContent = 'Sync your prompts and access them anywhere.';
            usernameGroup.style.display = 'block';
            if (fullNameGroup) fullNameGroup.style.display = 'block';
            if (avatarInput) avatarInput.parentElement.style.display = 'block';
            confirmPasswordGroup.style.display = 'block';
            signupBtn.textContent = 'Sign Up';
            authSwitchText.textContent = 'Already have an account?';
            authSwitchAction.textContent = 'Log In';
        }
        hideStatus();
    }

    /**
     * Checks if user is authenticated and updates UI
     */
    async function checkAuthState() {
        chrome.storage.local.get(['accessToken', 'user'], async (result) => {
            if (result.accessToken) {
                loggedOutView.style.display = 'none';
                loggedInView.style.display = 'block';
                if (result.user) {
                    profileName.textContent = result.user.username;
                    profileEmail.textContent = result.user.email;
                    if (result.user.avatar) userAvatar.src = result.user.avatar;
                }
                // Refresh profile data from server
                fetchProfile(result.accessToken);
            } else {
                loggedOutView.style.display = 'block';
                loggedInView.style.display = 'none';
            }
        });
    }

    /**
     * Fetches fresh profile data from the backend
     */
    async function fetchProfile(token) {
        try {
            const response = await fetch(`${BACKEND_URL}/users/current-user`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            // if token is expired, logout
            if (response.status === 401) {
                handleLogout();
                return;
            }

            const data = await response.json();
            
            if (data.success) {
                const user = data.data;
                profileName.textContent = user.username;
                profileEmail.textContent = user.email;
                if (user.avatar) userAvatar.src = user.avatar;
                chrome.storage.local.set({ user });
            }
        } catch (err) {
            console.error('[PromptBuddy] Profile fetch failed:', err);
        }
    }

    /**
     * Handles Signup and Login
     */
    async function handleAuth() {
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        if (!email || !password) {
            showStatus('Email and Password are required.', 'error');
            return;
        }
        
        // determine endpoint based on login mode
        const endpoint = isLoginMode ? '/users/login' : '/users/register';

        let body;
        let headers = {};

        if (isLoginMode) {
            body = JSON.stringify({ email, password });
            headers['Content-Type'] = 'application/json';
        } else {
            // Use FormData for registration (for avatar upload)
            body = new FormData();
            body.append('username', usernameInput.value.trim());
            body.append('fullName', fullNameInput ? fullNameInput.value.trim() : '');
            body.append('email', email);
            body.append('password', password);
            
            if (avatarInput && avatarInput.files[0]) {
                body.append('avatar', avatarInput.files[0]);
            } else {
                showStatus('Avatar is required for registration.', 'error');
                return;
            }

            if (password !== confirmPasswordInput.value) {
                showStatus('Passwords do not match.', 'error');
                return;
            }
        }

        showStatus(isLoginMode ? 'Logging in...' : 'Creating account...', 'info');

        // make api call to backend
        try {
            const response = await fetch(`${BACKEND_URL}${endpoint}`, {
                method: 'POST',
                headers: headers,
                body: body
            });

            // Parse response - checking content type first
            let data;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error("Server error: " + (text.substring(0, 50) || "Unknown error"));
            }

            if (data.success) {
                // store access token and user data from response from backend
                const { accessToken, user } = data.data || data; // handle different API response structures if needed
                
                // Adjust for data structure in login response if needed
                const token = accessToken || (data.data && data.data.accessToken);
                const userData = user || (data.data && data.data.user);

                if (token) {
                    await chrome.storage.local.set({ accessToken: token, user: userData });
                    showStatus(data.message || 'Success!', 'success');
                    setTimeout(() => {
                        checkAuthState();
                        hideStatus();
                    }, 1000);
                } else {
                    showStatus(data.message || 'Authentication failed: No token received', 'error');
                }
            } else {
                showStatus(data.message || 'Authentication failed', 'error');
            }
        } catch (err) {
            showStatus('Error: ' + err.message, 'error');
        }
    }

    /**
     * Handles Logout
     */
    async function handleLogout() {
        // get access token from storage
        chrome.storage.local.get(['accessToken'], async (result) => {
            try {
                // Optional: Call logout on backend to clear refresh token
                if (result.accessToken) {
                    await fetch(`${BACKEND_URL}/users/logout`, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${result.accessToken}` }
                    });
                }
            } catch (err) {
                console.error('[PromptBuddy] Logout backend call failed', err);
            } finally {
                // remove access token and user data from storage
                await chrome.storage.local.remove(['accessToken', 'user']);
                checkAuthState();
                showStatus('Logged out successfully.', 'info');
                setTimeout(hideStatus, 2000);
            }
        });
    }

    /**
     * Handles Password Change
     */
    async function handleChangePassword() {
        const oldPassword = currentPasswordInput.value;
        const newPassword = newPasswordInput.value;

        if (!oldPassword || !newPassword) {
            showStatus('Both current and new passwords are required.', 'error');
            return;
        }

        // get access token from storage
        chrome.storage.local.get(['accessToken'], async (result) => {
            if (!result.accessToken) return;

            showStatus('Updating password...', 'info');

            // make api call to backend
            try {
                const response = await fetch(`${BACKEND_URL}/users/change-password`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${result.accessToken}`
                    },
                    body: JSON.stringify({ oldPassword, newPassword })
                });

                // parse response from backend
                const data = await response.json();

                if (data.success) {
                    showStatus('Password updated successfully!', 'success');
                    currentPasswordInput.value = '';
                    newPasswordInput.value = '';
                    setTimeout(hideStatus, 2000);
                } else {
                    showStatus(data.message || 'Update failed', 'error');
                }
            } catch (err) {
                showStatus('Network error: ' + err.message, 'error');
            }
        });
    }

    // ------------------------------------------
    // INITIALIZATION & LOADING
    // ------------------------------------------

    /**
     * Loads saved settings from chrome.storage.sync
     */
    function loadPersistedSettings() {
        chrome.storage.sync.get(
            ['apiKey', 'model', 'geminiModel', 'tone', 'maxWords', 'theme', 'fontSize'],
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
    checkAuthState();

    // ------------------------------------------
    // UI UTILITIES
    // ------------------------------------------

    function updateProviderUI(model) {
        providerCards.forEach(card => card.classList.remove('active'));
        if (!model) return;

        const activeCard = document.querySelector(`.provider-card[data-provider="${model}"]`);
        if (activeCard) activeCard.classList.add('active');

        if (geminiModelGroup) {
            geminiModelGroup.style.display = model === 'gemini' ? 'block' : 'none';
        }
    }

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

    // Auth Listeners
    authSwitchAction.addEventListener('click', toggleAuthMode);
    signupBtn.addEventListener('click', handleAuth);
    logoutBtn.addEventListener('click', handleLogout);
    changePasswordBtn.addEventListener('click', handleChangePassword);

    // Dynamic UI Updates
    modelSelect.addEventListener('change', () => updateProviderUI(modelSelect.value));
    
    fontSizeSlider.addEventListener('input', (e) => {
        fontSizeValue.textContent = e.target.value;
    });

    toggleVisibility.addEventListener('click', (e) => {
        e.preventDefault();
        const isHidden = apiKeyInput.type === 'password';
        apiKeyInput.type = isHidden ? 'text' : 'password';
        toggleVisibility.textContent = isHidden ? 'Hide' : 'Show';
    });

    // Save Settings
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

    clearBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete all saved settings and API keys?')) return;

        try {
            await chrome.storage.sync.clear();
            await chrome.storage.local.remove(['accessToken', 'user']);
            form.reset();
            updateProviderUI(null);
            checkAuthState();
            showStatus('All settings have been cleared.', 'success');
            setTimeout(hideStatus, 2000);
        } catch (err) {
            showStatus('Error clearing settings: ' + err.message, 'error');
        }
    });

});
