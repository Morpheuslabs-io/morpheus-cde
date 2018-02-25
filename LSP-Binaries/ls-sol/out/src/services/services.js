"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("../compiler/core");
const moduleNameResolver_1 = require("../compiler/moduleNameResolver");
const program_1 = require("../compiler/program");
const types_1 = require("../compiler/types");
const completions = require("./completions");
function createLanguageService(host) {
    let program;
    let lastProjectVersion;
    const useCaseSensitivefileNames = host.useCaseSensitiveFileNames && host.useCaseSensitiveFileNames();
    const cancellationToken = new CancellationTokenObject(host.getCancellationToken && host.getCancellationToken());
    const getCanonicalFileName = core_1.createGetCanonicalFileName(useCaseSensitivefileNames);
    const currentDirectory = host.getCurrentDirectory();
    function getValidSourceFile(fileName) {
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) {
            throw new Error("Could not find file: '" + fileName + "'.");
        }
        return sourceFile;
    }
    function synchronizeHostData() {
        // perform fast check if host supports it
        if (host.getProjectVersion) {
            const hostProjectVersion = host.getProjectVersion();
            if (hostProjectVersion) {
                if (lastProjectVersion === hostProjectVersion) {
                    return;
                }
                lastProjectVersion = hostProjectVersion;
            }
        }
        const hasInvalidatedResolution = host.hasInvalidatedResolution || core_1.returnFalse;
        // Get a fresh cache of the host information
        let hostCache = new HostCache(host, getCanonicalFileName);
        const rootFileNames = hostCache.getRootFileNames();
        // If the program is already up-to-date, we can reuse it
        if (program_1.isProgramUptoDate(program, rootFileNames, host.getCompilationSettings(), path => host.getScriptVersion(path), host.fileExists, hasInvalidatedResolution)) {
            return;
        }
        const newSettings = hostCache.compilationSettings();
        // Now create a new compiler
        const compilerHost = {
            getSourceFile: getOrCreateSourceFile,
            getSourceFileByPath: getOrCreateSourceFileByPath,
            getCancellationToken: () => cancellationToken,
            getCanonicalFileName,
            useCaseSensitiveFileNames: () => useCaseSensitivefileNames,
            getCurrentDirectory: () => currentDirectory,
            fileExists,
            readFile(fileName) {
                return host.readFile && host.readFile(fileName);
            },
            directoryExists: (directoryName) => {
                return moduleNameResolver_1.directoryProbablyExists(directoryName, host);
            },
            getDirectories: (path) => {
                return host.getDirectories ? host.getDirectories(path) : [];
            },
            hasInvalidatedResolution
        };
        if (host.trace) {
            compilerHost.trace = (message) => host.trace(message);
        }
        // IMPORTANT - It is critical from this moment onward that we do not check
        // cancellation tokens.  We are about to mutate source files from a previous program
        // instance.  If we cancel midway through, we may end up in an inconsistent state where
        // the program points to old source files that have been invalidated because of
        // incremental parsing.
        program = program_1.createProgram(rootFileNames, newSettings, compilerHost);
        // hostCache is captured in the closure for 'getOrCreateSourceFile' but it should not be used past this point.
        // It needs to be cleared to allow all collected snapshots to be released
        hostCache = undefined;
        return;
        function fileExists(fileName) {
            const path = core_1.toPath(fileName, currentDirectory, getCanonicalFileName);
            const entry = hostCache.getEntryByPath(path);
            return entry ?
                !core_1.isString(entry) :
                (host.fileExists && host.fileExists(fileName));
        }
        function getOrCreateSourceFile(fileName, onError, shouldCreateNewSourceFile) {
            return getOrCreateSourceFileByPath(fileName, core_1.toPath(fileName, currentDirectory, getCanonicalFileName), onError, shouldCreateNewSourceFile);
        }
        function getOrCreateSourceFileByPath(fileName, path, _onError, _shouldCreateNewSourceFile) {
            core_1.Debug.assert(hostCache !== undefined);
            // The program is asking for this file, check first if the host can locate it.
            // If the host can not locate the file, then it does not exist. return undefined
            // to the program to allow reporting of errors for missing files.
            const hostFileInformation = hostCache.getOrCreateEntryByPath(fileName, path);
            if (!hostFileInformation) {
                return undefined;
            }
            const text = host.readFile(path);
            return program_1.createSourceFile(fileName, text);
        }
    }
    function getProgram() {
        synchronizeHostData();
        return program;
    }
    function getCompletionsAtPosition(fileName, position) {
        return completions.getCompletionsAtPosition(host, fileName, position);
    }
    /// Diagnostics
    function getCompilerDiagnostics(fileName) {
        synchronizeHostData();
        return program.getCompilerDiagnostics(getValidSourceFile(fileName), cancellationToken).slice();
    }
    function getSoliumDiagnostics(fileName, soliumRules) {
        synchronizeHostData();
        return program.getSoliumDiagnostics(getValidSourceFile(fileName), cancellationToken, soliumRules).slice();
    }
    function getSolhintDiagnostics(fileName, soliumRules) {
        synchronizeHostData();
        return program.getSolhintDiagnostics(getValidSourceFile(fileName), cancellationToken, soliumRules).slice();
    }
    return {
        getProgram,
        getCompletionsAtPosition,
        getCompilerDiagnostics,
        getSoliumDiagnostics,
        getSolhintDiagnostics
    };
}
exports.createLanguageService = createLanguageService;
class CancellationTokenObject {
    constructor(cancellationToken) {
        this.cancellationToken = cancellationToken;
    }
    isCancellationRequested() {
        return this.cancellationToken && this.cancellationToken.isCancellationRequested();
    }
    throwIfCancellationRequested() {
        if (this.isCancellationRequested()) {
            throw new types_1.OperationCanceledException();
        }
    }
}
// Cache host information about script Should be refreshed
// at each language service public entry point, since we don't know when
// the set of scripts handled by the host changes.
class HostCache {
    constructor(host, getCanonicalFileName) {
        this.host = host;
        // script id => script index
        this.currentDirectory = host.getCurrentDirectory();
        this.fileNameToEntry = core_1.createMap();
        // Initialize the list with the root file names
        const rootFileNames = host.getScriptFileNames();
        for (const fileName of rootFileNames) {
            this.createEntry(fileName, core_1.toPath(fileName, this.currentDirectory, getCanonicalFileName));
        }
        // store the compilation settings
        this._compilationSettings = host.getCompilationSettings() || getDefaultCompilerOptions();
    }
    compilationSettings() {
        return this._compilationSettings;
    }
    createEntry(fileName, path) {
        let entry;
        entry = {
            hostFileName: fileName,
            version: this.host.getScriptVersion(fileName)
        };
        this.fileNameToEntry.set(path, entry);
        return entry;
    }
    getEntryByPath(path) {
        return this.fileNameToEntry.get(path);
    }
    getHostFileInformation(path) {
        const entry = this.fileNameToEntry.get(path);
        return !core_1.isString(entry) ? entry : undefined;
    }
    getOrCreateEntryByPath(fileName, path) {
        const info = this.getEntryByPath(path) || this.createEntry(fileName, path);
        return core_1.isString(info) ? undefined : info;
    }
    getRootFileNames() {
        return core_1.arrayFrom(this.fileNameToEntry.values(), entry => {
            return core_1.isString(entry) ? entry : entry.hostFileName;
        });
    }
    getVersion(path) {
        const file = this.getHostFileInformation(path);
        return file && file.version;
    }
}
function getDefaultCompilerOptions() {
    return {
        optimizer: {
            enabled: false
        }
    };
}
exports.getDefaultCompilerOptions = getDefaultCompilerOptions;
//# sourceMappingURL=services.js.map