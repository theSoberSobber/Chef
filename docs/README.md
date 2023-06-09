- The Chef Package Manager is a new way of adding javascript dependencies and avoid the version resolution hell. <br />
- The Chef PM is under heavy development, have a look at the current [todo list](./TODO.md). <br />
- The Specifications for Chef PM can be found [here](./SPECS.md).

---

## Usage
- `npm install` dependencies for chef to work
- `npm run build` to build chef
- then to run chef do `npm run chef`
    - until chef becomes a bit more stable and robust, we won't be putting this on NPM, so a global chef command is not gonna be worked on as of now
    - TIP: alias chef as `npm run chef` and add it to your path if you want
- `npm run chef add <pName>` etc. (see [specs](./SPECS.md) for more info on usage)
- `node ./build/index.js add <pName> --verbose` to use the verbose flag since npm captures it if launched with npm.
