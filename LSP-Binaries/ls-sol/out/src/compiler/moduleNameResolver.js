"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("./core");
const core_2 = require("./core");
const utilities_1 = require("./utilities");
function createModuleResolutionCache(currentDirectory, getCanonicalFileName) {
    const directoryToModuleNameMap = core_1.createMap();
    const moduleNameToDirectoryMap = core_1.createMap();
    return { getOrCreateCacheForDirectory, getOrCreateCacheForModuleName };
    function getOrCreateCacheForDirectory(directoryName) {
        const path = core_1.toPath(directoryName, currentDirectory, getCanonicalFileName);
        let perFolderCache = directoryToModuleNameMap.get(path);
        if (!perFolderCache) {
            perFolderCache = core_1.createMap();
            directoryToModuleNameMap.set(path, perFolderCache);
        }
        return perFolderCache;
    }
    function getOrCreateCacheForModuleName(nonRelativeModuleName) {
        if (core_1.isExternalModuleNameRelative(nonRelativeModuleName)) {
            return undefined;
        }
        let perModuleNameCache = moduleNameToDirectoryMap.get(nonRelativeModuleName);
        if (!perModuleNameCache) {
            perModuleNameCache = createPerModuleNameCache();
            moduleNameToDirectoryMap.set(nonRelativeModuleName, perModuleNameCache);
        }
        return perModuleNameCache;
    }
    function createPerModuleNameCache() {
        const directoryPathMap = core_1.createMap();
        return { get, set };
        function get(directory) {
            return directoryPathMap.get(core_1.toPath(directory, currentDirectory, getCanonicalFileName));
        }
        /**
         * At first this function add entry directory -> module resolution result to the table.
         * Then it computes the set of parent folders for 'directory' that should have the same module resolution result
         * and for every parent folder in set it adds entry: parent -> module resolution. .
         * Lets say we first directory name: /a/b/c/d/e and resolution result is: /a/b/bar.ts.
         * Set of parent folders that should have the same result will be:
         * [
         *     /a/b/c/d, /a/b/c, /a/b
         * ]
         * this means that request for module resolution from file in any of these folder will be immediately found in cache.
         */
        function set(directory, result) {
            const path = core_1.toPath(directory, currentDirectory, getCanonicalFileName);
            // if entry is already in cache do nothing
            if (directoryPathMap.has(path)) {
                return;
            }
            directoryPathMap.set(path, result);
            const resolvedFileName = result.resolvedModule && result.resolvedModule.resolvedFileName;
            // find common prefix between directory and resolved file name
            // this common prefix should be the shorted path that has the same resolution
            // directory: /a/b/c/d/e
            // resolvedFileName: /a/b/foo.d.ts
            const commonPrefix = getCommonPrefix(path, resolvedFileName);
            let current = path;
            while (true) {
                const parent = core_1.getDirectoryPath(current);
                if (parent === current || directoryPathMap.has(parent)) {
                    break;
                }
                directoryPathMap.set(parent, result);
                current = parent;
                if (current === commonPrefix) {
                    break;
                }
            }
        }
        function getCommonPrefix(directory, resolution) {
            if (resolution === undefined) {
                return undefined;
            }
            const resolutionDirectory = core_1.toPath(core_1.getDirectoryPath(resolution), currentDirectory, getCanonicalFileName);
            // find first position where directory and resolution differs
            let i = 0;
            while (i < Math.min(directory.length, resolutionDirectory.length) && directory.charCodeAt(i) === resolutionDirectory.charCodeAt(i)) {
                i++;
            }
            // find last directory separator before position i
            const sep = directory.lastIndexOf(core_1.directorySeparator, i);
            if (sep < 0) {
                return undefined;
            }
            return directory.substr(0, sep);
        }
    }
}
exports.createModuleResolutionCache = createModuleResolutionCache;
/**
 * Wraps value to SearchResult.
 * @returns undefined if value is undefined or { value } otherwise
 */
