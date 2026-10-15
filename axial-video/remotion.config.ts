/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("png");
// This workstation already has Chromium; the bundled browser download failed TLS.
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER_EXECUTABLE ?? "/usr/bin/chromium",
);
