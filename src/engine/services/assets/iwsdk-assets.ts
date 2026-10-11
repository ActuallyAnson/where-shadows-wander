// The IWSDK side of asset loading, kept apart from asset-loader.ts so that stays testable without booting IWSDK.
import { AssetManager } from '@iwsdk/core';

/** `load` for AssetLoader: fetches (or reuses) a manifest asset by id. Call after World.create. */
export function iwsdkLoad(id: string): Promise<unknown> {
  return AssetManager.loadAsset(id);
}

/**
 * IWSDK waits up to 30 s for any one asset and shares one request per URL, so a retry after a timeout would
 * only wait on the same stuck request. Call once after World.create (the critical assets have loaded by
 * then) so a stuck request is abandoned after `ms` and the next try really fetches again.
 */
export function shortenAssetTimeout(ms = 8000): void {
  AssetManager.setLoadTimeout(ms);
}
