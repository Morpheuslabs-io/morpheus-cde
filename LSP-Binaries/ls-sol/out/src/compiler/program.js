"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const core = require("./core");
const core_1 = require("./core");
const core_2 = require("./core");
const diagnostics_1 = require("./diagnostics");
const moduleNameResolver_1 = require("./moduleNameResolver");
const sys_1 = require("./sys");
const utilities_1 = require("./utilities");
const solparse = require("solparse");
const solc = require("solc");
const Solium = require("solium");
const Solhint = require("solhint/lib");
/**
 * Create a new 'Program' instance. A Program is an immutable collection of 'SourceFile's and a 'CompilerOptions'
 * that represent a compilation unit.
 *
 * Creating a program proceeds from a set of root files, expanding the set of inputs by following imports and
 * triple-slash-reference-path directives transitively. '@types' and triple-slash-reference-types are also pulled in.
 *
 * @param rootNames - A set of root files.
 * @param options - The compiler options which should be used.
 * @param host - The host interacts with the underlying file system.
 * @returns A 'Program' object.
 */
function createProgram(rootNames, options, host) {
    let program;
    const files = [];
    const fileProcessingDiagnostics = [];
    host = host || createCompilerHost(options);
    const currentDirectory = host.getCurrentDirectory();
    let moduleResolutionCache = moduleNameResolver_1.createModuleResolutionCache(currentDirectory, x => host.getCanonicalFileName(x));
    const resolveModuleNamesWorker = (moduleNames, containingFile) => loadWithLocalCache(checkAllDefined(moduleNames), containingFile, loader);
    const hasInvalidatedResolution = host.hasInvalidatedResolution || core_1.returnFalse;
    const loader = (moduleName, containingFile) => moduleNameResolver_1.resolveModuleName(moduleName, containingFile, options, host, moduleResolutionCache).resolvedModule;
    // Map from a stringified PackageId to the source file with that id.
    // Only one source file may have a given packageId. Others become redirects (see createRedirectSourceFile).
    // `packageIdToSourceFile` is only used while building the program, while `sourceFileToPackageName` and `isSourceFileTargetOfRedirect` are kept around.
    const packageIdToSourceFile = core_2.createMap();
    // Maps from a SourceFile's `.path` to the name of the package it was imported with.
    const sourceFileToPackageName = core_2.createMap();
    // See `sourceFileIsRedirectedTo`.
    const redirectTargetsSet = core_2.createMap();
    const filesByName = core_2.createMap();
    let missingFilePaths;
    // stores 'filename -> file association' ignoring case
    // used to track cases when two file names differ only in casing
    const filesByNameIgnoreCase = host.useCaseSensitiveFileNames() ? core_2.createMap() : undefined;
    core_2.forEach(rootNames, name => processRootFile(name));
    missingFilePaths = core_1.arrayFrom(filesByName.keys(), p => p).filter(p => !filesByName.get(p));
    core_2.Debug.assert(!!missingFilePaths);
    // unconditionally set moduleResolutionCache to undefined to avoid unnecessary leaks
    moduleResolutionCache = undefined;
    program = {
        getRootFileNames: () => rootNames,
        getSourceFile,
        getSourceFileByPath,
        getSourceFiles: () => files,
        getMissingFilePaths: () => missingFilePaths,
        getCompilerDiagnostics,
        getSoliumDiagnostics,
        getSolhintDiagnostics,
        getCompilerOptions: () => options,
        getCurrentDirectory: () => currentDirectory,
        getFileProcessingDiagnostics: () => fileProcessingDiagnostics,
        sourceFileToPackageName,
        redirectTargetsSet,
        hasInvalidatedResolution
    };
    return program;
    function toPath(fileName) {
        return core.toPath(fileName, currentDirectory, getCanonicalFileName);
    }
    function getSourceFile(fileName) {
        return getSourceFileByPath(toPath(fileName));
    }
    function getSourceFileByPath(path) {
        return filesByName.get(path);
    }
    function processRootFile(fileName) {
        processSourceFile(core_2.normalizePath(fileName), /*packageId*/ undefined);
    }
    function collectExternalModuleReferences(file) {
        if (file.imports) {
            return;
        }
        const imports = [];
        try {
            const result = solparse.parse(file.text);
            for (const element of result.body) {
                if (element.type !== "ImportStatement") {
                    continue;
                }
                imports.push(element.from);
            }
        }
        catch (err) {
        }
        file.imports = imports || utilities_1.emptyArray;
    }
    function getSourceFileFromReferenceWorker(fileName, getSourceFile, fail, refFile) {
        const sourceFile = getSourceFile(fileName);
        if (fail) {
            if (!sourceFile) {
                fail(undefined, fileName);
            }
            else if (refFile && host.getCanonicalFileName(fileName) === host.getCanonicalFileName(refFile.fileName)) {
                fail(undefined);
            }
        }
        return sourceFile;
    }
    /** This has side effects through `findSourceFile`. */
    function processSourceFile(fileName, packageId, refFile, refRange) {
        getSourceFileFromReferenceWorker(fileName, fileName => findSourceFile(fileName, toPath(fileName), refFile, refRange, packageId), message => {
            fileProcessingDiagnostics.push({
                message,
                severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                range: refRange
            });
        }, refFile);
    }
    function createRedirectSourceFile(redirectTarget, unredirected, fileName, path) {
        const redirect = Object.create(redirectTarget);
        redirect.fileName = fileName;
        redirect.path = path;
        redirect.redirectInfo = { redirectTarget, unredirected };
        return redirect;
    }
    // Get source file from normalized fileName
    function findSourceFile(fileName, path, refFile, refRange, packageId) {
        if (filesByName.has(path)) {
            return filesByName.get(path);
        }
        // We haven't looked for this file, do so now and cache result
        const file = host.getSourceFile(fileName, hostErrorMessage => {
            fileProcessingDiagnostics.push({
                message: `Cannot read file ${fileName}:${hostErrorMessage}`,
                severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                range: refRange
            });
        }, true);
        if (packageId) {
            const packageIdKey = `${packageId.name}/${packageId.subModuleName}@${packageId.version}`;
            const fileFromPackageId = packageIdToSourceFile.get(packageIdKey);
            if (fileFromPackageId) {
                // Some other SourceFile already exists with this package name and version.
                // Instead of creating a duplicate, just redirect to the existing one.
                const dupFile = createRedirectSourceFile(fileFromPackageId, file, fileName, path);
                redirectTargetsSet.set(fileFromPackageId.path, true);
                filesByName.set(path, dupFile);
                sourceFileToPackageName.set(path, packageId.name);
                files.push(dupFile);
                return dupFile;
            }
            else if (file) {
                // This is the first source file to have this packageId.
                packageIdToSourceFile.set(packageIdKey, file);
                sourceFileToPackageName.set(path, packageId.name);
            }
        }
        filesByName.set(path, file);
        if (file) {
            file.path = path;
            if (host.useCaseSensitiveFileNames()) {
                const pathLowerCase = path.toLowerCase();
                // for case-sensitive file systems check if we've already seen some file with similar filename ignoring case
                const existingFile = filesByNameIgnoreCase.get(pathLowerCase);
                if (existingFile) {
                    reportFileNamesDifferOnlyInCasingError(fileName, existingFile.fileName, refFile, refRange);
                }
                else {
                    filesByNameIgnoreCase.set(pathLowerCase, file);
                }
            }
            // always process imported modules to record module name resolutions
            processImportedModules(file);
            files.push(file);
        }
        return file;
    }
    function reportFileNamesDifferOnlyInCasingError(fileName, existingFileName, _refFile, refRange) {
        fileProcessingDiagnostics.push({
            message: `File name ${fileName} differs from already included file name ${existingFileName} only in casing`,
            severity: vscode_languageserver_1.DiagnosticSeverity.Error,
            range: refRange
        });
    }
    function getCanonicalFileName(fileName) {
        return host.getCanonicalFileName(fileName);
    }
    function processImportedModules(file) {
        collectExternalModuleReferences(file);
        if (file.imports.length) {
            const moduleNames = getModuleNames(file);
            const resolutions = resolveModuleNamesWorker(moduleNames, core_2.getNormalizedAbsolutePath(file.fileName, currentDirectory));
            core_2.Debug.assert(resolutions.length === moduleNames.length);
            for (let i = 0; i < moduleNames.length; i++) {
                const resolution = resolutions[i];
                utilities_1.setResolvedModule(file, moduleNames[i], resolution);
                if (!resolution) {
                    continue;
                }
                const resolvedFileName = resolution.resolvedFileName;
                const path = toPath(resolvedFileName);
                // FIXME: Retrieve refRange from file.imports.
                findSourceFile(resolvedFileName, path, file, undefined, resolution.packageId);
            }
        }
        else {
            // no imports - drop cached module resolutions
            file.resolvedModules = undefined;
        }
    }
    function getDiagnosticsHelper(sourceFile, getDiagnostics, cancellationToken, ...rest) {
        if (sourceFile) {
            return getDiagnostics(sourceFile, cancellationToken, ...rest);
        }
        return core_1.sortAndDeduplicateDiagnostics(core_1.flatMap(program.getSourceFiles(), sourceFile => {
            if (cancellationToken) {
                cancellationToken.throwIfCancellationRequested();
            }
            return getDiagnostics(sourceFile, cancellationToken, ...rest);
        }));
    }
    function getCompilerDiagnostics(sourceFile, cancellationToken) {
        return getDiagnosticsHelper(sourceFile, getCompilerDiagnosticsForFile, cancellationToken);
    }
    function getSoliumDiagnostics(sourceFile, cancellationToken, soliumRules) {
        return getDiagnosticsHelper(sourceFile, getSoliumDiagnosticsForFile, cancellationToken, soliumRules);
    }
    function getSolhintDiagnostics(sourceFile, cancellationToken, solhintRules) {
        return getDiagnosticsHelper(sourceFile, getSolhintDiagnosticsForFile, cancellationToken, solhintRules);
    }
    function getCompilerDiagnosticsForFile(sourceFile) {
        const input = { [sourceFile.fileName]: { content: sourceFile.text } };
        collectSources(sourceFile);
        return compileContracts(input);
        function collectSources(sourceFile) {
            if (sourceFile.resolvedModules) {
                sourceFile.resolvedModules.forEach(resolved => {
                    if (resolved) {
                        const sourceFile = program.getSourceFileByPath(toPath(resolved.resolvedFileName));
                        const moduleName = resolved.packageId ? `${resolved.packageId.name}/${resolved.packageId.subModuleName}` : sourceFile.fileName;
                        input[moduleName] = { content: sourceFile.text };
                        collectSources(sourceFile);
                    }
                });
            }
        }
        function compileContracts(sources) {
            const solcStandardInput = {
                language: "Solidity",
                sources,
                settings: {
                    optimizer: options.optimizer,
                    remappings: options.remappings,
                    outputSelection: {
                        "*": {
                            "*": [
                                "abi",
                                "ast",
                                "evm.bytecode.object",
                                "evm.bytecode.sourceMap",
                                "evm.deployedBytecode.object",
                                "evm.deployedBytecode.sourceMap"
                            ]
                        },
                    }
                }
            };
            const result = solc.compileStandard(JSON.stringify(solcStandardInput));
            const standardOutput = JSON.parse(result);
            const errors = standardOutput.errors || [];
            return errors.map((error) => diagnostics_1.solcErrToDiagnostic(error));
        }
    }
    function getSoliumDiagnosticsForFile(sourceFile, soliumRules) {
        try {
            const errorObjects = Solium.lint(sourceFile.text, { rules: soliumRules });
            return errorObjects.map(diagnostics_1.soliumErrObjectToDiagnostic);
        }
        catch (err) {
            const match = /An error .*?\nSyntaxError: (.*?) Line: (\d+), Column: (\d+)/.exec(err.message);
            if (!match) {
                // FIXME: Send an error message.
                return [];
            }
            const line = parseInt(match[2], 10) - 1;
            const character = parseInt(match[3], 10) - 1;
            return [
                {
                    message: `Syntax error: ${match[1]}`,
                    range: {
                        start: { character, line },
                        end: { character, line }
                    },
                    severity: vscode_languageserver_1.DiagnosticSeverity.Error,
                },
            ];
        }
    }
    function getSolhintDiagnosticsForFile(sourceFile, solhintRules) {
        const errorObjects = Solhint.processStr(sourceFile.text, solhintRules).messages;
        return errorObjects.map(diagnostics_1.solhintErrObjectToDiagnostic);
    }
}
exports.createProgram = createProgram;
function checkAllDefined(names) {
    core_2.Debug.assert(names.every(name => name !== undefined), "A name is undefined.", () => JSON.stringify(names));
    return names;
}
function getModuleNames({ imports }) {
    const res = imports.map(i => i);
    return res;
}
function loadWithLocalCache(names, containingFile, loader) {
    if (names.length === 0) {
        return [];
    }
    const resolutions = [];
    const cache = core_2.createMap();
    for (const name of names) {
        let result;
        if (cache.has(name)) {
            result = cache.get(name);
        }
        else {
            cache.set(name, result = loader(name, containingFile));
        }
        resolutions.push(result);
    }
    return resolutions;
}
function createCompilerHost(_options) {
    const existingDirectories = core_2.createMap();
    function getCanonicalFileName(fileName) {
        // if underlying system can distinguish between two files whose names differs only in cases then file name already in canonical form.
        // otherwise use toLowerCase as a canonical form.
        return sys_1.sys.useCaseSensitiveFileNames ? fileName : fileName.toLowerCase();
    }
    function getSourceFile(fileName, onError) {
        let text;
        try {
            text = sys_1.sys.readFile(fileName);
        }
        catch (e) {
            if (onError) {
                onError(e.message);
            }
            text = "";
        }
        return text !== undefined ? createSourceFile(fileName, text) : undefined;
    }
    function directoryExists(directoryPath) {
        if (existingDirectories.has(directoryPath)) {
            return true;
        }
        if (sys_1.sys.directoryExists(directoryPath)) {
            existingDirectories.set(directoryPath, true);
            return true;
        }
        return false;
    }
    function ensureDirectoriesExist(directoryPath) {
        if (directoryPath.length > core_1.getRootLength(directoryPath) && !directoryExists(directoryPath)) {
            const parentDirectory = core_1.getDirectoryPath(directoryPath);
            ensureDirectoriesExist(parentDirectory);
            sys_1.sys.createDirectory(directoryPath);
        }
    }
    const realpath = sys_1.sys.realpath && ((path) => sys_1.sys.realpath(path));
    return {
        getSourceFile,
        getCurrentDirectory: core_1.memoize(() => sys_1.sys.getCurrentDirectory()),
        useCaseSensitiveFileNames: () => sys_1.sys.useCaseSensitiveFileNames,
        getCanonicalFileName,
        fileExists: fileName => sys_1.sys.fileExists(fileName),
        readFile: fileName => sys_1.sys.readFile(fileName),
        trace: (s) => sys_1.sys.write(s + "\n"),
        directoryExists: directoryName => sys_1.sys.directoryExists(directoryName),
        getDirectories: (path) => sys_1.sys.getDirectories(path),
        realpath
    };
}
exports.createCompilerHost = createCompilerHost;
function createSourceFile(fileName, sourceText) {
    return {
        fileName,
        text: sourceText
    };
}
exports.createSourceFile = createSourceFile;
/**
 * Determines if program structure is upto date or needs to be recreated
 */
/* @internal */
function isProgramUptoDate(program, rootFileNames, newOptions, getSourceVersion, fileExists, hasInvalidatedResolution) {
    // If we haven't create a program yet or has changed automatic type directives, then it is not up-to-date
    if (!program) {
        return false;
    }
    // If number of files in the program do not match, it is not up-to-date
    if (program.getRootFileNames().length !== rootFileNames.length) {
        return false;
    }
    // If any file is not up-to-date, then the whole program is not up-to-date
    if (program.getSourceFiles().some(sourceFileNotUptoDate)) {
        return false;
    }
    // If any of the missing file paths are now created
    if (program.getMissingFilePaths().some(fileExists)) {
        return false;
    }
    const currentOptions = program.getCompilerOptions();
    // If the compilation settings do no match, then the program is not up-to-date
    if (!utilities_1.compareDataObjects(currentOptions, newOptions)) {
        return false;
    }
    return true;
    function sourceFileNotUptoDate(sourceFile) {
        return sourceFile.version !== getSourceVersion(sourceFile.path) ||
            hasInvalidatedResolution(sourceFile.path);
    }
}
exports.isProgramUptoDate = isProgramUptoDate;
//# sourceMappingURL=program.js.map