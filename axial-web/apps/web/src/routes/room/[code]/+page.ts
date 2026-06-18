export const ssr = false;

export function load({ params }: { params: { code: string } }) {
	return {
		code: params.code
	};
}
