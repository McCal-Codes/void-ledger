export const localStorageAdapter = {
  get<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    try {
      const item = localStorage.getItem(key);
      if (!item?.trim()) {
        localStorage.removeItem(key);
        return null;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      localStorage.removeItem(key);
      if (!(error instanceof SyntaxError)) {
        console.error(`Error reading from localStorage key "${key}":`, error);
      }
      return null;
    }
  },

  set<T>(key: string, value: T): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage key "${key}":`, error);
    }
  },

  remove(key: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing from localStorage key "${key}":`, error);
    }
  },

  clear(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.clear();
    } catch (error) {
      console.error("Error clearing localStorage:", error);
    }
  },
};
