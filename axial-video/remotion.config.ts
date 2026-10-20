/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("png");
// Use the system Chrome (NixOS path) rather than Remotion's browser download.
Config.setBrowserExecutable(
  process.env.REMOTION_BROWSER_EXECUTABLE ??
    "/run/current-system/sw/bin/google-chrome",
);
Config.setChromeMode("chrome-for-testing");
