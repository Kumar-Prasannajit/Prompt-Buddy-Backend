/**
 * PromptBuddy Extension - Background Service Worker
 * 
 * Handles long-running tasks, cross-origin API requests to AI providers,
 * and coordination between the popup and content scripts.
 */

// ==========================================
// AI SYSTEM PROMPTS (INSTRUCTIONS)
// ==========================================

const GENERAL_INSTRUCTION = `
You are a professional prompt enhancement assistant.
Your task is to rewrite the user's prompt to be clearer, more structured, and more effective while preserving the original intent.

IMPORTANT:
- Do NOT answer the prompt
- Do NOT add explanations or commentary
- Output ONLY the improved prompt text
`;

const DEVELOPMENT_INSTRUCTION = `
You are a senior software architect and industry expert.
When given a vague or high-level development idea, expand it into a detailed, execution-ready prompt by:
- Selecting appropriate industry-standard technologies
- Defining system architecture and core modules
- Suggesting clean naming conventions
- Identifying roles, permissions, and workflows
- Adding missing technical requirements users often forget

Assume the user wants a scalable, real-world solution.

IMPORTANT:
- Do NOT explain your decisions
- Do NOT answer the prompt
- Output ONLY the enhanced prompt text
`;

const IMAGE_INSTRUCTION = `
You are an expert prompt engineer for image generation models.
Expand the user’s idea into a highly detailed visual prompt by adding:
- Artistic style or realism level
- Lighting, camera angle, and lens type
- Environment and background details
- Mood, emotions, and motion
- Texture, depth, and quality cues

IMPORTANT:
- Do NOT add explanations
- Output ONLY the final image prompt
`;

// ==========================================
// MESSAGE ROUTING & LISTENERS
// ==========================================

/**
 * Global message listener for the extension
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Branching logic based on action type
    if (request.type === "get-active-tab") {
        getActiveTab(sendResponse);
        return true; // Keep channel open for async response
    }

    if (request.action === 'enhancePrompt') {
        handleEnhancePromptRequest(request.prompt, request.settings)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open
    }
});

// ==========================================
// CORE HANDLERS
// ==========================================

/**
 * Retrieves the current active tab ID
 * @param {Function} sendResponse 
 */
function getActiveTab(sendResponse) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
            sendResponse({ tabId: tabs[0].id });
        } else {
            sendResponse({ error: "No active tab found" });
        }
    });
}

/**
 * Orchestrates the prompt enhancement process
 * @param {string} prompt 
 * @param {Object} settings 
 * @returns {Promise<Object>}
 */
async function handleEnhancePromptRequest(prompt, settings) {
    const { model, geminiModel, apiKey, tone, maxWords, mode } = settings;

    // Determine the specialized instruction based on mode or prompt content
    const finalMode = mode || detectModeAuto(prompt);
    const systemInstruction = getSystemInstructionByMode(finalMode);

    try {
        // Route to the appropriate model provider
        switch (model.toLowerCase()) {
            case 'openai':
            case 'chatgpt':
                return await enhanceWithOpenAI(prompt, apiKey, tone, maxWords, systemInstruction);
            case 'gemini':
                return await enhanceWithGemini(prompt, apiKey, tone, maxWords, systemInstruction, geminiModel);
            case 'claude':
                return await enhanceWithClaude(prompt, apiKey, tone, maxWords, systemInstruction);
            default:
                throw new Error('Invalid or unsupported model selected');
        }
    } catch (error) {
        console.error('[PromptBuddy] Background Error:', error);
        return { success: false, error: error.message || 'Failed to communicate with AI provider' };
    }
}

// ==========================================
// AI PROVIDER INTEGRATIONS
// ==========================================

/**
 * Calls OpenAI Chat Completions API
 */
async function enhanceWithOpenAI(prompt, apiKey, tone, maxWords, instruction) {
    const systemMessage = `${instruction}\nTone: ${tone}\nMaximum length: ${maxWords} words.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: Math.min(maxWords * 2, 2048)
        })
    });

    return await parseApiResponse(response, 'openai');
}

/**
 * Calls Google Gemini (Generative Language) API
 */
async function enhanceWithGemini(prompt, apiKey, tone, maxWords, instruction, geminiModel) {
    const modelId = geminiModel || 'gemini-2.5-flash';
    const combinedPrompt = `${instruction}\nTone: ${tone}\nMax Length: ${maxWords} words.\n\nPROMPT TO ENHANCE:\n${prompt}`;

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: combinedPrompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: Math.min(maxWords * 2, 2048)
                }
            })
        }
    );

    return await parseApiResponse(response, 'gemini');
}

/**
 * Calls Anthropic Claude Messages API
 */
async function enhanceWithClaude(prompt, apiKey, tone, maxWords, instruction) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: Math.min(maxWords * 2, 2048),
            system: `${instruction}\nTone: ${tone}\nMax words: ${maxWords}`,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    return await parseApiResponse(response, 'claude');
}

// ==========================================
// LOGIC UTILITIES
// ==========================================

/**
 * Parses raw fetch responses into standardized objects
 */
async function parseApiResponse(response, provider) {
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `${provider} API Error: ${response.status}`);
    }

    const data = await response.json();
    let text = "";

    if (provider === 'openai') text = data.choices?.[0]?.message?.content;
    if (provider === 'gemini') text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (provider === 'claude') text = data.content?.[0]?.text;

    return { success: true, enhancedPrompt: text?.trim() };
}

/**
 * Automatically detects the enhancement mode based on content
 */
function detectModeAuto(prompt) {
    if (/image|photo|scene|draw|illustration|generate image/i.test(prompt)) return 'image';
    if (/build|develop|system|app|backend|frontend|project|software/i.test(prompt)) return 'development';
    return 'general';
}

/**
 * Map mode keys to their respective system descriptions
 */
function getSystemInstructionByMode(mode) {
    const map = { development: DEVELOPMENT_INSTRUCTION, image: IMAGE_INSTRUCTION };
    return map[mode] || GENERAL_INSTRUCTION;
}
