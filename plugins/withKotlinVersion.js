const { withProjectBuildGradle } = require('expo/config-plugins');

/**
 * Guarantee a supported Kotlin version for Expo SDK 57 modules.
 *
 * Why this exists: `expo-build-properties` only writes `android.kotlinVersion` to
 * gradle.properties. Expo SDK 57's `expo-root-project` plugin resolves Kotlin from the
 * `expoLibs` version catalog / `rootProject.ext.kotlinVersion` (it uses `setIfNotExist`),
 * and its KSPLookup only supports Kotlin >= 2.1.20. To make the version deterministic
 * regardless of catalog/property/cache resolution, we set `ext.kotlinVersion` in the root
 * build.gradle *before* `apply plugin: "expo-root-project"`, so setIfNotExist keeps ours.
 */
const KOTLIN_VERSION = '2.1.20';
const EXPO_ROOT_APPLY = 'apply plugin: "expo-root-project"';

module.exports = function withKotlinVersion(config) {
  return withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('withKotlinVersion: expected a groovy root build.gradle');
    }
    let contents = cfg.modResults.contents;
    if (contents.includes('ext.kotlinVersion =')) return cfg; // idempotent

    if (!contents.includes(EXPO_ROOT_APPLY)) {
      throw new Error('withKotlinVersion: could not find the expo-root-project apply line');
    }
    contents = contents.replace(
      EXPO_ROOT_APPLY,
      `ext.kotlinVersion = "${KOTLIN_VERSION}"\n\n${EXPO_ROOT_APPLY}`,
    );
    cfg.modResults.contents = contents;
    return cfg;
  });
};
