module.exports = function (api) {
  api.cache(true);
  return {
    // WatermelonDB models use LEGACY decorators (@field, @date, @text, @children...).
    //
    // Two constraints that must BOTH hold, or the app breaks:
    //  1. Exactly ONE decorators transform. babel-preset-expo (SDK 57) enables legacy decorators
    //     by default; if we ALSO add our own, the duplicate transform crashes Metro on the models'
    //     definite-assignment fields (`name!: string`) — "Definitely assigned fields cannot be
    //     initialized here". So we DISABLE the preset's decorators (`decorators: false`) and own it.
    //  2. class-properties MUST run AFTER decorators. On Hermes, preset-env sees native class-field
    //     support and SKIPS class-properties, which leaves the legacy-decorator placeholder
    //     `_initializerWarningHelper` as the field initializer -> runtime crash "Decorating class
    //     property failed. Please ensure that transform-class-properties ... runs after decorators".
    //     Adding class-properties explicitly (in `plugins`, which run before presets) forces it to
    //     run right after our decorators, producing the correct `_initializerDefineProperty` output.
    //
    // The class-features family (class-properties + private-methods + private-property-in-object)
    // must be enabled TOGETHER and share the SAME `loose` value. React Native's preset configures
    // them with `loose: true`, so we must match — otherwise babel throws "'loose' mode configuration
    // must be the same for ..." (seen under jest) and RN's own private-method classes fail to compile.
    presets: [['babel-preset-expo', { decorators: false }]],
    // IMPORTANT: the class-features plugins above must be scoped to ONLY our WatermelonDB model
    // files via `overrides`, never placed in the top-level `plugins` array. Top-level plugins run
    // unconditionally on every file Metro transforms — including node_modules/react-native itself
    // (RN ships untranspiled modern/Flow syntax in `src/private` for New Architecture builds). RN's
    // own source (e.g. Event.js) declares Flow fields with no initializer (`+NONE: 0;`) purely as
    // type annotations, then locks them down with `Object.defineProperty(..., {writable: false})`.
    // preset-env normally SKIPS class-properties for Hermes targets (native field support), so those
    // declarations never generate runtime code. Forcing loose-mode class-properties globally makes
    // Babel instead emit a real `this.NONE = void 0` assignment in the constructor — loose mode uses
    // `[[Set]]` semantics, which walks the prototype chain and throws on the inherited non-writable
    // property, unlike native class fields (`[[DefineOwnProperty]]`) which bypass it. Hence: "Cannot
    // assign to read-only property 'NONE'" at startup. Scoping to our models directory keeps RN's own
    // files on the default (correct, target-aware) Hermes pipeline.
    //
    // `test` MUST be a function, not a string/RegExp. Expo's Metro babel-transformer calls
    // `babel.loadPartialConfigSync()` once on the main thread with NO filename, purely to enumerate
    // which config files participate (for cache-key purposes) — see @expo/metro-config's
    // babel-transformer.js `getCacheKey`. Babel's pattern matcher throws `ConfigError: Configuration
    // contains string/RegExp pattern, but no filename was passed to Babel` when a string/RegExp
    // `test` is evaluated without a filename, which crashed transformer construction entirely
    // (Metro then threw "Cannot read properties of undefined (reading 'transformFile')" since the
    // transformer was never built). A function pattern is simply invoked with the filename (possibly
    // undefined) instead of being matched internally, so it never hits that code path.
    overrides: [
      {
        test: (filePath) =>
          typeof filePath === 'string' &&
          filePath.replace(/\\/g, '/').includes('/src/db/models/'),
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }],
          ['@babel/plugin-transform-private-property-in-object', { loose: true }],
        ],
      },
    ],
  };
};
