const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const base = require('./app.json').expo;

/**
 * Config dinámica: las API keys viven en .env (ignorado por git), nunca en
 * app.json ni en el repositorio.
 */
module.exports = ({ config }) => {
  const merged = { ...base, ...config };
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const easProjectId = process.env.EAS_PROJECT_ID;

  const androidConfig = { ...(merged.android?.config ?? {}) };
  if (apiKey) {
    androidConfig.googleMaps = { apiKey };
  }

  const iosConfig = { ...(merged.ios?.config ?? {}) };
  if (apiKey) {
    iosConfig.googleMapsApiKey = apiKey;
  }

  return {
    ...merged,
    android: { ...merged.android, config: androidConfig },
    ios: { ...merged.ios, config: iosConfig },
    extra: {
      ...(merged.extra ?? {}),
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  };
};
