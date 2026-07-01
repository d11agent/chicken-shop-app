module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // WatermelonDB models use legacy decorators (@field, @relation, @date...).
    plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
  };
};
