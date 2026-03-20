# 🔐 Comprehensive Authentication & Authorization System

This document serves as a study guide for learners to understand how the authentication and authorization system is built, from the first request to the final database update.

---

## 🏛️ System Architecture: The Journey of a Request

When you make a request (e.g., `POST /api/v1/users/login`) in Postman, it follows a specific "Execution Context" path:

### 1. The Entry Point: [app.js](./src/app.js)
This is where the server lives. It prepares the "environment" for the request.
- **Rate Limiting**: Checks if the IP has sent too many requests.
- **Parsers**: `express.json()` and `cookieParser()` look at the request and turn JSON or Cookies into readable JavaScript objects (`req.body` and `req.cookies`).

### 2. The Traffic Controller: [user.routes.js](./src/routes/user.routes.js)
The request moves here to find its destination.
- Routes decide which **Middlewares** and **Controllers** should handle the request.
- **Example**: `router.post("/login", loginUser)` says "If it's a POST to /login, go to the login function."

### 3. The Security Guard: [auth.middlewares.js](./src/middlewares/auth.middlewares.js)
For "Private" routes (like updating your profile), the request must pass through `verifyJWT`.
- It checks the `accessToken` in your cookies.
- If valid, it fetches the user from the database (using [user.models.js](./src/models/user.models.js)) and attaches them to `req.user`.
- **Learner Tip**: This is why you can use `req.user` in your controllers!

### 4. The Brain: [user.controllers.js](./src/controllers/user.controllers.js)
This is where the actual logic happens.
- **Validation**: Checks if email/password formats are correct.
- **Action**: Calls database methods, uploads files, or sends emails.
- **Response**: Sends back a success or error message using `ApiResponse` or `ApiError`.

---

## 🔑 Core Concepts & Technologies

### 🪙 JWT (JSON Web Tokens)
We use a **Dual Token System**:
- **Access Token**: Short-lived (e.g., 1 day). Sent with every request to prove who you are.
- **Refresh Token**: Long-lived (e.g., 10 days). Stored in the database and used only to get a **new** Access Token when the old one expires.
- **Security**: Both are stored in `HttpOnly` and `Secure` cookies, making them invisible to malicious browser scripts (XSS protection).

### 🤫 Password Hashing (Bcrypt)
We **never** store passwords as plain text. 
- In [user.models.js](./src/models/user.models.js), a `pre("save")` hook automatically hashes the password before it hits the database.
- `user.comparePassword()` is used to check if the entered password matches the hashed version during login.

### 📧 Email Flows ([sendEmail.js](./src/utils/sendEmail.js))
Whenever an important event happens (Registration, Password Forgot, Email Change), a **Tokenized Link** is generated:
1. A random string is created using `crypto`.
2. A **Hashed Version** is stored in the database.
3. The **Plain Version** is sent to your email (Mailtrap) as a link.
4. When you click the link, the server hashes what you clicked and compares it to the database.

---

## 🛠️ Key Execution Flows for Reference

### 🔄 The Login Flow
1. **Request**: `POST /login` with email/password.
2. **Controller**: Verify email exists -> Compare password hash.
3. **Action**: Generate Access & Refresh tokens.
4. **Action**: Save Refresh Token to Database.
5. **Response**: Set tokens as Cookies + Send user data (without password).

### 🛠️ The Password Reset Flow
1. **Step 1**: `POST /forgot-password` -> Generates token -> Sends Email.
2. **Step 2**: User clicks link -> `POST /reset-password/:token`.
3. **Logic**: Finds user with that token -> Checks expiry -> Updates password -> Deletes token.

### 🎖️ RBAC (Role-Based Access Control)
Using the `authorizeRole(["admin"])` middleware:
- It checks `req.user.role`.
- If you aren't an admin, it throws a `403 Forbidden` error before ever reaching the controller logic.

---

## 📝 Study Exercises for Learners
1. **Trace the `registerUser` flow**: From [app.js](./src/app.js) to [user.routes.js](./src/routes/user.routes.js) (look for Multer!), then to the validation logic in [user.controllers.js](./src/controllers/user.controllers.js).
2. **Check the Model Hooks**: See how `userSchema.pre("save")` in [user.models.js](./src/models/user.models.js) handles password hashing automatically.
3. **Understand Tokens**: Look at `generateAccessToken` and `generateRefreshToken` in the Model file to see what data (payload) is being embedded in the tokens.

