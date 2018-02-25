"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("@reactivex/rxjs");
const glob = require("glob");
const iterare_1 = require("iterare");
const core_1 = require("../compiler/core");
const moduleNameResolver_1 = require("../compiler/moduleNameResolver");
const preProcess_1 = require("../services/preProcess");
const services_1 = require("../services/services");
const logging_1 = require("./logging");
const utilities_1 = require("./utilities");
class ProjectManager {
    /**
     * @param rootPath root path as passed to `initialize`
     * @param inMemoryFileSystem File system that keeps structure and contents in memory
     */
    constructor(rootPath, inMemoryFileSystem, updater, compilerOptions, logger = new logging_1.NoopLogger()) {
        this.logger = logger;
        /**
         * (Workspace subtree (folder) -> Solidity configuration) mapping.
         * Configuration settings for a source file A are located in the closest parent folder of A.
         * Map keys are relative (to workspace root) paths
         */
        this.configs = new Map();
        /**
         * A URI Map from file to files referenced by the file, so files only need to be pre-processed once
         */
        this.referencedFiles = new Map();
        this.rootPath = rootPath;
        this.updater = updater;
        this.inMemoryFs = inMemoryFileSystem;
        this.versions = new Map();
        const trimmedRootPath = this.rootPath.replace(/\/+$/, "");
        const solidityConfig = {
            compilerOptions,
            include: ["**/*.sol"]
        };
        const config = new ProjectConfiguration(this.inMemoryFs, trimmedRootPath, this.versions, solidityConfig, this.logger);
        this.configs.set(trimmedRootPath, config);
    }
    /**
     * @return local side of file content provider which keeps cached copies of fethed files
     */
    getFs() {
        return this.inMemoryFs;
    }
    /**
     * @param filePath file path (both absolute or relative file paths are accepted)
     * @return true if there is a fetched file with a given path
     */
    hasFile(filePath) {
        return this.inMemoryFs.fileExists(filePath);
    }
    /**
     * @return all sub-projects we have identified for a given workspace.
     * Sub-project is mainly a folder which contains tsconfig.json, jsconfig.json, package.json,
     * or a root folder which serves as a fallback
     */
    configurations() {
        return iterare_1.default(this.configs.values());
    }
    /**
     * @param filePath source file path, absolute
     * @return project configuration for a given source file. Climbs directory tree up to workspace root if needed
     */
    getConfiguration(filePath) {
        const config = this.getConfigurationIfExists(filePath);
        if (!config) {
            throw new Error(`Solidity config file for ${filePath} not found`);
        }
        return config;
    }
    /**
     * @param filePath source file path, absolute
     * @return closest configuration for a given file path or undefined if there is no such configuration
     */
    getConfigurationIfExists(filePath) {
        let dir = utilities_1.toUnixPath(filePath);
        let config;
        const configs = this.configs;
        const rootPath = this.rootPath.replace(/\/+$/, "");
        while (dir && dir !== rootPath) {
            config = configs.get(dir);
            if (config) {
                return config;
            }
            const pos = dir.lastIndexOf("/");
            if (pos <= 0) {
                dir = "";
            }
            else {
                dir = dir.substring(0, pos);
            }
        }
        return configs.get(rootPath);
    }
    /**
     * Returns the ProjectConfiguration a file belongs to
     */
    getParentConfiguration(uri) {
        return this.getConfigurationIfExists(utilities_1.uri2path(uri));
    }
    /**
     * Returns all ProjectConfigurations contained in the given directory or one of its childrens
     *
     * @param uri URI of a directory
     */
    getChildConfigurations(uri) {
        const pathPrefix = utilities_1.uri2path(uri);
        return iterare_1.default(this.configs)
            .filter(([folderPath, _]) => folderPath.startsWith(pathPrefix))
            .map(([_, config]) => config);
    }
    /**
     * Called when file was opened by client. Current implementation
     * does not differenciates open and change events
     * @param uri file's URI
     * @param text file's content
     */
    didOpen(uri, text) {
        this.didChange(uri, text);
    }
    /**
     * Called when file was closed by client. Current implementation invalidates compiled version
     * @param uri file's URI
     */
    didClose(uri) {
        const filePath = utilities_1.uri2path(uri);
        this.inMemoryFs.didClose(uri);
        let version = this.versions.get(uri) || 0;
        this.versions.set(uri, ++version);
        const config = this.getConfigurationIfExists(filePath);
        if (!config) {
            return;
        }
        config.ensureConfigFile();
        config.getHost().incProjectVersion();
    }
    /**
     * Called when file was changed by client. Current implementation invalidates compiled version
     * @param uri file's URI
     * @param text file's content
     */
    didChange(uri, text) {
        const filePath = utilities_1.uri2path(uri);
        this.inMemoryFs.didChange(uri, text);
        let version = this.versions.get(uri) || 0;
        this.versions.set(uri, ++version);
        const config = this.getConfigurationIfExists(filePath);
        if (!config) {
            return;
        }
        config.ensureConfigFile();
        config.ensureSourceFile(filePath);
        config.getHost().incProjectVersion();
    }
    /**
     * Called when file was saved by client
     * @param uri file's URI
     */
    didSave(uri) {
        this.inMemoryFs.didSave(uri);
    }
    /**
     * Ensures that the module structure of the project exists in memory.
     * Solidity module structure is determined by package.json.
     * Then creates new ProjectConfigurations, resets existing and invalidates
     * file references.
     */
    ensureModuleStructure() {
        if (!this.ensuredModuleStructure) {
            this.ensuredModuleStructure = this.updater.ensureStructure()
                .concat(rxjs_1.Observable.defer(() => utilities_1.observableFromIterable(this.inMemoryFs.uris())))
                .filter(uri => core_1.isPackageJsonFile(uri) || core_1.isEthPmJsonFile(uri))
                .mergeMap(uri => this.updater.ensure(uri))
                .do(core_1.noop, (_err) => {
                this.ensuredModuleStructure = undefined;
            }, () => {
                // Reset all compilation state
                // TODO ze incremental compilation instead
                for (const config of this.configurations()) {
                    config.reset();
                }
                // Require re-processing of file references
                this.invalidateReferencedFiles();
            })
                .publishReplay()
                .refCount();
        }
        return this.ensuredModuleStructure;
    }
    /**
     * Ensures all files were fetched from the remote file system.
     * Invalidates project configurations after execution
     */
    ensureAllFiles() {
        if (!this.ensuredAllFiles) {
            this.ensuredAllFiles = this.updater.ensureStructure()
                .concat(rxjs_1.Observable.defer(() => utilities_1.observableFromIterable(this.inMemoryFs.uris())))
                .filter(uri => core_1.isSolidityFile(uri) || core_1.isPackageJsonFile(uri))
                .mergeMap(uri => this.updater.ensure(uri))
                .do(core_1.noop, (_err) => {
                this.ensuredAllFiles = undefined;
            })
                .publishReplay()
                .refCount();
        }
        return this.ensuredAllFiles;
    }
    /**
     * Ensures all files not in node_modules were fetched.
     * This includes all js/ts files, tsconfig files and package.json files.
     * Invalidates project configurations after execution
     */
    ensureOwnFiles() {
        if (!this.ensuredOwnFiles) {
            this.ensuredOwnFiles = this.updater.ensureStructure()
                .concat(rxjs_1.Observable.defer(() => utilities_1.observableFromIterable(this.inMemoryFs.uris())))
                .filter((uri) => !uri.includes("/node_modules/") && core_1.isSolidityFile(uri) || core_1.isPackageJsonFile(uri))
                .mergeMap((uri) => this.updater.ensure(uri))
                .do(core_1.noop, (_err) => {
                this.ensuredOwnFiles = undefined;
            })
                .publishReplay()
                .refCount();
        }
        return this.ensuredOwnFiles;
    }
    /**
     * Recursively collects file(s) dependencies up to given level.
     * Dependencies are extracted by TS compiler from import and reference statements
     *
     * Dependencies include:
     * - all the configuration files
     * - files referenced by the given file
     * - files included by the given file
     *
     * The return values of this method are not cached, but those of the file fetching and file processing are.
     *
     * @param uri File to process
     * @param maxDepth Stop collecting when reached given recursion level
     * @param ignore Tracks visited files to prevent cycles
     * @param childOf OpenTracing parent span for tracing
     * @return Observable of file URIs ensured
     */
    ensureReferencedFiles(uri, maxDepth = 30, ignore = new Set()) {
        ignore.add(uri);
        return this.ensureModuleStructure()
            .concat(rxjs_1.Observable.defer(() => maxDepth === 0 ? rxjs_1.Observable.empty() : this.resolveReferencedFiles(uri)))
            .filter(referencedUri => !ignore.has(referencedUri))
            .mergeMap(referencedUri => this.ensureReferencedFiles(referencedUri, maxDepth - 1, ignore)
            .catch((err) => {
            this.logger.error(`Error resolving file references for ${uri}:`, err);
            return [];
        }));
    }
    /**
     * Returns the files that are referenced from a given file.
     * If the file has already been processed, returns a cached value.
     *
     * @param uri URI of the file to process
     * @return URIs of files referenced by the file
     */
    resolveReferencedFiles(uri) {
        let observable = this.referencedFiles.get(uri);
        if (observable) {
            return observable;
        }
        observable = this.updater.ensure(uri)
            .concat(rxjs_1.Observable.defer(() => {
            const referencingFilePath = utilities_1.uri2path(uri);
            const config = this.getConfiguration(referencingFilePath);
            config.ensureConfigFile();
            const contents = this.inMemoryFs.getContent(uri);
            const info = preProcess_1.preProcessFile(contents);
            const compilerOpt = config.getHost().getCompilationSettings();
            // Iterate imported files
            return rxjs_1.Observable.from(info.importedFiles)
                .map(importedFile => moduleNameResolver_1.resolveModuleName(importedFile.fileName, utilities_1.toUnixPath(referencingFilePath), compilerOpt, this.inMemoryFs))
                .filter(resolved => !!(resolved && resolved.resolvedModule))
                .map(resolved => resolved.resolvedModule.resolvedFileName);
        }))
            .map(filePath => utilities_1.path2uri(filePath))
            .do(core_1.noop, (_err) => {
            this.referencedFiles.delete(uri);
        })
            .publishReplay()
            .refCount();
        this.referencedFiles.set(uri, observable);
        return observable;
    }
    /**
     * Invalidates a cache entry for `resolveReferencedFiles` (e.g. because the file changed)
     *
     * @param uri The URI that referenced files should be invalidated for. If not given, all entries are invalidated
     */
    invalidateReferencedFiles(uri) {
        if (uri) {
            this.referencedFiles.delete(uri);
        }
        else {
            this.referencedFiles.clear();
        }
    }
}
exports.ProjectManager = ProjectManager;
/**
 * Implementaton of LanguageServiceHost that works with in-memory file system.
 * It takes file content from local cache and provides it to Solidity compiler on demand
 *
 * @implements LanguageServiceHost
 */
