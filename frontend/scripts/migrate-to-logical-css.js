#!/usr/bin/env node
/*
 * Copyright (c) 2026 Aaron Guo. All rights reserved.
 * Use of this source code is governed by the proprietary license
 * found in the LICENSE file in the root directory of this source tree.
 */

/**
 * RTL CSS Migration Script
 * 
 * Converts physical Tailwind CSS classes to logical properties for RTL support.
 * This enables automatic layout mirroring based on the `dir` attribute without
 * prop-drilling `isRTL` through every component.
 * 
 * Usage:
 *   node scripts/migrate-to-logical-css.js [--dry-run] [--path=src/features/dashboard]
 * 
 * Options:
 *   --dry-run    Preview changes without modifying files
 *   --path       Target directory (default: src/features/dashboard)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const targetPath = args.find(arg => arg.startsWith('--path='))?.split('=')[1] || 'src/features/dashboard';

// Replacement mappings: Physical → Logical
const replacements = [
    // Margins
    { pattern: /\bml-(\d+\.?\d*)\b/g, replacement: 'ms-$1', description: 'Margin Left → Margin Start' },
    { pattern: /\bmr-(\d+\.?\d*)\b/g, replacement: 'me-$1', description: 'Margin Right → Margin End' },
    { pattern: /\b-ml-(\d+\.?\d*)\b/g, replacement: '-ms-$1', description: 'Negative Margin Left → Negative Margin Start' },
    { pattern: /\b-mr-(\d+\.?\d*)\b/g, replacement: '-me-$1', description: 'Negative Margin Right → Negative Margin End' },

    // Padding
    { pattern: /\bpl-(\d+\.?\d*)\b/g, replacement: 'ps-$1', description: 'Padding Left → Padding Start' },
    { pattern: /\bpr-(\d+\.?\d*)\b/g, replacement: 'pe-$1', description: 'Padding Right → Padding End' },

    // Text Alignment
    { pattern: /\btext-left\b/g, replacement: 'text-start', description: 'Text Left → Text Start' },
    { pattern: /\btext-right\b/g, replacement: 'text-end', description: 'Text Right → Text End' },

    // Borders
    { pattern: /\bborder-l\b/g, replacement: 'border-s', description: 'Border Left → Border Start' },
    { pattern: /\bborder-r\b/g, replacement: 'border-e', description: 'Border Right → Border End' },
    { pattern: /\bborder-l-(\d+)\b/g, replacement: 'border-s-$1', description: 'Border Left Width → Border Start Width' },
    { pattern: /\bborder-r-(\d+)\b/g, replacement: 'border-e-$1', description: 'Border Right Width → Border End Width' },

    // Rounded Corners
    { pattern: /\brounded-l\b/g, replacement: 'rounded-s', description: 'Rounded Left → Rounded Start' },
    { pattern: /\brounded-r\b/g, replacement: 'rounded-e', description: 'Rounded Right → Rounded End' },
    { pattern: /\brounded-tl\b/g, replacement: 'rounded-ss', description: 'Rounded Top Left → Rounded Start Start' },
    { pattern: /\brounded-tr\b/g, replacement: 'rounded-se', description: 'Rounded Top Right → Rounded Start End' },
    { pattern: /\brounded-bl\b/g, replacement: 'rounded-es', description: 'Rounded Bottom Left → Rounded End Start' },
    { pattern: /\brounded-br\b/g, replacement: 'rounded-ee', description: 'Rounded Bottom Right → Rounded End End' },

    // Positioning
    { pattern: /\bleft-(\d+\.?\d*)\b/g, replacement: 'start-$1', description: 'Left Position → Start Position' },
    { pattern: /\bright-(\d+\.?\d*)\b/g, replacement: 'end-$1', description: 'Right Position → End Position' },
    { pattern: /\b-left-(\d+\.?\d*)\b/g, replacement: '-start-$1', description: 'Negative Left → Negative Start' },
    { pattern: /\b-right-(\d+\.?\d*)\b/g, replacement: '-end-$1', description: 'Negative Right → Negative End' },

    // Inset
    { pattern: /\binset-x-(\d+\.?\d*)\b/g, replacement: 'inset-inline-$1', description: 'Inset X → Inset Inline' },
];

// Statistics
const stats = {
    filesScanned: 0,
    filesModified: 0,
    totalReplacements: 0,
    replacementsByType: {}
};

/**
 * Recursively find all .tsx and .jsx files in a directory
 */
function findFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            // Skip node_modules and build directories
            if (!['node_modules', 'dist', 'build', '.next'].includes(file)) {
                findFiles(filePath, fileList);
            }
        } else if (/\.(tsx|jsx)$/.test(file)) {
            fileList.push(filePath);
        }
    });

    return fileList;
}

/**
 * Process a single file
 */
function processFile(filePath) {
    stats.filesScanned++;

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    let fileReplacements = 0;

    replacements.forEach(({ pattern, replacement, description }) => {
        const matches = content.match(pattern);
        if (matches) {
            const count = matches.length;
            content = content.replace(pattern, replacement);
            modified = true;
            fileReplacements += count;
            stats.totalReplacements += count;

            // Track by type
            stats.replacementsByType[description] = (stats.replacementsByType[description] || 0) + count;

            console.log(`  ✓ ${description}: ${count} occurrence(s)`);
        }
    });

    if (modified) {
        stats.filesModified++;

        if (!isDryRun) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ Modified: ${path.relative(process.cwd(), filePath)} (${fileReplacements} changes)\n`);
        } else {
            console.log(`🔍 Would modify: ${path.relative(process.cwd(), filePath)} (${fileReplacements} changes)\n`);
        }
    }

    return modified;
}

/**
 * Main execution
 */
function main() {
    console.log('🚀 RTL CSS Migration Script\n');
    console.log(`Mode: ${isDryRun ? '🔍 DRY RUN (no files will be modified)' : '✏️  LIVE MODE (files will be modified)'}`);
    console.log(`Target: ${targetPath}\n`);
    console.log('─'.repeat(60));
    console.log('');

    const targetDir = path.resolve(process.cwd(), targetPath);

    if (!fs.existsSync(targetDir)) {
        console.error(`❌ Error: Directory not found: ${targetDir}`);
        process.exit(1);
    }

    const files = findFiles(targetDir);
    console.log(`Found ${files.length} component files to scan\n`);

    files.forEach(file => {
        processFile(file);
    });

    // Print summary
    console.log('─'.repeat(60));
    console.log('\n📊 Migration Summary:\n');
    console.log(`Files scanned:  ${stats.filesScanned}`);
    console.log(`Files modified: ${stats.filesModified}`);
    console.log(`Total changes:  ${stats.totalReplacements}\n`);

    if (Object.keys(stats.replacementsByType).length > 0) {
        console.log('Changes by type:');
        Object.entries(stats.replacementsByType)
            .sort((a, b) => b[1] - a[1])
            .forEach(([type, count]) => {
                console.log(`  • ${type}: ${count}`);
            });
    }

    if (isDryRun && stats.filesModified > 0) {
        console.log('\n💡 To apply these changes, run without --dry-run flag');
    } else if (stats.filesModified > 0) {
        console.log('\n✅ Migration complete! Your components now use logical CSS properties.');
        console.log('   Test your RTL layout by setting dir="rtl" on the root element.');
    } else {
        console.log('\n✨ No physical CSS classes found. Your codebase is already RTL-ready!');
    }
}

// Run the script
main();
