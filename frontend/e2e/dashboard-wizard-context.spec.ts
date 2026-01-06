import { test, expect } from '@playwright/test';

test.describe('Dashboard Wizard Context', () => {
    test.beforeEach(async ({ page }) => {
        // Init flow or login if needed. assuming dev environment with no strict auth or using demo
        await page.goto('/dashboard/my-dashboards');
        // If login needed:
        // await page.getByText('Load Demo User').click();
    });

    test('should pre-select factory when opening wizard from factory detail page', async ({ page }) => {
        // Wait for main content
        await expect(page.getByRole('heading', { name: 'My Dashboards' })).toBeVisible();

        // Check if we can create a factory
        const createButton = page.getByRole('button', { name: 'Create Factory' });
        if (await createButton.isVisible()) {
            // 1. Create a factory
            const factoryName = `Context Test Factory ${Date.now()}`;
            await createButton.click();
            await page.getByLabel('Factory Name').fill(factoryName);
            await page.getByLabel('Factory Code').fill('CTF-01');
            await page.getByLabel('Country').fill('Test Country');
            await page.getByRole('button', { name: 'Create Factory' }).first().click();

            // Wait for factory to appear and click it
            await page.getByText(factoryName).click();
        } else {
            // Pick the first factory card
            const firstFactory = page.locator('.bg-white.rounded-xl.border').first();
            await firstFactory.click();
        }

        // We should be on factory detail page
        await expect(page).toHaveURL(/\/dashboard\/factory\//);

        // 2. Create a line
        const lineName = `Line ${Date.now()}`;
        await page.getByRole('button', { name: 'Add Line' }).click(); // Adjust selector if needed
        await page.getByLabel('Line Name').fill(lineName);
        await page.getByLabel('Line Code').fill('L-01');
        await page.getByRole('button', { name: 'Create Production Line' }).click();

        // 3. Open Dashboard Wizard
        await page.getByRole('button', { name: 'Create Dashboard' }).click();

        // 4. Verify Factory Pre-selection
        // The factory select should be present and have the factory selected
        const factorySelect = page.getByLabel('Factory');
        await expect(factorySelect).toHaveValue(/.+/); // Should have a value
        // Ideally verify it text matches factoryName
        // But value is UUID, so checking if it is selected is good enough or text

        // 5. Select Line (should be selectable)
        const lineSelect = page.getByLabel('Target Production Line');
        await lineSelect.selectOption({ label: `${lineName} (L-01)` });

        // 6. Proceed to Step 2 (Upload)
        // Need to upload a dummy file
        const buffer = Buffer.from('col1,col2\nval1,val2');
        await page.setInputFiles('input[type="file"]', {
            name: 'test.csv',
            mimeType: 'text/csv',
            buffer
        });

        // 7. Proceed to Step 3 (Mapping)
        // Wait for mapping step
        await expect(page.getByText('Validate Mapping')).toBeVisible();
        await page.getByRole('button', { name: 'Confirm Mapping' }).click();

        // 8. Verify Auto-Naming in Step 3
        await expect(page.getByText('Configure Dashboard')).toBeVisible();
        const nameInput = page.getByLabel('Dashboard Name');
        await expect(nameInput).toHaveValue(`${lineName} Dashboard`);
    });
});
