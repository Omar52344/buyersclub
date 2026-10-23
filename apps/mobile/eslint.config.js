// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Las pantallas cargan datos en efectos y actualizan loading/error al
      // iniciar la petición. Es el patrón usado en toda la app; se mantiene
      // como aviso para detectar setState síncronos accidentales.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ignores: ['dist/*'],
  },
]);
