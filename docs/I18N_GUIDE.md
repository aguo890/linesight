# Internationalization (i18n) Developer Guide

## 1. Architecture Overview
We use [react-i18next](https://react.i18next.com/) for handling translations, configured with the following specific modules:

*   **`i18next-http-backend`**: Loads translations asynchronously from the `/public/locales` folder. This keeps the initial bundle size low.
*   **`i18next-browser-languagedetector`**: Automatically detects the user's language preferences.
*   **Strict TypeScript Support**: The `t()` function is statically typed. You cannot use a key that does not exist in the English translation file.

## 2. Directory Structure
```text
project-root/
├── public/
│   └── locales/           # Translation JSON files live here
│       ├── en/
│       │   └── translation.json  # SOURCE OF TRUTH for Types
│       ├── es/
│       │   └── translation.json
│       └── ar/
│           └── translation.json
├── src/
│   ├── i18n.ts            # Configuration initialization
│   ├── i18next.d.ts       # Type definitions (Schema)
│   └── components/
│       └── common/
│           └── LanguageSelector.tsx # Reusable switcher
```

```

## 3. Locale Mapping Strategy
The application uses two different formats for locale codes:
*   **Frontend (Short Codes)**: `en`, `es`, `ar`, `zh`. Matches the folder names in `public/locales`.
*   **Backend (Region Codes)**: `en-US`, `es-ES`, `ar-EG`, `zh-CN`. Matches standard database conventions.

We use `src/utils/localeUtils.ts` to bridge this gap.
*   **`toRegionLocale`**: Used when saving preferences to the database (UI -> DB).
*   **`toShortLocale`**: Used when loading the user profile (DB -> UI).

## 4. Persistence & Synchronization

### Backend Merge Strategy
To prevent race conditions (e.g., Tab A changes Theme, Tab B changes Language), we rely on a **Backend-Side Merge** strategy.
*   **Frontend**: Sends ONLY the changed field.
    *   Payload: `{ "preferences": { "locale": "zh-CN" } }`
*   **Backend**: 
    1.  Loads existing preferences.
    2.  Merges the incoming partial object.
    3.  Saves the result.
    *   *Result:* User settings (Theme, Notifications) are preserved.

### Initialization Priority
1.  **Database Preference**: If the user is logged in and has a saved locale, this **wins**.
2.  **Browser Detection**: If no DB setting exists, we fall back to `i18next-browser-languagedetector`.
3.  **Fallback**: Defaults to `en`.

## 5. Workflow: Adding New Text
Follow this exact process to add new text to the application.

### Step 1: Add to English (Source of Truth)
Open `public/locales/en/translation.json` and add your key. Use nested objects for organization.

```json
{
  "profile": {
    "existing_key": "Profile",
    "new_section": {
      "title": "New Feature Title"
    }
  }
}
```

### Step 2: Add Placeholders for Other Languages
You **must** add the same keys to `es/translation.json` and `ar/translation.json`.
*   **Convention**: Prefix the value with `[MOCK]` so it is obvious it needs professional translation later.

**`es/translation.json`**:
```json
{
  "profile": {
    "new_section": {
      "title": "[MOCK] Título de Nueva Función"
    }
  }
}
```

### Step 3: Use in Component
Use the `useTranslation` hook. TypeScript will now autocomplete your new key.

```tsx
import { useTranslation } from 'react-i18next';

const MyComponent = () => {
  const { t } = useTranslation();
  
  // ✅ Correct
  return <h1>{t('profile.new_section.title')}</h1>;

  // ❌ Error: Property 'wrong' does not exist...
  // return <h1>{t('profile.wrong')}</h1>;
}
```

## 6. Strict Typing Explanation
We use a **Type Declaration** file at `src/i18next.d.ts`.
This file imports the English JSON directly and tells TypeScript: *"The resources for i18next match the shape of the English JSON file."*

If you see a TypeScript error when using `t()`, it means you skipped Step 1 (adding the key to the JSON file).

## 7. Verification & Testing

### RTL (Right-to-Left) Support
When testing Arabic (`ar`):
1.  Ensure the text changes to Arabic characters.
2.  **Visual Check**: If we implement full RTL layout support later, verify that the `dir="rtl"` attribute is present on the `<html>` or `<body>` tag. (Currently text-only).

### Production Build Verification
**Crucial**: Because we use `http-backend`, translation files are fetched as external assets.
Always verify the production build locally before deploying:

1.  Run `npm run build`
2.  Run `npm run preview`
3.  Open the localhost link.
4.  **Check**: If you see text keys (e.g., `profile.title`) instead of "User Profile", open the Network tab.
    *   If you see **404** errors for `.json` files, check the `loadPath` in `src/i18n.ts`. It should use `import.meta.env.BASE_URL` to handle subdirectories dynamically.

## 8. Maintenance & Scaling

### Namespace Strategy
Currently, we use a single `translation.json` (the default namespace).
**Trigger for Change**: Once `translation.json` exceeds **~500 lines**, you MUST split it into multiple namespaces (e.g., `common.json`, `profile.json`, `auth.json`) to avoid performance degradation in the IDE (TypeScript language server) and to keep files manageable.

### Key Extraction
To prevent "missing key" drift, consider using tools like `i18next-parser` to automatically extract keys from your code into the JSON files.

### Type Safety Optimization
In `i18next.d.ts`, ensure you are importing the JSON strictly. If performance lags, ensure you are not doing wildcard imports that force TS to re-evaluate the entire JSON tree on every keystroke.

## 9. Instructions for AI Agents
When generating code or adding features, you **MUST** follow this protocol to ensure i18n stability or I will fail your output:

> **"When adding UI text, first check `public/locales/en/translation.json`. If the key is missing, add it there first, then update the Spanish and Arabic mocks (marking them with `[MOCK]`), then use the `t('key')` function in the component."**

### Mock Data Policy
Any auto-generated translation added by an AI Agent MUST be tagged explicitly.
*   **Format**: `"[MOCK] <Translated Text>"`
*   **Example**: `"bio_placeholder": "[MOCK] This is a sample biography..."`

