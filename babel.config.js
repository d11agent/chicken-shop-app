module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo (SDK 57) already enables LEGACY decorators by default, which is
    // exactly what WatermelonDB models need (@field, @relation, @date, @text...).
    // Do NOT also add @babel/plugin-proposal-decorators manually — the duplicate decorator
    // transform crashes on definite-assignment fields (`name!: string`) with:
    //   "Definitely assigned fields cannot be initialized here, but only in the constructor".
    presets: ['babel-preset-expo'],
  };
};
