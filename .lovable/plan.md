# Plan: Comprehensive System Audit and Stability Fixes

## Problem Statement
The system audit identified several UI and logic inconsistencies:
1. **AI Providers Dashboard**: The dashboard UI hardcodes deprecated models (e.g., Groq's `llama-3.3-70b-versatile`) while the backend uses dynamic selection or sanitizers.
2. **Google Trends Data**: The dashboard shows "NaN buscas" for some topics, indicating a parsing failure in `fetch-trends`.
3. **Theme Stability**: Differentiating brand tokens from surface tokens to ensure light mode works correctly without losing brand identity.
4. **Auth Stability**: Resolving potential hangs at 95/100% during the auth initialization phase.
5. **Security**: Ensuring all public tables and functions have correct `GRANT` statements following recent schema changes.

## Proposed Changes

### 1. AI Provider Synchronization
- **Frontend Dashboard**: Update `AIProvidersPanel.tsx` to display the specific model name saved in `user_settings` (e.g., `groq_model`, `gemini_model`) instead of hardcoded strings.
- **Edge Function Guard**: Finalize `sanitizeGroqModel` and `sanitizeGeminiModel` across all generation functions (`generate-articles`, `regenerate-image`, `generate-from-knowledge`) to ensure 100% reliability.

### 2. Trends Data Parsing Fix
- **fetch-trends Edge Function**: Update the RSS parser to handle non-numeric or malformed traffic strings, defaulting to "0" or "médio" safely instead of causing `NaN` in the UI.
- **Frontend Formatting**: Add a safety check in `Dashboard.tsx` to format search volume strings correctly.

### 3. Auth and UI Polish
- **Auth Safety**: Increase the `useAuth` safety timeout and ensure `onAuthStateChange` correctly handles all transition events without blocking.
- **Theme Logic**: Refine `BrandThemeRuntime.tsx` to only apply dark-mode specific surface variables when the `.dark` class is present, allowing standard CSS root variables to handle light mode.

### 4. Database Security Hardening
- **Migration**: Run a final migration to ensure `GRANT` statements exist for `knowledge_entries`, `user_roles`, and any RPCs used by the frontend.

## Technical Details
- **Dynamic Model Display**: The `AIProvidersPanel` will now listen to `user_settings` updates to show the recommended/active model version.
- **Search Volume Regex**: In `fetch-trends`, use a regex to strip non-numeric characters from `ht:approx_traffic` before storage.

## User Review Required
> [!IMPORTANT]
> The "NaN buscas" issue is caused by the raw RSS data format. I will implement a fix that cleans this data before it reaches your dashboard.