function toSearchResult(value) {
    return value !== undefined ? { value } : undefined;
}
function createResolvedModuleWithFailedLookupLocations(resolved, isExternalLibraryImport, failedLookupLocations) {
    return {
        resolvedModule: resolved && { resolvedFileName: resolved.path, extension: resolved.extension, isExternalLibraryImport, packageId: resolved.packageId },
        failedLookupLocations
    };
}
function resolveModuleName(moduleName, containingFile, compilerOptions, host, cache) {
    const containingDirectory = core_1.getDirectoryPath(containingFile);
    const perFolderCache = cache && cache.getOrCreateCacheForDirectory(containingDirectory);
    let result = perFolderCache && perFolderCache.get(moduleName);
    if (!result) {
        result = solidityNameResolver(moduleName, containingFile, compilerOptions, host, cache);
        if (perFolderCache) {
            perFolderCache.set(moduleName, result);
            // put result in per-module name cache
            const perModuleNameCache = cache.getOrCreateCacheForModuleName(moduleName);
            if (perModuleNameCache) {
                perModuleNameCache.set(containingDirectory, result);
            }
        }
    }
    return result;
}
exports.resolveModuleName = resolveModuleName;
function solidityNameResolver(moduleName, containingFile, compilerOptions, host, cache) {
    return solidityModuleNameResolverWorker(moduleName, core_1.getDirectoryPath(containingFile), compilerOptions, host, cache);
}
exports.solidityNameResolver = solidityNameResolver;
function realPath(path, host) {
    if (!host.realpath) {
        return path;
    }
    const real = core_2.normalizePath(host.realpath(path));
    return real;
}
function solidityModuleNameResolverWorker(moduleName, containingDirectory, compilerOptions, host, cache) {
    const failedLookupLocations = [];
    let state;
    const moduleDirectoryNames = ["node_modules", "installed_contracts"];
    for (const moduleDirectoryName of moduleDirectoryNames) {
        state = { compilerOptions, host, moduleDirectoryName };
        const result = tryResolve();
        if (result && result.value) {
            const { resolved, isExternalLibraryImport } = result.value;
            return createResolvedModuleWithFailedLookupLocations(resolved, isExternalLibraryImport, failedLookupLocations);
        }
    }
    return { resolvedModule: undefined, failedLookupLocations };
    function tryResolve() {
        if (!core_1.isExternalModuleNameRelative(moduleName)) {
            const resolved = loadModuleFromNodeModules(moduleName, containingDirectory, failedLookupLocations, state, cache);
            if (!resolved)
                return undefined;
            let resolvedValue = resolved.value;
            resolvedValue = resolvedValue && Object.assign({}, resolved.value, { path: realPath(resolved.value.path, host), extension: resolved.value.extension });
            // For node_modules lookups, get the real path so that multiple accesses to an `npm link`-ed module do not create duplicate files.
            return { value: resolvedValue && { resolved: resolvedValue, isExternalLibraryImport: true } };
        }
        else {
            const { path: candidate, parts } = core_2.normalizePathAndParts(core_1.combinePaths(containingDirectory, moduleName));
            const resolved = solidityLoadModuleByRelativeName(candidate, failedLookupLocations, /*onlyRecordFailures*/ false, state);
            // Treat explicit "node_modules" or "installed_contracts" import as an external library import.
            let isExternalLibraryImport = false;
            for (const moduleDirectoryName of moduleDirectoryNames) {
                if (core_1.contains(parts, moduleDirectoryName)) {
                    isExternalLibraryImport = true;
                    const [, packageName, ...rest] = core_2.dropWhile(parts, part => part !== moduleDirectoryName);
                    resolved.packageId = {
                        name: packageName,
                        subModuleName: rest.join("/"),
                        version: ""
                    };
                    break;
                }
            }
            return resolved && toSearchResult({ resolved, isExternalLibraryImport });
        }
    }
}
function loadModuleFromNodeModules(moduleName, directory, failedLookupLocations, state, cache) {
    return loadModuleFromNodeModulesWorker(moduleName, directory, failedLookupLocations, state, cache);
}
function loadModuleFromNodeModulesWorker(moduleName, directory, failedLookupLocations, state, cache) {
    const perModuleNameCache = cache && cache.getOrCreateCacheForModuleName(moduleName);
    return utilities_1.forEachAncestorDirectory(core_2.normalizeSlashes(directory), ancestorDirectory => {
        if (core_2.getBaseFileName(ancestorDirectory) !== state.moduleDirectoryName) {
            const resolutionFromCache = tryFindNonRelativeModuleNameInCache(perModuleNameCache, moduleName, ancestorDirectory, state.host);
            if (resolutionFromCache) {
                return resolutionFromCache;
            }
            return toSearchResult(loadModuleFromNodeModulesOneLevel(moduleName, ancestorDirectory, failedLookupLocations, state));
        }
    });
}
function tryFindNonRelativeModuleNameInCache(cache, _moduleName, containingDirectory, _host) {
    const result = cache && cache.get(containingDirectory);
    if (result) {
        return { value: result.resolvedModule && { path: result.resolvedModule.resolvedFileName, extension: result.resolvedModule.extension, packageId: result.resolvedModule.packageId } };
    }
}
/** Load a module from a single node_modules directory, but not from any ancestors' node_modules directories. */
function loadModuleFromNodeModulesOneLevel(moduleName, directory, failedLookupLocations, state) {
    const nodeModulesFolder = core_1.combinePaths(directory, state.moduleDirectoryName);
    const nodeModulesFolderExists = directoryProbablyExists(nodeModulesFolder, state.host);
    const packageResult = loadModuleFromNodeModulesFolder(moduleName, nodeModulesFolder, nodeModulesFolderExists, failedLookupLocations, state);
    if (packageResult) {
        return packageResult;
    }
}
function loadModuleFromNodeModulesFolder(moduleName, nodeModulesFolder, nodeModulesFolderExists, failedLookupLocations, state) {
    const { packageName, rest } = getPackageName(moduleName);
    const packageRootPath = core_1.combinePaths(nodeModulesFolder, packageName);
    let packageId;
    if (state.moduleDirectoryName === "node_modules") {
        const jsonInfo = getPackageJsonInfo(packageRootPath, rest, failedLookupLocations, !nodeModulesFolderExists, state);
        packageId = jsonInfo.packageId;
    }
    else if (state.moduleDirectoryName === "installed_contracts") {
        const jsonInfo = getEthPmJsonInfo(packageRootPath, rest, failedLookupLocations, !nodeModulesFolderExists, state);
        packageId = jsonInfo.packageId;
    }
    const candidate = core_2.normalizePath(core_1.combinePaths(nodeModulesFolder, moduleName));
    const pathAndExtension = loadModuleFromFile(candidate, failedLookupLocations, !nodeModulesFolderExists, state);
    return withPackageId(packageId, pathAndExtension);
}
function getPackageName(moduleName) {
    let idx = moduleName.indexOf(core_1.directorySeparator);
    if (moduleName[0] === "@") {
        idx = moduleName.indexOf(core_1.directorySeparator, idx + 1);
    }
    return idx === -1 ? { packageName: moduleName, rest: "" } : { packageName: moduleName.slice(0, idx), rest: moduleName.slice(idx + 1) };
}
function pathToEthPmJson(directory) {
    return core_1.combinePaths(directory, "ethpm.json");
}
function getEthPmJsonInfo(nodeModuleDirectory, subModuleName, failedLookupLocations, onlyRecordFailures, { host }) {
    const directoryExists = !onlyRecordFailures && directoryProbablyExists(nodeModuleDirectory, host);
    const ethPmJsonPath = pathToEthPmJson(nodeModuleDirectory);
    if (directoryExists && host.fileExists(ethPmJsonPath)) {
        const ethPmJsonContent = readJson(ethPmJsonPath, host);
        const packageId = typeof ethPmJsonContent.package_name === "string" && typeof ethPmJsonContent.version === "string"
            ? { name: ethPmJsonContent.package_name, subModuleName, version: ethPmJsonContent.version }
            : undefined;
        return { ethPmJsonContent, packageId };
    }
    else {
        // record package json as one of failed lookup locations - in the future if this file will appear it will invalidate resolution results
        failedLookupLocations.push(ethPmJsonPath);
        return { ethPmJsonContent: undefined, packageId: undefined };
    }
}
function pathToPackageJson(directory) {
    return core_1.combinePaths(directory, "package.json");
}
function getPackageJsonInfo(nodeModuleDirectory, subModuleName, failedLookupLocations, onlyRecordFailures, { host }) {
    const directoryExists = !onlyRecordFailures && directoryProbablyExists(nodeModuleDirectory, host);
    const packageJsonPath = pathToPackageJson(nodeModuleDirectory);
    if (directoryExists && host.fileExists(packageJsonPath)) {
        const packageJsonContent = readJson(packageJsonPath, host);
        const packageId = typeof packageJsonContent.name === "string" && typeof packageJsonContent.version === "string"
            ? { name: packageJsonContent.name, subModuleName, version: packageJsonContent.version }
            : undefined;
        return { packageJsonContent, packageId };
    }
    else {
        // record package json as one of failed lookup locations - in the future if this file will appear it will invalidate resolution results
        failedLookupLocations.push(packageJsonPath);
        return { packageJsonContent: undefined, packageId: undefined };
    }
}
function readJson(path, host) {
    try {
        const jsonText = host.readFile(path);
        return jsonText ? JSON.parse(jsonText) : {};
    }
    catch (e) {
        // gracefully handle if readFile fails or returns not JSON
        return {};
    }
}
function solidityLoadModuleByRelativeName(candidate, failedLookupLocations, onlyRecordFailures, state) {
    if (!core_2.pathEndsWithDirectorySeparator(candidate)) {
        if (!onlyRecordFailures) {
            const parentOfCandidate = core_1.getDirectoryPath(candidate);
            if (!directoryProbablyExists(parentOfCandidate, state.host)) {
                onlyRecordFailures = true;
            }
        }
        const resolvedFromFile = loadModuleFromFile(candidate, failedLookupLocations, onlyRecordFailures, state);
        if (resolvedFromFile) {
            return noPackageId(resolvedFromFile);
        }
    }
}
/**
 * @param {boolean} onlyRecordFailures - if true then function won't try to actually load files but instead record all attempts as failures. This flag is necessary
 * in cases when we know upfront that all load attempts will fail (because containing folder does not exists) however we still need to record all failed lookup locations.
 */
function loadModuleFromFile(candidate, failedLookupLocations, onlyRecordFailures, state) {
    const path = tryFile(candidate, failedLookupLocations, onlyRecordFailures, state);
    return path && { path, ext: ".sol" /* Sol */ };
}
/** Return the file if it exists. */
function tryFile(fileName, failedLookupLocations, onlyRecordFailures, state) {
    if (!onlyRecordFailures) {
        if (state.host.fileExists(fileName)) {
            return fileName;
        }
    }
    failedLookupLocations.push(fileName);
    return undefined;
}
function directoryProbablyExists(directoryName, host) {
    // if host does not support 'directoryExists' assume that directory will exist
    return !host.directoryExists || host.directoryExists(directoryName);
}
exports.directoryProbablyExists = directoryProbablyExists;
function withPackageId(packageId, r) {
    return r && { path: r.path, extension: r.ext, packageId };
}
function noPackageId(r) {
    return withPackageId(/*packageId*/ undefined, r);
}
//# sourceMappingURL=moduleNameResolver.js.map