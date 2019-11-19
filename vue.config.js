module.exports = {
  publicPath: '/',

  // where to output built files
  outputDir: 'dist',

  configureWebpack: {
    output: {
      publicPath: '/',
      filename: 'build.js',
      chunkFilename: 'chunks.js',
      library: 'lambda',
      libraryTarget: 'umd'
    },
    entry: {
      app: './src/index.js'
    }
  },

  css: {
    extract: {
      filename: 'build.css',
      chunkFilename: '[name].css',
    },
  },

  chainWebpack: config => {
    config.externals({
      'vue': 'Vue',
      'pino': 'pino'
    })
  }
}
