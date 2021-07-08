const path = require("path");
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
    mode: process.env.NODE_ENV ?? "production",
    target: 'electron13.0-renderer',
    devtool: 'inline-source-map',
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
                test: /\.tsx?$/,
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
        extensions: ['.tsx', '.ts'],
        plugins: [new TsconfigPathsPlugin({
            configFile: "./src/renderer/tsconfig.json"
        })]
    }
}