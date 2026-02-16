// components/CookieBanner.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Consent = {
    necessary: true;
    analytics: boolean;
    marketing: boolean;
};

const STORAGE_KEY = "ipp_cookie_consent_v1";

function readConsent(): Consent | null {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
        const parsed = JSON.parse(raw) as Consent;
    if (parsed && parsed.necessary === true && typeof parsed.analytics === "boolean" && typeof parsed.marketing === "boolean") {
        return parsed;
    }
    return null;
    } catch (e) {
        return null;
    }
}

function writeConsent(consent: Consent) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    window.dispatchEvent(new CustomEvent("ipp:cookie-consent", { detail: consent }));
}

export default function CookieBanner() {
    const [open, setOpen] = useState(false);
    const [showPrefs, setShowPrefs] = useState(false);

    const [analytics, setAnalytics] = useState(false);
    const [marketing, setMarketing] = useState(false);

    const current = useMemo(() => readConsent(), []);

    useEffect(() => {
    const existing = readConsent();
    if (!existing) {
        setOpen(true);
        return;
    }
        setOpen(false);
    }, []);

    const acceptAll = () => {
        const consent: Consent = { necessary: true, analytics: true, marketing: true };
        writeConsent(consent);
        setOpen(false);
    };

    const rejectAll = () => {
        const consent: Consent = { necessary: true, analytics: false, marketing: false };
        writeConsent(consent);
        setOpen(false);
    };

    const savePrefs = () => {
        const consent: Consent = { necessary: true, analytics, marketing };
        writeConsent(consent);
        setOpen(false);
    };

    const openPrefs = () => {
        const existing = readConsent();
        setAnalytics(existing?.analytics ?? false);
        setMarketing(existing?.marketing ?? false);
        setShowPrefs(true);
        setOpen(true);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-[60] p-4">
        <div className="mx-auto max-w-4xl rounded-2xl border bg-white shadow-lg">
            <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-gray-900">🍪 Gestion des cookies</h2>
                <p className="mt-2 text-sm text-gray-600">
                    Nous utilisons des cookies nécessaires au bon fonctionnement du site. Avec votre accord, nous pouvons aussi
                    utiliser des cookies <span className="font-medium">d’analyse</span> pour améliorer l’expérience, et{" "}
                    <span className="font-medium">marketing</span> (optionnel).
                </p>

                <div className="mt-3 text-xs text-gray-500">
                    Vous pouvez modifier votre choix à tout moment.
                    {current ? (
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5">
                        Choix actuel : Analyse {current.analytics ? "✅" : "❌"} • Marketing {current.marketing ? "✅" : "❌"}
                    </span>
                    ) : null}
                </div>
                </div>

                <div className="flex flex-col gap-2 sm:min-w-[220px] sm:items-end">
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                    type="button"
                    onClick={rejectAll}
                    className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                    >
                    Refuser
                    </button>

                    <button
                    type="button"
                    onClick={acceptAll}
                    className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                    Tout accepter
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => (showPrefs ? setShowPrefs(false) : openPrefs())}
                    className="text-sm font-medium text-gray-700 hover:underline"
                >
                    {showPrefs ? "Fermer les préférences" : "Personnaliser"}
                </button>
                </div>
            </div>

            {showPrefs ? (
                <div className="mt-5 rounded-xl border bg-gray-50 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-1">
                    <p className="text-sm font-semibold text-gray-900">Préférences</p>
                    <p className="mt-1 text-xs text-gray-600">
                        Les cookies nécessaires sont toujours activés.
                    </p>
                    </div>

                    <div className="sm:col-span-2 space-y-3">
                    <label className="flex items-start justify-between gap-4 rounded-xl bg-white p-3">
                        <div>
                        <div className="text-sm font-medium text-gray-900">Nécessaires</div>
                        <div className="text-xs text-gray-600">Indispensables au fonctionnement du site.</div>
                        </div>
                        <span className="mt-0.5 inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
                        Toujours activés
                        </span>
                    </label>

                    <label className="flex items-start justify-between gap-4 rounded-xl bg-white p-3">
                        <div>
                        <div className="text-sm font-medium text-gray-900">Analyse</div>
                        <div className="text-xs text-gray-600">Mesure d’audience pour améliorer le site.</div>
                        </div>
                        <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 accent-black"
                        checked={analytics}
                        onChange={(e) => setAnalytics(e.target.checked)}
                        />
                    </label>

                    <label className="flex items-start justify-between gap-4 rounded-xl bg-white p-3">
                        <div>
                        <div className="text-sm font-medium text-gray-900">Marketing</div>
                        <div className="text-xs text-gray-600">Contenu/personnalisation marketing (optionnel).</div>
                        </div>
                        <input
                        type="checkbox"
                        className="mt-1 h-5 w-5 accent-black"
                        checked={marketing}
                        onChange={(e) => setMarketing(e.target.checked)}
                        />
                    </label>

                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                        <button
                        type="button"
                        onClick={savePrefs}
                        className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                        >
                        Enregistrer
                        </button>
                        <button
                        type="button"
                        onClick={() => setShowPrefs(false)}
                        className="rounded-xl border px-4 py-2 text-sm font-medium text-gray-800 hover:bg-white"
                        >
                        Annuler
                        </button>
                    </div>
                    </div>
                </div>
                </div>
            ) : null}
            </div>

            <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-gray-500 sm:px-6">
            <span>IPP — Cookies</span>
            <button
                type="button"
                onClick={openPrefs}
                className="font-medium text-gray-700 hover:underline"
            >
                Gérer mes cookies
            </button>
            </div>
        </div>
        </div>
    );
}
