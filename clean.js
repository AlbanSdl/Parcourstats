const fs = require("fs");

const paths = [];
for (let i = 0; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (!arg.startsWith("-"))
        paths.push(arg);
    else {
        switch(arg.slice(1)) {
            default:
                throw new Error(`Unknown flag ${arg}`);
        }
    }
}
for (const path in paths)
    fs.rm(path, {
        force: true,
        recursive: true
    }, () => {})