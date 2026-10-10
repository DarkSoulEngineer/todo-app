/** Ambient declarations shared across the Stride app. */

declare global {
  interface Window {
    /**
     * Set by the service-worker register once a newly deployed worker has
     * taken over and asked the old one to retire. Calling it reloads the page
     * so the user sees the freshly deployed shell.
     */
    __strideUpdateReady?: () => void;
  }

  interface WindowEventMap {
    /** Fired when localStorage can no longer persist changes (quota full). */
    "stride:storage-full": CustomEvent<void>;
  }
}

export {};
