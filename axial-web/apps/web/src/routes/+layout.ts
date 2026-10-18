// Every route renders in the browser. Declaring this on the root layout, rather than on each
// page, keeps the error page client-rendered too: SvelteKit drops the root layout from the
// server bundle when all pages opt out of SSR, so a server-rendered 404 failed with a 500.
export const ssr = false;
