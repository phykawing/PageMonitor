import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
import {getLocales} from 'react-native-localize';

import en from './en.json';
import zhHant from './zh-Hant.json';

const resources = {
  en: {translation: en},
  'zh-Hant': {translation: zhHant},
  zh: {translation: zhHant}, // fallback for zh variants
};

function detectLanguage(): string {
  const locales = getLocales();
  for (const locale of locales) {
    const {languageCode, scriptCode, countryCode} = locale;
    // Traditional Chinese: zh-Hant, zh-TW, zh-HK, zh-MO
    if (languageCode === 'zh') {
      if (
        scriptCode === 'Hant' ||
        countryCode === 'TW' ||
        countryCode === 'HK' ||
        countryCode === 'MO'
      ) {
        return 'zh-Hant';
      }
    }
    if (languageCode === 'en') {
      return 'en';
    }
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  compatibilityJSON: 'v4',
});

export default i18n;
