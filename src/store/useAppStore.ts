import {create} from 'zustand';

interface AppStore {
  checkingPageIds: Set<string>;
  setChecking: (pageId: string, isChecking: boolean) => void;
  isChecking: (pageId: string) => boolean;
}

export const useAppStore = create<AppStore>((set, get) => ({
  checkingPageIds: new Set(),
  setChecking: (pageId: string, isChecking: boolean) =>
    set(state => {
      const next = new Set(state.checkingPageIds);
      if (isChecking) {
        next.add(pageId);
      } else {
        next.delete(pageId);
      }
      return {checkingPageIds: next};
    }),
  isChecking: (pageId: string) => get().checkingPageIds.has(pageId),
}));
