import ts = require("typescript");
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import copyfiles = require("copyfiles");
import webpack = require("webpack");

export async function typescriptCompile(tsconfigLocation: string) {
    let config = await readConfigFile(tsconfigLocation);
    let program = ts.createProgram(config.fileNames, config.options);
    let emitResult = program.emit();
    const diags = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
    const errors = diags.filter(error => error.category === ts.DiagnosticCategory.Error);
    if (errors.length > 0) {
        console.warn("Compilation failed with", errors.length, "errors");
        throw errors;
    }
    else if (diags.length > 0) console.warn("Compilation done with",
        diags.filter(error => error.category === ts.DiagnosticCategory.Warning).length, "warnings",
        diags.filter(error => error.category === ts.DiagnosticCategory.Message).length, "messages",
        diags.filter(error => error.category === ts.DiagnosticCategory.Suggestion).length, "suggestions")
}

async function readConfigFile(configFileName: string) {
    const configFileText = await readFile(configFileName, 'utf8');
    const result = ts.parseConfigFileTextToJson(configFileName, configFileText);
    const configObject = result.config;
    if (!configObject) throw [result.error]
    const configParseResult = ts.parseJsonConfigFileContent(configObject, ts.sys,
        join(ts.sys.getCurrentDirectory(), dirname(configFileName)));
    if (configParseResult.errors.length > 0) throw configParseResult.errors;
    return configParseResult;
}

export async function prepareResources() {
    return new Promise<void>((res, rej) => {
        copyfiles(["src/**/*", "build/src/"], {
            up: 1,
            exclude: [
                "src/**/*.ts",
                "**/tsconfig.json"
            ]
        }, error => !!error ? rej([error]) : res())
    });
}

export async function webpackCompile(production: boolean) {
    return new Promise<void>((res, rej) => {
        const configuration: webpack.Configuration = require('../../webpack.config.js');
        if (!production) configuration.devtool = "inline-source-map";
        configuration.mode = production ? "production" : "development";
        let compiler = webpack(configuration);
        new webpack.ProgressPlugin().apply(compiler);
        compiler.run((err, result) => {
            if (!!err || result.hasErrors()) rej(err ?? result.compilation?.errors)
            else res();
        });
    })
}