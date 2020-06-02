const path = require('path')

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'strongcode.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      },
      {
        test: /\.tff$/,
        loader: 'url-loader'
      }
    ]
  }
}
