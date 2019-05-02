
// webpack.config.js
// Configure CSS processing & injection
var webpack = require('webpack');
var path = require('path');

module.exports = {
    entry: "./app/js/app.js",
    output: {
        path: __dirname + "/build/app/js", 
        filename: "app.js"
    },
    module: {
        rules: [
            {
                // Uses regex to test for a file type - in this case, ends with `.css`
                test: /\.css$/,
                // Apply these loaders if test returns true
                use: ['style-loader', 'css-loader']
            }
        ]
    }
};
