import adapter from '@sveltejs/adapter-cloudflare';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		adapter: adapter({
			routes: {
				include: ['/*'],
				// Pages redirects /embed-bridge-smoke.html to the extensionless path, which would
				// otherwise reach the app and 404. Excluding it lets Pages serve the static file.
				exclude: ['<all>', '/embed-bridge-smoke']
			}
		})
	}
};

export default config;
