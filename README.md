# ZAT Server Webpack Plugin

Webpack plugin for Zendesk app development with [Zendesk apps tools](https://developer.zendesk.com/documentation/apps/app-developer-guide/zat). It automatically spawns [ZAT server](https://developer.zendesk.com/documentation/apps/app-developer-guide/zat/#server), and restarts it when its config file or app manifest change.

Requires `zat` installed and available on PATH: https://developer.zendesk.com/documentation/apps/zendesk-app-tools-zat/installing-and-using-the-zendesk-apps-tools

## Installation

```sh
npm i -D zat-server-webpack-plugin
```

## Usage

```js
// webpack dev config

const ZATServerPlugin = require("zat-server-webpack-plugin")

module.exports = {
    mode: "development",
    plugins: [new ZATServerPlugin(options)],
}
```

### Options

Any provided options are parsed and passed them directly as `zat` args:

```js
new ZATServerPlugin({
    path: "dist",
    appId: 0,
    unattended: undefined,
})
```

```sh
zat server --path dist --app-id 0 --unattended
```

For the full list of available options run:

```sh
zat help server
```