class InMemoryLanguageServiceHost {
    constructor(rootPath, options, fs, versions, logger = new logging_1.NoopLogger()) {
        this.logger = logger;
        this.rootPath = rootPath;
        this.options = options;
        this.fs = fs;
        this.versions = versions;
        this.projectVersion = 1;
        this.filePaths = [];
    }
    /**
     * TypeScript uses this method (when present) to compare project's version
     * with the last known one to decide if internal data should be synchronized
     */
    getProjectVersion() {
        return "" + this.projectVersion;
    }
    getNewLine() {
        // Although this is optional, language service was sending edits with carriage returns if not specified.
        // TODO: combine with the FormatOptions defaults.
        return "\n";
    }
    /**
     * Incrementing current project version, telling TS compiler to invalidate internal data
     */
    incProjectVersion() {
        this.projectVersion++;
    }
    getCompilationSettings() {
        return this.options;
    }
    getScriptFileNames() {
        return this.filePaths;
    }
    /**
     * Adds a file and increments project version, used in conjunction with getProjectVersion()
     * which may be called by TypeScript to check if internal data is up to date
     *
     * @param filePath relative file path
     */
    addFile(filePath) {
        this.filePaths.push(filePath);
        this.incProjectVersion();
    }
    readFile(filePath, _encoding) {
        return this.fs.readFile(filePath);
    }
    fileExists(path) {
        return this.fs.fileExists(path);
    }
    /**
     * @param fileName absolute file path
     */
    getScriptVersion(filePath) {
        const uri = utilities_1.path2uri(filePath);
        let version = this.versions.get(uri);
        if (!version) {
            version = 1;
            this.versions.set(uri, version);
        }
        return "" + version;
    }
    getCurrentDirectory() {
        return this.rootPath;
    }
    trace(_message) {
        // empty
    }
    log(_message) {
        // empty
    }
    error(message) {
        this.logger.error(message);
    }
    useCaseSensitiveFileNames() {
        return true;
    }
}
exports.InMemoryLanguageServiceHost = InMemoryLanguageServiceHost;
/**
 * ProjectConfiguration instances track the compiler configuration
 * and state for a single Solidity project. It represents the world of
 * the view as presented to the compiler.
 *
 * For efficiency, a ProjectConfiguration instance may hide some files
 * from the compiler, preventing them from being parsed and
 * type-checked. Depending on the use, the caller should call one of
 * the ensure* methods to ensure that the appropriate files have been
 * made available to the compiler before calling any other methods on
 * the ProjectConfiguration or its public members. By default, no
 * files are parsed.
 */
