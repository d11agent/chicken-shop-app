const { withMainApplication } = require('expo/config-plugins');

/**
 * Fix WatermelonDB JSI wiring for the React Native New Architecture (bridgeless).
 *
 * Why this exists: `@morrowdigital/watermelondb-expo-plugin` patches MainApplication for the
 * OLD architecture — it injects `import com.facebook.react.bridge.JSIModulePackage` and a
 * `getJSIModulePackage()` override. On RN 0.86 / Expo SDK 57 (always bridgeless New Arch):
 *   - `com.facebook.react.bridge.JSIModulePackage` no longer exists  -> "Unresolved reference"
 *     (this is what broke `:app:compileDebugKotlin` on EAS).
 *   - The new MainApplication uses `reactHost by lazy { ExpoReactHostFactory... }`, so the
 *     old `getJSIModulePackage()` hook is never wired up anyway.
 *
 * Correct New-Arch wiring: `WatermelonDBJSIPackage` is a plain `ReactPackage` that registers the
 * `WMDatabaseJSIBridge` native module. Add it to the autolinked `PackageList(...).packages`
 * block; the JS side (SQLiteAdapter `{ jsi: true }`) then calls its `install()` to load the
 * JSI bindings. This plugin must run AFTER the watermelondb plugin so it cleans up that output.
 */
const WMDB_IMPORT = 'import com.nozbe.watermelondb.jsi.WatermelonDBJSIPackage';
const ADD_PACKAGE = 'add(WatermelonDBJSIPackage())';

module.exports = function withWatermelonNewArch(config) {
  return withMainApplication(config, (cfg) => {
    if (cfg.modResults.language !== 'kt') {
      throw new Error('withWatermelonNewArch: expected a Kotlin (.kt) MainApplication');
    }
    let contents = cfg.modResults.contents;

    // 1) Remove the broken old-arch import (may carry trailing whitespace / semicolon).
    contents = contents.replace(
      /^.*import\s+com\.facebook\.react\.bridge\.JSIModulePackage\s*;?[ \t]*\r?\n/gm,
      '',
    );

    // 2) Remove any old-arch getJSIModulePackage() override the plugin may have added.
    contents = contents.replace(
      /[ \t]*override fun getJSIModulePackage\(\)[\s\S]*?WatermelonDBJSIPackage\(\)\s*\r?\n[ \t]*}\s*\r?\n/g,
      '',
    );

    // 3) Ensure the (valid) WatermelonDBJSIPackage import is present.
    if (!contents.includes(WMDB_IMPORT)) {
      contents = contents.replace(
        /^(import android\.app\.Application.*\r?\n)/m,
        `$1${WMDB_IMPORT}\n`,
      );
    }

    // 4) Register the package in the autolinked packages block (New Arch way).
    if (!contents.includes(ADD_PACKAGE)) {
      const anchor = '// add(MyReactNativePackage())';
      if (!contents.includes(anchor)) {
        throw new Error(
          'withWatermelonNewArch: could not find the PackageList apply anchor in MainApplication',
        );
      }
      contents = contents.replace(anchor, `${anchor}\n          ${ADD_PACKAGE}`);
    }

    cfg.modResults.contents = contents;
    return cfg;
  });
};
