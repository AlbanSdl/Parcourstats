const path = require("path");
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
    target: 'electron14.0-renderer',
    entry: './src/renderer/webview.ts',
    output: {
        filename: 'webview.js',
        path: path.join(__dirname, './build/src/renderer'),
    },
    optimization: {
        minimize: true
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        configFile: "./tsconfig.json"
                    }
                }],
            }
        ]
    },
    resolve: {
        extensions: ['.ts'],
        roots: ['./src/renderer/'],
        preferRelative: true,
        plugins: [new TsconfigPathsPlugin({
            configFile: "./src/renderer/tsconfig.json"
        })]
    }
}