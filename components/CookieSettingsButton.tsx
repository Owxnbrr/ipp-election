// components/CookieSettingsButton.tsx
"use client";

type Consent = { necessary: true; analytics: boolean; marketing: boolean };
const STORAGE_KEY = "ipp_cookie_consent_v1";

function readConsent(): Consent | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Consent;
  } catch {
    return null;
  }
}

export default function CookieSettingsButton() {
  const openPrefs = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };
  return (
    <button
      type="button"
      onClick={openPrefs}
      className="text-sm font-medium text-gray-600 hover:text-gray-900 hover:underline"
    >
      Cookies
    </button>
  );
}
