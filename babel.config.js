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
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ],
  };
};
