/** Electron Forge configuration (ADR 0008). Releases are published by a later spec. */
module.exports = {
  packagerConfig: {
    name: "Dramatis Personae",
    executableName: "dramatis-personae",
    asar: true,
    // Everything runs from the bundle, so only it and package.json ship.
    ignore: (path) => path !== "" && !/^\/(dist(\/|$)|package\.json$)/.test(path),
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      // Squirrel installs into %LOCALAPPDATA%\<name>; the data root must never be there.
      config: {
        name: "DramatisPersonae",
        setupExe: "DramatisPersonaeSetup.exe",
        authors: "Dramatis Personae contributors",
        description: "Character hub and relationship mapping for writers, worldbuilders and fans",
      },
    },
    { name: "@electron-forge/maker-zip", platforms: ["darwin"] },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
      config: { name: "Dramatis Personae" },
    },
  ],
};
