const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const Dotenv = require("dotenv-webpack");
const { ModuleFederationPlugin } = require("webpack").container;
const deps = require("./package.json").dependencies;

module.exports = (_env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: "./src/index.tsx",
    mode: argv.mode || "development",
    output: {
      filename: "bundle.[contenthash].js",
      path: path.resolve(__dirname, "dist"),
      publicPath: "auto",
      clean: true,
    },
    resolve: { extensions: [".tsx", ".ts", ".js", ".jsx"] },
    devServer: {
      port: 3004,
      historyApiFallback: true,
      hot: true,
    },
    module: {
      rules: [
        { test: /\.(ts|tsx)$/, loader: "ts-loader", exclude: /node_modules/ },
        { test: /\.css$/, use: ["style-loader", "css-loader"] },
        { test: /\.(png|jpe?g|gif|svg)$/i, type: "asset/resource" },
      ],
    },
    plugins: [
      new ModuleFederationPlugin({
        name: "marketApp",
        filename: "remoteEntry.js",
        // ── What this MFE exposes to other apps ─────────────────────────────
        // ./App     → full market intelligence page (standalone or routed)
        // ./PriceTicker → compact real-time ticker strip for embedding anywhere
        exposes: {
          "./App": "./src/App",
          "./PriceTicker": "./src/PriceTicker",
        },
        shared: {
          react: { singleton: true, requiredVersion: deps.react },
          "react-dom": { singleton: true, requiredVersion: deps["react-dom"] },
          "react-router-dom": { singleton: true, requiredVersion: deps["react-router-dom"] },
          "firebase/app": { singleton: true, version: "11.0.0", requiredVersion: deps.firebase },
          "firebase/database": { singleton: true, version: "11.0.0", requiredVersion: deps.firebase },
        },
      }),
      new HtmlWebpackPlugin({ template: "./public/index.html" }),
      new Dotenv({ systemvars: true }),
    ],
  };
};
