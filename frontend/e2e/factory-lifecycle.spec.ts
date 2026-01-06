import { test, expect } from '@playwright/test';

// Reuse login state or mock it if possible. For now, we'll do a simple login flow.
// Ideally, this should be in a global setup or using a reused storage state.

test.describe('Factory Management Lifecycle', () => {
    test.beforeEach(async ({ page }) => {
        // 1. Go to login page
        await page.goto('/login');

        // Mock Quota Status API to ensure we can create factories
        await page.route(/\/api\/v1\/organizations\/quota-status/, async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    subscription_tier: 'pro',
                    factories: {
                        current: 0,
                        max: 5,
                        available: 5,
                        can_create: true
                    },
                    lines_per_factory: {
                        max: 10,
                        by_factory: []
                    }
                })
            });
        });

        // Mock Factories API (Stateful)
        let mockFactories = [
            // Start empty
        ] as any[];

        // Regex for /api/v1/factories/ (exact list) or POST
        await page.route(/\/api\/v1\/factories\/$/, async route => {
            const method = route.request().method();
            if (method === 'GET') {
                await route.fulfill({ json: mockFactories });
            } else if (method === 'POST') {
                const data = route.request().postDataJSON();
                const newFactory = {
                    id: `factory-${Date.now()}`,
                    name: data.name,
                    code: data.code,
                    country: data.country,
                    timezone: data.timezone,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                };
                mockFactories.push(newFactory);
                await route.fulfill({ json: newFactory });
            } else {
                await route.continue();
            }
        });

        // Mock Delete Factory: /api/v1/factories/{id}
        await page.route(/\/api\/v1\/factories\/[^/]+$/, async route => {
            if (route.request().method() === 'DELETE') {
                const url = route.request().url();
                const id = url.split('/').pop();
                mockFactories = mockFactories.filter(f => f.id !== id);
                await route.fulfill({ status: 204 });
            } else {
                await route.continue();
            }
        });

        // Mock Production Lines API: /api/v1/factories/{id}/lines or /lines/
        await page.route(/\/api\/v1\/factories\/.*\/lines\/?/, async route => {
            const method = route.request().method();
            if (method === 'GET') {
                // Return valid array for enrichment
                await route.fulfill({ json: [] });
            } else if (method === 'POST') {
                const data = route.request().postDataJSON();
                await route.fulfill({
                    json: {
                        id: `line-${Date.now()}`,
                        name: data.name,
                        factory_id: 'mock-id'
                    }
                });
            } else {
                await route.continue();
            }
        });

        // 2. Perform Login with Demo User
        if (page.url().includes('/login')) {
            // Click "Load Demo User" to fill credentials
            await page.getByText('[LOAD_DEMO_USER]').click();
            // Click submit
            await page.getByRole('button', { name: 'Initialize Session' }).click();
            await page.waitForURL('**/dashboard');
        }
    });

    test('should create a new factory, verify quota, and delete it', async ({ page }) => {
        // Navigate to My Dashboards (Workspace) where factories are managed
        await page.goto('/dashboard/my-dashboards');

        // --- 1. Initial State Check ---
        // Wait for the grid to load
        const factoriesGrid = page.getByTestId('factories-grid');
        await expect(factoriesGrid).toBeVisible();

        // Get initial number of factories (optional, for strict checking)
        // const initialCount = await factoriesGrid.locator('[data-testid^="factory-card-"]').count();

        // --- 2. Factory Creation ---
        // Open Modal
        await page.getByTestId('create-factory-btn').click();

        const modal = page.getByTestId('factory-modal');
        await expect(modal).toBeVisible();

        // Fill Form
        const testFactoryName = `Test Factory ${Date.now()}`;
        await page.getByTestId('factory-name-input').fill(testFactoryName);
        await page.getByTestId('factory-code-input').fill('TF-01');
        await page.getByTestId('production-line-input').fill('Line 1');

        // Submit
        await page.getByTestId('submit-factory-btn').click();

        // Verify Modal Closes
        await expect(modal).not.toBeVisible();

        // --- 3. Verify Creation in List ---
        // Wait for the new card to appear
        const newCard = page.getByText(testFactoryName).first(); // Or use specific test id logic if we knew the ID
        await expect(newCard).toBeVisible();

        // --- 4. Quota Check ---
        // This depends on how the quota text is rendered. 
        // We expect the "X/Y factories used" text to be present.
        // We can just verify the text is visible.
        await expect(page.getByText(/factories used/i)).toBeVisible();


        // --- 5. Deletion ---
        // Find the delete button for this specific factory. 
        // Since we don't know the exact ID generated by the backend easily without API interception,
        // we'll find the card by text, then find the delete button within it.

        // Refine locator to the specific card
        const cardLocator = factoriesGrid.locator('div').filter({ hasText: testFactoryName }).first();

        // Hover to show actions if needed (though our CSS might handle it, Playwright can force click)
        await cardLocator.hover();

        // Click Delete. Expect a confirmation dialog.
        page.on('dialog', dialog => dialog.accept()); // Auto-accept alert/confirm

        const deleteBtn = cardLocator.locator('button[title="Delete factory"]');
        await deleteBtn.click();

        // Verify it disappears
        await expect(cardLocator).not.toBeVisible({ timeout: 10000 });
    });

    test('should require fields when creating factory', async ({ page }) => {
        await page.goto('/dashboard/my-dashboards');
        await page.getByTestId('create-factory-btn').click();

        const modal = page.getByTestId('factory-modal');

        // Try to submit empty
        await page.getByTestId('submit-factory-btn').click();

        // Expect validation errors (assuming they are displayed as text)
        // Adjust these expectations based on your actual validation UI
        await expect(page.getByText('Factory name is required')).toBeVisible();
        await expect(page.getByText('Production line name is required')).toBeVisible();
    });
});
