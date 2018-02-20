"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const core_1 = require("../compiler/core");
const logging_1 = require("./logging");
const utilities_1 = require("./utilities");
class InMemoryFileSystem extends events_1.EventEmitter {
    constructor(path, logger = new logging_1.NoopLogger()) {
        super();
        this.logger = logger;
        /**
         * Contains a Map of all URIs that exist in the workspace, optionally with a content.
         * File contents for URIs in it do not neccessarily have to be fetched already.
         */
        this.files = new Map();
        this.path = path;
        this.overlay = new Map();
        this.rootNode = { file: false, children: new Map() };
    }
    /**
     * Emitted when a file was added
     */
    on(event, listener) {
        return super.on(event, listener);
    }
    /**
     * Returns an IterableIterator for all URIs known to exist in the workspace (content loaded or not)
     */
    uris() {
        return this.files.keys();
    }
    /**
     * Adds a file to the local cache
     *
     * @param uri The URI of the file
     * @param content The optional content
     */
    add(uri, content) {
        // Make sure not to override existing content with undefined
        if (content !== undefined || !this.files.has(uri)) {
            this.files.set(uri, content);
        }
        // Add to directory tree
        const filePath = utilities_1.uri2path(uri);
        const components = filePath.split(/[\/\\]/).filter(c => c);
        let node = this.rootNode;
        for (const [i, component] of components.entries()) {
            const n = node.children.get(component);
            if (!n) {
                if (i < components.length - 1) {
                    const n = { file: false, children: new Map() };
                    node.children.set(component, n);
                    node = n;
                }
                else {
                    node.children.set(component, { file: true, children: new Map() });
                }
            }
            else {
                node = n;
            }
        }
        this.emit("add", uri, content);
    }
    /**
     * Returns true if the given file is known to exist in the workspace (content loaded or not)
     *
     * @param uri URI to a file
     */
    has(uri) {
        return this.files.has(uri) || this.fileExists(utilities_1.uri2path(uri));
    }
    /**
     * Returns the file content for the given URI.
     * Will throw an Error if no available in-memory.
     * Use FileSystemUpdater.ensure() to ensure that the file is available.
     */
    getContent(uri) {
        let content = this.overlay.get(uri);
        if (content === undefined) {
            content = this.files.get(uri);
        }
        if (content === undefined) {
            throw new Error(`Content of ${uri} is not available in memory`);
        }
        return content;
    }
    /**
     * Tells if a file denoted by the given name exists in the workspace (does not have to be loaded)
     *
     * @param path File path or URI (both absolute or relative file paths are accepted)
     */
    fileExists(path) {
        const uri = utilities_1.path2uri(path);
        return this.overlay.has(uri) || this.files.has(uri);
    }
    /**
     * @param path file path (both absolute or relative file paths are accepted)
     * @return file's content in the following order (overlay then cache).
     * If there is no such file, returns empty string to match expected signature
     */
    readFile(path) {
        const content = this.readFileIfExists(path);
        if (content === undefined) {
            this.logger.warn(`readFile ${path} requested by Solidity but content not available`);
            return "";
        }
        return content;
    }
    /**
     * @param path file path (both absolute or relative file paths are accepted)
     * @return file's content in the following order (overlay then cache).
     * If there is no such file, returns undefined
     */
    readFileIfExists(path) {
        const uri = utilities_1.path2uri(path);
        let content = this.overlay.get(uri);
        if (content !== undefined) {
            return content;
        }
        // TODO This assumes that the URI was a file:// URL.
        //      In reality it could be anything, and the first URI matching the path should be used.
        //      With the current Map, the search would be O(n), it would require a tree to get O(log(n))
        content = this.files.get(uri);
        if (content !== undefined) {
            return content;
        }
    }
    /**
     * Invalidates temporary content denoted by the given URI
     * @param uri file's URI
     */
    didClose(uri) {
        this.overlay.delete(uri);
    }
    /**
     * Adds temporary content denoted by the given URI
     * @param uri file's URI
     */
    didSave(uri) {
        const content = this.overlay.get(uri);
        if (content !== undefined) {
            this.add(uri, content);
        }
    }
    /**
     * Updates temporary content denoted by the given URI
     * @param uri file's URI
     */
    didChange(uri, text) {
        this.overlay.set(uri, text);
    }
    /**
     * Called by Solidity service to scan virtual directory when Solidity service looks for source files that belong to a project
     */
    readDirectory(rootDir, extensions, excludes, includes) {
        return core_1.matchFiles(rootDir, extensions, excludes, includes, true, this.path, undefined, p => this.getFileSystemEntries(p));
    }
    /**
     * Called by Solidity service to scan virtual directory when Solidity service looks for source files that belong to a project
     */
    getFileSystemEntries(path) {
        const ret = { files: [], directories: [] };
        let node = this.rootNode;
        const components = path.split("/").filter(c => c);
        if (components.length !== 1 || components[0]) {
            for (const component of components) {
                const n = node.children.get(component);
                if (!n) {
                    return ret;
                }
                node = n;
            }
        }
        node.children.forEach((value, name) => {
            if (value.file) {
                ret.files.push(name);
            }
            else {
                ret.directories.push(name);
            }
        });
        return ret;
    }
    trace(message) {
        this.logger.log(message);
    }
}
exports.InMemoryFileSystem = InMemoryFileSystem;
//# sourceMappingURL=memfs.js.map