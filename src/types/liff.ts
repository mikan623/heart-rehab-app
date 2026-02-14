export type LiffProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
};

export type Liff = {
  init: (options: { liffId: string }) => Promise<void>;
  isLoggedIn: () => boolean;
  login: (options?: { redirectUri?: string }) => void;
  logout: () => void;
  getProfile: () => Promise<LiffProfile>;
  getIDToken: () => string | null;
  getAccessToken?: () => string | null;
  isInClient: () => boolean;
  shareTargetPicker: (messages: unknown[]) => Promise<unknown>;
  sendMessages: (messages: unknown[]) => Promise<void>;
  getInlineTopAreaHeight?: () => number;
  getInlineBottomAreaHeight?: () => number;
};

declare global {
  interface Window {
    liff?: Liff;
  }
}
