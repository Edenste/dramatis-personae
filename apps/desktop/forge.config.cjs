/** Electron Forge configuration (ADR 0008). Building installers in CI comes later. */
module.exports = {
  packagerConfig: {
    name: "Dramatis Personae",
    executableName: "dramatis-personae",
    asar: true,
    // Everything runs from the bundle, so only it and package.json ship.
    ignore: (path) => path !== "" && !/^\/(dist(\/|$)|package\.json$)/.test(path),
  },
  makers: [
    { name: "@electron-forge/maker-squirrel", platforms: ["win32"] },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    { name: "@electron-forge/maker-dmg", platforms: ["darwin"] },
  ],
};
