import { DirectMediaAdapter } from './directMediaAdapter.js';
import { YouTubeMetadataAdapter } from './youtubeMetadataAdapter.js';
import { LocalFileAdapter } from './localFileAdapter.js';

export const directMediaAdapter = new DirectMediaAdapter();
export const youtubeMetadataAdapter = new YouTubeMetadataAdapter();
export const localFileAdapter = new LocalFileAdapter();

export * from './sourceDetector.js';
export * from './sourceValidator.js';
export * from './directMediaAdapter.js';
export * from './youtubeMetadataAdapter.js';
export * from './localFileAdapter.js';

