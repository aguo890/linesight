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

## 3. Workflow: Adding New Text
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

## 4. Strict Typing Explanation
We use a **Type Declaration** file at `src/i18next.d.ts`.
This file imports the English JSON directly and tells TypeScript: *"The resources for i18next match the shape of the English JSON file."*

If you see a TypeScript error when using `t()`, it means you skipped Step 1 (adding the key to the JSON file).

## 5. Verification & Testing

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
    *   If you see **404** errors for `.json` files, check the `loadPath` in `src/i18n.ts`. It may need to be adjusted for subdirectories (e.g., using `./locales/` instead of `/locales/`).
