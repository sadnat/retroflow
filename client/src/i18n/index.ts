import { en, Translations } from './en';

// For now, we only support English. 
// To add more languages, create new files (e.g., fr.ts) and add them here.
const translations: Record<string, Translations> = {
    en,
};

let currentLanguage = 'en';

export const setLanguage = (lang: string) => {
    if (translations[lang]) {
        currentLanguage = lang;
    }
};

export const getLanguage = () => currentLanguage;

export const t = translations[currentLanguage];

// Helper to get nested translation values
export const translate = (key: string): string => {
    const keys = key.split('.');
    let value: any = translations[currentLanguage];
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return key; // Return key if translation not found
        }
    }
    
    return typeof value === 'string' ? value : key;
};

export { en };
export type { Translations };
