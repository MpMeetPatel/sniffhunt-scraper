import { Store } from '@tanstack/store';

export type ScrapingMode = 'normal' | 'beast';

export interface ScrapeModeState {
  mode: ScrapingMode;
}

export const scrapeModeStore = new Store<ScrapeModeState>({
  mode: 'normal',
});

export function setScrapeMode(mode: ScrapingMode) {
  scrapeModeStore.setState({ mode });
}
