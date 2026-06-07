import { defineConfig } from '@playwright/test';

const productionBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const localBaseUrl = 'http://127.0.0.1:4173';

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.e2e.{ts,js}',
	use: {
		baseURL: productionBaseUrl ?? localBaseUrl
	},
	...(productionBaseUrl
		? {}
		: {
				webServer: {
					command: 'pnpm run build && pnpm run preview --host 127.0.0.1',
					url: localBaseUrl,
					reuseExistingServer: !process.env.CI
				}
			})
});
