---
name: System Audit and Finalization
description: Fix "NaN" in Google Trends, synchronize AI model labels, and resolve React ref warnings.
type: feature
---

The system shows "NaN buscas" in the dashboard because Google Trends returns search volume as strings like "20,000+". I will standardize this to numeric values. I will also synchronize the AI Provider panel to show the actual active models instead of hardcoded deprecated strings.

## Technical Details

1.  **Trends Data Cleanup**:
    *   Modify `supabase/functions/fetch-trends/index.ts` to extract numeric values from `ht:approx_traffic` (e.g., "20,000+" -> 20000).
    *   Update `src/pages/Dashboard.tsx` to handle these values as numbers and display them formatted correctly in Portuguese (pt-BR).
2.  **AI Providers Sync**:
    *   Update `src/components/dashboard/AIProvidersPanel.tsx` to use the models from `user_settings` and implement display sanitization for deprecated models (e.g., if `llama-3.3-70b-versatile` is saved, show the fallback `llama-3.1-8b-instant` if that's what the backend is using).
3.  **UI/Stability Improvements**:
    *   Address React ref warnings in `App.tsx` and layout components by ensuring `TooltipProvider` and other wrappers are correctly configured.
    *   Fix the preloader/loading hang that causes Playwright timeouts by adding an emergency timeout to the auth wait loop.

## User Impact
*   **Accurate Metrics**: Google Trends data will show correct numbers instead of "NaN".
*   **Dashboard Clarity**: The AI status panel will reflect the real models in use.
*   **Smoother Loading**: Reduced hangs during initial login.
