# 🚀 PromptBuddy: Integration & Optimization Guide

This guide outlines the roadmap for integrating it with your Node.js backend and a future React web app.

## 🗺️ The Roadmap: Integration Strategy

### Phase 1: The Backend "Prompt Library"
You need to store the prompts so they can be accessed from both the Extension and the React Web App.

1.  **Database Design (`src/models/prompt.models.js`)**:
    *   `title`: (String, Optional)
    *   `originalContent`: (String, Required)
    *   `enhancedContent`: (String, Required)
    *   `category`: (String, e.g., 'Development', 'Image')
    *   `owner`: (ObjectId, reference to `User`)
    *   `isPublic`: (Boolean, for your "Sharing" feature)

2.  **API Routes**:
    *   `POST /api/v1/prompts`: Save a newly enhanced prompt.
    *   `GET /api/v1/prompts`: Fetch all prompts for the logged-in user.
    *   `DELETE /api/v1/prompts/:id`: Delete a prompt.

### Phase 2: Connecting the Extension
1.  **Authentication**:
    *   In `popup.html`, add a Login/Logout view.
    *   Store the JWT `accessToken` in `chrome.storage.local` after a successful login to your backend.
2.  **Saving Prompts**:
    *   When `enhancePrompt` succeeds in the extension, make a `fetch()` call to your backend `POST /api/v1/prompts` to save the result.

### Phase 3: The React Web App ("The Dashboard")
This is where the user manages their "Portfolio" of prompts.
1.  **Library View**: A grid of all saved prompts with "Copy to Clipboard" buttons.
2.  **Analytics**: Show statistics like "Total Prompts Enhanced", "Favorite Model", "Most Used Category".
3.  **Marketplace (Advanced)**: Allow users to set prompts to `isPublic: true` so others can see them.

---

## 🛠️ Your Next Step (Coding Task)

Start by building the **Prompt Model** and **CRUD Controllers** in your backend. 

**Model Goal**:
```javascript
const promptSchema = new Schema({
    content: { type: String, required: true },
    enhancedContent: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    tags: [String]
}, { timestamps: true });
```

**Controller Goals**:
- `createPrompt`: Save a prompt (Authenticated).
- `getUserPrompts`: Retrieve prompts (Authenticated).

