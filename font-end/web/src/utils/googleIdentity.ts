export interface GoogleCredentialResponse {
  credential?: string;
  select_by?: string;
}

interface GoogleAccountsIdApi {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      width?: number | string;
      locale?: string;
    },
  ) => void;
  prompt: () => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsIdApi;
      };
    };
  }
}

const GIS_SCRIPT_ID = 'google-identity-services-script';
const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let scriptLoadPromise: Promise<GoogleAccountsIdApi> | null = null;

export function loadGoogleIdentityApi(): Promise<GoogleAccountsIdApi> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.reject(new Error('Google Identity Services requires a browser environment.'));
  }

  const existingApi = window.google?.accounts?.id;
  if (existingApi) {
    return Promise.resolve(existingApi);
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise<GoogleAccountsIdApi>((resolve, reject) => {
    const existingScript = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        const api = window.google?.accounts?.id;
        if (api) resolve(api);
        else reject(new Error('Google Identity Services failed to initialize.'));
      });
      existingScript.addEventListener('error', () => {
        scriptLoadPromise = null;
        reject(new Error('Không thể tải Google Sign-In SDK.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const api = window.google?.accounts?.id;
      if (api) {
        resolve(api);
      } else {
        scriptLoadPromise = null;
        reject(new Error('Google Identity Services failed to initialize.'));
      }
    };
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Không thể tải Google Sign-In SDK.'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}
