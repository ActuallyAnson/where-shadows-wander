export type AssetClass = 'texture' | 'model' | 'sfx' | 'music';
export type Priority = 'critical' | 'background' | 'lazy';

export const BUDGETS: {
  initialBundleGzipBytes: number;
  criticalTotalBytes: number;
  perFileBytes: Record<AssetClass, number>;
  extensions: { texture: string[]; model: string[]; audio: string[] };
};

export function extensionOf(path: string): string;
export function foldersUnderAssets(path: string): string[];
export function priorityOf(path: string): Priority;
export function classify(path: string): AssetClass | null;
export function checkSourceName(path: string): string | null;
export function checkFile(path: string, bytes: number): string | null;
export function checkCriticalTotal(files: readonly { path: string; bytes: number }[]): string | null;
export function checkInitialBundle(gzipBytes: number): string | null;
export function firstLoadFiles(html: string, read: (file: string) => string | null): string[];
export function assetIdOf(path: string): string;