class ProjectConfiguration {
    /**
     * @param fs file system to use
     * @param rootFilePath root file path, absolute
     * @param configFilePath configuration file path, absolute
     * @param configContent optional configuration content to use instead of reading configuration file)
     */
    constructor(fs, rootFilePath, versions, configContent, logger = new logging_1.NoopLogger()) {
        this.logger = logger;
        /**
         * List of files that project consist of (based on tsconfig includes/excludes and wildcards).
         * Each item is a relative file path
         */
        this.expectedFilePaths = new Set();
        this.ensuredAllFiles = false;
        this.initialized = false;
        this.fs = fs;
        this.versions = versions;
        this.configContent = configContent;
        this.rootFilePath = rootFilePath;
    }
    init() {
        if (this.initialized) {
            return;
        }
        const configObject = this.configContent;
        this.expectedFilePaths = new Set(core_1.flatMap(configObject.include, pattern => glob.sync(pattern, { cwd: this.rootFilePath })));
        this.host = new InMemoryLanguageServiceHost(this.fs.path, configObject.compilerOptions, this.fs, this.versions, this.logger);
        this.service = services_1.createLanguageService(this.host);
        this.initialized = true;
    }
    /**
     * reset resets a ProjectConfiguration to its state immediately
     * after construction. It should be called whenever the underlying
     * local filesystem (fs) has changed, and so the
     * ProjectConfiguration can no longer assume its state reflects
     * that of the underlying files.
     */
    reset() {
        this.initialized = false;
        this.ensuredAllFiles = false;
        this.service = undefined;
        this.host = undefined;
        this.expectedFilePaths = new Set();
    }
    /**
     * @return language service object
     */
    getService() {
        if (!this.service) {
            throw new Error("project is uninitialized");
        }
        return this.service;
    }
    /**
     * Tells Solidity service to recompile program (if needed) based on current list of files and compilation options.
     * Solidity service relies on information provided by language servide host to see if there were any changes in
     * the whole project or in some files
     *
     * @return program object (cached result of parsing and typechecking done by Solidity service)
     */
    getProgram() {
        return this.getService().getProgram();
    }
    /**
     * @return language service host that Solidity service uses to read the data
     */
    getHost() {
        if (!this.host) {
            throw new Error("project is uninitialized");
        }
        return this.host;
    }
    /**
     * Ensures we are ready to process files from a given sub-project
     */
    ensureConfigFile() {
        this.init();
    }
    /**
     * Ensures a single file is available to the LanguageServiceHost
     * @param filePath
     */
    ensureSourceFile(filePath) {
        this.getHost().addFile(filePath);
    }
    /**
     * Ensures we added all project's source file
     */
    ensureAllFiles() {
        if (this.ensuredAllFiles) {
            return;
        }
        this.init();
        if (this.getHost().complete) {
            return;
        }
        for (const fileName of this.expectedFilePaths) {
            this.getHost().addFile(fileName);
        }
        this.getHost().complete = true;
        this.ensuredAllFiles = true;
    }
}
exports.ProjectConfiguration = ProjectConfiguration;
//# sourceMappingURL=projectManager.js.map