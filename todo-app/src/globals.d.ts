/** Ambient declarations shared across the Janus app. */

declare global {
  interface Window {
    /**
     * Set by the service-worker register once a newly deployed worker has
     * taken over and asked the old one to retire. Calling it reloads the page
     * so the user sees the freshly deployed shell.
     */
    __janusUpdateReady?: () => void;
  }

  interface WindowEventMap {
    /** Fired when localStorage can no longer persist changes (quota full). */
    "janus:storage-full": CustomEvent<void>;
  }
}

export {};
