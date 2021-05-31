const path = require("path");

module.exports = {
    mode: process.env.NODE_ENV ?? "production",
    target: 'electron13.0-renderer',
    entry: './build/raw/view/webview.js',
    output: {
        filename: 'webview.js',
        path: path.join(__dirname, './build/raw/view'),
    },
    optimization: {
        minimize: true
    },
    module: {
        rules: [
            {
                test: /\.(svg|woff2|png)$/,
                use: {
                    loader: 'url-loader',
                },
            },
            {
                test: /\.xml$/,
                use: {
                    loader: 'url-loader',
                    options: {
                        encoding: 'utf8'
                    }
                }
            }
        ],
    }
};