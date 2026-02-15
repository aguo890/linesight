/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCALES_DIR = path.join(__dirname, '../frontend/public/locales');
const SOURCE_LANG = 'en';
const SOURCE_FILE = 'landing.json';

// Get all language directories
const getDirectories = (source) =>
    fs.readdirSync(source, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

// 1. Helper for syncing structure (Pruning + Merging)
// Iterate over SOURCE keys only.
// If key exists in target, preserve translation.
// If missing in target, add from source.
// Keys in target NOT in source are implicitly dropped (Pruning).
function syncStructure(source, target) {
    const output = {};

    Object.keys(source).forEach((key) => {
        if (isObject(source[key])) {
            // Nested object -> recurse
            // Ensure target[key] is also an object, otherwise treat as empty
            const targetValue = (target && isObject(target[key])) ? target[key] : {};
            output[key] = syncStructure(source[key], targetValue);
        } else {
            // Leaf node
            if (target && target.hasOwnProperty(key)) {
                output[key] = target[key]; // Keep existing
            } else {
                output[key] = source[key]; // Fallback to English
            }
        }
    });

    return output;
}

// 2. Helper to sort keys recursively
function sortObject(obj) {
    if (!isObject(obj)) return obj;

    const sorted = {};
    Object.keys(obj)
        .sort() // Alphanumeric
        .forEach((key) => {
            sorted[key] = sortObject(obj[key]);
        });
    return sorted;
}

const syncLocales = () => {
    const sourcePath = path.join(LOCALES_DIR, SOURCE_LANG, SOURCE_FILE);

    if (!fs.existsSync(sourcePath)) {
        console.error(`❌ Source file not found: ${sourcePath}`);
        process.exit(1);
    }

    const sourceContent = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    const locales = getDirectories(LOCALES_DIR);

    console.log(`🔄 Syncing structure (Pruning & Sorting) from [${SOURCE_LANG}] to ${locales.length - 1} other languages...`);

    locales.forEach((locale) => {
        if (locale === SOURCE_LANG) return;

        const targetDir = path.join(LOCALES_DIR, locale);
        const targetPath = path.join(targetDir, SOURCE_FILE);

        let targetContent = {};
        if (fs.existsSync(targetPath)) {
            try {
                targetContent = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
            } catch (e) {
                console.warn(`⚠️  Could not parse ${locale}/${SOURCE_FILE}, starting fresh.`);
            }
        }

        // 1. Sync
        const synced = syncStructure(sourceContent, targetContent);

        // 2. Sort
        const sorted = sortObject(synced);

        // 3. Write
        // We write if content is different. Note: JSON.stringify guarantees order if keys are inserted in order?
        // Actually, V8 preserves insertion order for string keys. sortObject creates a new object with sorted insertion order.
        const finalContent = JSON.stringify(sorted, null, 2);

        // Compare with existing file simply by reading it again? Or comparing objects.
        // Let's compare stringified versions.
        const currentContentStr = JSON.stringify(targetContent, null, 2); // This might not be sorted, so comparison works best if we sort target first?
        // Actually, easiest is just: if (finalContent !== currentContentStr) write.
        // But targetContent might be unsorted.
        // It's safer to just write if keys/values changed.
        // For simplicity: We will write if finalContent is different from what's on disk.

        let shouldWrite = true;
        if (fs.existsSync(targetPath)) {
            const existingFile = fs.readFileSync(targetPath, 'utf8');
            // Normalize existing file (it might have different whitespace)
            // We can just verify if the object structure is identical.
            // But simpler: just always write for now to enforce sorting, 
            // OR check if stringified output matches exactly.
            if (existingFile.trim() === finalContent.trim()) {
                shouldWrite = false;
            }
        }

        if (shouldWrite) {
            fs.writeFileSync(targetPath, finalContent);
            console.log(`   ✅ Synced: ${locale}`);
        } else {
            console.log(`   Start Synced: ${locale} (no changes)`);
        }
    });

    console.log('✨ Done! All locales are clean, sorted, and synced.');
};

syncLocales();
