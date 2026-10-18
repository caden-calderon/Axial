import { getContext, setContext } from 'svelte';
import type { Texture } from 'three';

/**
 * Shares label textures between sprites that draw the same text in the same style. The board
 * shows a few dozen labels but only about a dozen distinct ones, and each texture is a 256x256
 * canvas, so drawing one per sprite multiplied both memory and the work of mounting labels.
 */
export type LabelTextureCache = {
	acquire(key: string, create: () => Texture): Texture;
	release(key: string): void;
	dispose(): void;
};

const LABEL_TEXTURES = Symbol('axial-label-textures');

export function createLabelTextureCache(): LabelTextureCache {
	const entries = new Map<string, { texture: Texture; users: number }>();

	return {
		acquire(key, create) {
			const entry = entries.get(key);
			if (entry) {
				entry.users += 1;
				return entry.texture;
			}
			const texture = create();
			entries.set(key, { texture, users: 1 });
			return texture;
		},
		release(key) {
			const entry = entries.get(key);
			if (!entry) return;
			entry.users -= 1;
			if (entry.users > 0) return;
			entry.texture.dispose();
			entries.delete(key);
		},
		dispose() {
			for (const entry of entries.values()) entry.texture.dispose();
			entries.clear();
		}
	};
}

export function provideLabelTextureCache(cache: LabelTextureCache): void {
	setContext(LABEL_TEXTURES, cache);
}

export function useLabelTextureCache(): LabelTextureCache | undefined {
	return getContext<LabelTextureCache | undefined>(LABEL_TEXTURES);
}
