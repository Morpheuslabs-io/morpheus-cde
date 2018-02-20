"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("./core");
/**
 * Set a high stack trace limit to provide more information in case of an error.
 * Called for command-line and server use cases.
 * Not called if TypeScript is used as a library.
 */
/* @internal */
function setStackTraceLimit() {
    if (Error.stackTraceLimit < 100) {
        Error.stackTraceLimit = 100;
    }
}
exports.setStackTraceLimit = setStackTraceLimit;
var FileWatcherEventKind;
(function (FileWatcherEventKind) {
    FileWatcherEventKind[FileWatcherEventKind["Created"] = 0] = "Created";
    FileWatcherEventKind[FileWatcherEventKind["Changed"] = 1] = "Changed";
    FileWatcherEventKind[FileWatcherEventKind["Deleted"] = 2] = "Deleted";
})(FileWatcherEventKind = exports.FileWatcherEventKind || (exports.FileWatcherEventKind = {}));
function getNodeMajorVersion() {
    if (typeof process === "undefined") {
        return undefined;
    }
    const version = process.version;
    if (!version) {
        return undefined;
    }
    const dot = version.indexOf(".");
    if (dot === -1) {
        return undefined;
    }
    return parseInt(version.substring(1, dot));
}
exports.getNodeMajorVersion = getNodeMajorVersion;
exports.sys = (function () {
    function getNodeSystem() {
        const _fs = require("fs");
        const _path = require("path");
        const _os = require("os");
        const _crypto = require("crypto");
        const useNonPollingWatchers = process.env["TSC_NONPOLLING_WATCHER"];
        function createWatchedFileSet() {
            const dirWatchers = core_1.createMap();
            // One file can have multiple watchers
            const fileWatcherCallbacks = core_1.createMultiMap();
            return { addFile, removeFile };
            function reduceDirWatcherRefCountForFile(fileName) {
                const dirName = core_1.getDirectoryPath(fileName);
                const watcher = dirWatchers.get(dirName);
                if (watcher) {
                    watcher.referenceCount -= 1;
                    if (watcher.referenceCount <= 0) {
                        watcher.close();
                        dirWatchers.delete(dirName);
                    }
                }
            }
            function addDirWatcher(dirPath) {
                let watcher = dirWatchers.get(dirPath);
                if (watcher) {
                    watcher.referenceCount += 1;
                    return;
                }
                watcher = fsWatchDirectory(dirPath || ".", (eventName, relativeFileName) => fileEventHandler(eventName, relativeFileName, dirPath));
                watcher.referenceCount = 1;
                dirWatchers.set(dirPath, watcher);
                return;
            }
            function addFileWatcherCallback(filePath, callback) {
                fileWatcherCallbacks.add(filePath, callback);
            }
            function addFile(fileName, callback) {
                addFileWatcherCallback(fileName, callback);
                addDirWatcher(core_1.getDirectoryPath(fileName));
                return { fileName, callback };
            }
            function removeFile(watchedFile) {
                removeFileWatcherCallback(watchedFile.fileName, watchedFile.callback);
                reduceDirWatcherRefCountForFile(watchedFile.fileName);
            }
            function removeFileWatcherCallback(filePath, callback) {
                fileWatcherCallbacks.remove(filePath, callback);
            }
            function fileEventHandler(eventName, relativeFileName, baseDirPath) {
                // When files are deleted from disk, the triggered "rename" event would have a relativefileName of "undefined"
                const fileName = !core_1.isString(relativeFileName)
                    ? undefined
                    : core_1.getNormalizedAbsolutePath(relativeFileName, baseDirPath);
                // Some applications save a working file via rename operations
                if ((eventName === "change" || eventName === "rename")) {
                    const callbacks = fileWatcherCallbacks.get(fileName);
                    if (callbacks) {
                        for (const fileCallback of callbacks) {
                            fileCallback(fileName, FileWatcherEventKind.Changed);
                        }
                    }
                }
            }
        }
        const watchedFileSet = createWatchedFileSet();
        const nodeVersion = getNodeMajorVersion();
        const isNode4OrLater = nodeVersion >= 4;
        function isFileSystemCaseSensitive() {
            // win32\win64 are case insensitive platforms
            if (platform === "win32" || platform === "win64") {
                return false;
            }
            // If this file exists under a different case, we must be case-insensitve.
            return !fileExists(swapCase(__filename));
        }
        /** Convert all lowercase chars to uppercase, and vice-versa */
        function swapCase(s) {
            return s.replace(/\w/g, (ch) => {
                const up = ch.toUpperCase();
                return ch === up ? ch.toLowerCase() : up;
            });
        }
        const platform = _os.platform();
        const useCaseSensitiveFileNames = isFileSystemCaseSensitive();
        function fsWatchFile(fileName, callback, pollingInterval) {
            _fs.watchFile(fileName, { persistent: true, interval: pollingInterval || 250 }, fileChanged);
            return {
                close: () => _fs.unwatchFile(fileName, fileChanged)
            };
            function fileChanged(curr, prev) {
                const isCurrZero = +curr.mtime === 0;
                const isPrevZero = +prev.mtime === 0;
                const created = !isCurrZero && isPrevZero;
                const deleted = isCurrZero && !isPrevZero;
                const eventKind = created
                    ? FileWatcherEventKind.Created
                    : deleted
                        ? FileWatcherEventKind.Deleted
                        : FileWatcherEventKind.Changed;
                if (eventKind === FileWatcherEventKind.Changed && +curr.mtime <= +prev.mtime) {
                    return;
                }
                callback(fileName, eventKind);
            }
        }
        function fsWatchDirectory(directoryName, callback, recursive) {
            let options;
            /** Watcher for the directory depending on whether it is missing or present */
            let watcher = !directoryExists(directoryName) ?
                watchMissingDirectory() :
                watchPresentDirectory();
            return {
                close: () => {
                    // Close the watcher (either existing directory watcher or missing directory watcher)
                    watcher.close();
                }
            };
            /**
             * Watch the directory that is currently present
             * and when the watched directory is deleted, switch to missing directory watcher
             */
            function watchPresentDirectory() {
                // Node 4.0 `fs.watch` function supports the "recursive" option on both OSX and Windows
                // (ref: https://github.com/nodejs/node/pull/2649 and https://github.com/Microsoft/TypeScript/issues/4643)
                if (options === undefined) {
                    if (isNode4OrLater && (process.platform === "win32" || process.platform === "darwin")) {
                        options = { persistent: true, recursive: !!recursive };
                    }
                    else {
                        options = { persistent: true };
                    }
                }
                const dirWatcher = _fs.watch(directoryName, options, callback);
                dirWatcher.on("error", () => {
                    if (!directoryExists(directoryName)) {
                        // Deleting directory
                        watcher = watchMissingDirectory();
                        // Call the callback for current directory
                        callback("rename", "");
                    }
                });
                return dirWatcher;
            }
            /**
             * Watch the directory that is missing
             * and switch to existing directory when the directory is created
             */
            function watchMissingDirectory() {
                return fsWatchFile(directoryName, (_fileName, eventKind) => {
                    if (eventKind === FileWatcherEventKind.Created && directoryExists(directoryName)) {
                        watcher.close();
                        watcher = watchPresentDirectory();
                        // Call the callback for current directory
                        // For now it could be callback for the inner directory creation,
                        // but just return current directory, better than current no-op
                        callback("rename", "");
                    }
                });
            }
        }
        function readFile(fileName, _encoding) {
            if (!fileExists(fileName)) {
                return undefined;
            }
            const buffer = _fs.readFileSync(fileName);
            let len = buffer.length;
            if (len >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
                // Big endian UTF-16 byte order mark detected. Since big endian is not supported by node.js,
                // flip all byte pairs and treat as little endian.
                len &= ~1; // Round down to a multiple of 2
                for (let i = 0; i < len; i += 2) {
                    const temp = buffer[i];
                    buffer[i] = buffer[i + 1];
                    buffer[i + 1] = temp;
                }
                return buffer.toString("utf16le", 2);
            }
            if (len >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
                // Little endian UTF-16 byte order mark detected
                return buffer.toString("utf16le", 2);
            }
            if (len >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
                // UTF-8 byte order mark detected
                return buffer.toString("utf8", 3);
            }
            // Default is UTF-8 with no byte order mark
            return buffer.toString("utf8");
        }
        function writeFile(fileName, data, writeByteOrderMark) {
            // If a BOM is required, emit one
            if (writeByteOrderMark) {
                data = "\uFEFF" + data;
            }
            let fd;
            try {
                fd = _fs.openSync(fileName, "w");
                _fs.writeSync(fd, data, /*position*/ undefined, "utf8");
            }
            finally {
                if (fd !== undefined) {
                    _fs.closeSync(fd);
                }
            }
        }
        function getAccessibleFileSystemEntries(path) {
            try {
                const entries = _fs.readdirSync(path || ".").sort();
                const files = [];
                const directories = [];
                for (const entry of entries) {
                    // This is necessary because on some file system node fails to exclude
                    // "." and "..". See https://github.com/nodejs/node/issues/4002
                    if (entry === "." || entry === "..") {
                        continue;
                    }
                    const name = core_1.combinePaths(path, entry);
                    let stat;
                    try {
                        stat = _fs.statSync(name);
                    }
                    catch (e) {
                        continue;
                    }
                    if (stat.isFile()) {
                        files.push(entry);
                    }
                    else if (stat.isDirectory()) {
                        directories.push(entry);
                    }
                }
                return { files, directories };
            }
            catch (e) {
                return { files: [], directories: [] };
            }
        }
        function readDirectory(path, extensions, excludes, includes, depth) {
            return core_1.matchFiles(path, extensions, excludes, includes, useCaseSensitiveFileNames, process.cwd(), depth, getAccessibleFileSystemEntries);
        }
        function fileSystemEntryExists(path, entryKind) {
            try {
                const stat = _fs.statSync(path);
                switch (entryKind) {
                    case 0 /* File */: return stat.isFile();
                    case 1 /* Directory */: return stat.isDirectory();
                }
            }
            catch (e) {
                return false;
            }
        }
        function fileExists(path) {
            return fileSystemEntryExists(path, 0 /* File */);
        }
        function directoryExists(path) {
            return fileSystemEntryExists(path, 1 /* Directory */);
        }
        function getDirectories(path) {
            return core_1.filter(_fs.readdirSync(path), dir => fileSystemEntryExists(core_1.combinePaths(path, dir), 1 /* Directory */));
        }
        const nodeSystem = {
            args: process.argv.slice(2),
            newLine: _os.EOL,
            useCaseSensitiveFileNames,
            write(s) {
                process.stdout.write(s);
            },
            readFile,
            writeFile,
            watchFile: (fileName, callback, pollingInterval) => {
                if (useNonPollingWatchers) {
                    const watchedFile = watchedFileSet.addFile(fileName, callback);
                    return {
                        close: () => watchedFileSet.removeFile(watchedFile)
                    };
                }
                else {
                    return fsWatchFile(fileName, callback, pollingInterval);
                }
            },
            watchDirectory: (directoryName, callback, recursive) => {
                // Node 4.0 `fs.watch` function supports the "recursive" option on both OSX and Windows
                // (ref: https://github.com/nodejs/node/pull/2649 and https://github.com/Microsoft/TypeScript/issues/4643)
                return fsWatchDirectory(directoryName, (eventName, relativeFileName) => {
                    // In watchDirectory we only care about adding and removing files (when event name is
                    // "rename"); changes made within files are handled by corresponding fileWatchers (when
                    // event name is "change")
                    if (eventName === "rename") {
                        // When deleting a file, the passed baseFileName is null
                        callback(!relativeFileName ? relativeFileName : core_1.normalizePath(core_1.combinePaths(directoryName, relativeFileName)));
                    }
                }, recursive);
            },
            resolvePath: path => _path.resolve(path),
            fileExists,
            directoryExists,
            createDirectory(directoryName) {
                if (!nodeSystem.directoryExists(directoryName)) {
                    _fs.mkdirSync(directoryName);
                }
            },
            getExecutingFilePath() {
                return __filename;
            },
            getCurrentDirectory() {
                return process.cwd();
            },
            getDirectories,
            getEnvironmentVariable(name) {
                return process.env[name] || "";
            },
            readDirectory,
            getModifiedTime(path) {
                try {
                    return _fs.statSync(path).mtime;
                }
                catch (e) {
                    return undefined;
                }
            },
            createHash(data) {
                const hash = _crypto.createHash("md5");
                hash.update(data);
                return hash.digest("hex");
            },
            getMemoryUsage() {
                if (global.gc) {
                    global.gc();
                }
                return process.memoryUsage().heapUsed;
            },
            getFileSize(path) {
                try {
                    const stat = _fs.statSync(path);
                    if (stat.isFile()) {
                        return stat.size;
                    }
                }
                catch (e) { }
                return 0;
            },
            exit(exitCode) {
                process.exit(exitCode);
            },
            realpath(path) {
                return _fs.realpathSync(path);
            },
            debugMode: core_1.some(process.execArgv, arg => /^--(inspect|debug)(-brk)?(=\d+)?$/i.test(arg)),
            tryEnableSourceMapsForHost() {
                try {
                    require("source-map-support").install();
                }
                catch (e) {
                    // Could not enable source maps.
                }
            },
            setTimeout,
            clearTimeout
        };
        return nodeSystem;
    }
    function getChakraSystem() {
        const realpath = ChakraHost.realpath && ((path) => ChakraHost.realpath(path));
        return {
            newLine: ChakraHost.newLine || "\r\n",
            args: ChakraHost.args,
            useCaseSensitiveFileNames: !!ChakraHost.useCaseSensitiveFileNames,
            write: ChakraHost.echo,
            readFile(path, _encoding) {
                // encoding is automatically handled by the implementation in ChakraHost
                return ChakraHost.readFile(path);
            },
            writeFile(path, data, writeByteOrderMark) {
                // If a BOM is required, emit one
                if (writeByteOrderMark) {
                    data = "\uFEFF" + data;
                }
                ChakraHost.writeFile(path, data);
            },
            resolvePath: ChakraHost.resolvePath,
            fileExists: ChakraHost.fileExists,
            directoryExists: ChakraHost.directoryExists,
            createDirectory: ChakraHost.createDirectory,
            getExecutingFilePath: () => ChakraHost.executingFile,
            getCurrentDirectory: () => ChakraHost.currentDirectory,
            getDirectories: ChakraHost.getDirectories,
            getEnvironmentVariable: ChakraHost.getEnvironmentVariable || (() => ""),
            readDirectory(path, extensions, excludes, includes, _depth) {
                const pattern = core_1.getFileMatcherPatterns(path, excludes, includes, !!ChakraHost.useCaseSensitiveFileNames, ChakraHost.currentDirectory);
                return ChakraHost.readDirectory(path, extensions, pattern.basePaths, pattern.excludePattern, pattern.includeFilePattern, pattern.includeDirectoryPattern);
            },
            exit: ChakraHost.quit,
            realpath
        };
    }
    function recursiveCreateDirectory(directoryPath, sys) {
        const basePath = core_1.getDirectoryPath(directoryPath);
        const shouldCreateParent = directoryPath !== basePath && !sys.directoryExists(basePath);
        if (shouldCreateParent) {
            recursiveCreateDirectory(basePath, sys);
        }
        if (shouldCreateParent || !sys.directoryExists(directoryPath)) {
            sys.createDirectory(directoryPath);
        }
    }
    let sys;
    if (typeof ChakraHost !== "undefined") {
        sys = getChakraSystem();
    }
    else if (typeof process !== "undefined" && process.nextTick && !process.browser && typeof require !== "undefined") {
        // process and process.nextTick checks if current environment is node-like
        // process.browser check excludes webpack and browserify
        sys = getNodeSystem();
    }
    if (sys) {
        // patch writefile to create folder before writing the file
        const originalWriteFile = sys.writeFile;
        sys.writeFile = function (path, data, writeBom) {
            const directoryPath = core_1.getDirectoryPath(core_1.normalizeSlashes(path));
            if (directoryPath && !sys.directoryExists(directoryPath)) {
                recursiveCreateDirectory(directoryPath, sys);
            }
            originalWriteFile.call(sys, path, data, writeBom);
        };
    }
    return sys;
})();
if (exports.sys && exports.sys.getEnvironmentVariable) {
    core_1.Debug.currentAssertionLevel = /^development$/i.test(exports.sys.getEnvironmentVariable("NODE_ENV"))
        ? 1 /* Normal */
        : 0 /* None */;
}
if (exports.sys && exports.sys.debugMode) {
    core_1.Debug.isDebugging = true;
}
//# sourceMappingURL=sys.js.map