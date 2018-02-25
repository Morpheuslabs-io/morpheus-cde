"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("@reactivex/rxjs");
const glob_1 = require("glob");
const fs = require("mz/fs");
const semaphore_async_await_1 = require("semaphore-async-await");
const utilities_1 = require("./utilities");
class RemoteFileSystem {
    constructor(client) {
        this.client = client;
    }
    /**
     * The files request is sent from the server to the client to request a list of all files in the workspace or inside the directory of the base parameter, if given.
     * A language server can use the result to index files by filtering and doing a content request for each text document of interest.
     */
    getWorkspaceFiles(base) {
        return this.client.workspaceXfiles({ base })
            .mergeMap(textDocuments => textDocuments)
            .map(textDocument => utilities_1.normalizeUri(textDocument.uri));
    }
    /**
     * The content request is sent from the server to the client to request the current content of any text document. This allows language servers to operate without accessing the file system directly.
     */
    getTextDocumentContent(uri) {
        return this.client.textDocumentXcontent({ textDocument: { uri } })
            .map(textDocument => textDocument.text);
    }
}
exports.RemoteFileSystem = RemoteFileSystem;
class LocalFileSystem {
    /**
     * @param rootUri The root URI that is used if `base` is not specified
     */
    constructor(rootUri) {
        this.rootUri = rootUri;
    }
    /**
     * Converts the URI to an absolute path on the local disk
     */
    resolveUriToPath(uri) {
        return utilities_1.uri2path(uri);
    }
    getWorkspaceFiles(base = this.rootUri) {
        if (!base.endsWith("/")) {
            base += "/";
        }
        const cwd = this.resolveUriToPath(base);
        return new rxjs_1.Observable(subscriber => {
            const globber = new glob_1.Glob("*", {
                cwd,
                nodir: true,
                matchBase: true,
                follow: true
            });
            globber.on("match", (file) => {
                subscriber.next(utilities_1.normalizeUri(base + file));
            });
            globber.on("error", (err) => {
                subscriber.error(err);
            });
            globber.on("end", () => {
                subscriber.complete();
            });
            return () => {
                globber.abort();
            };
        });
    }
    getTextDocumentContent(uri) {
        const filePath = this.resolveUriToPath(uri);
        return rxjs_1.Observable.fromPromise(fs.readFile(filePath, "utf8"));
    }
}
exports.LocalFileSystem = LocalFileSystem;
/**
 * Synchronizes a remote file system to an in-memory file system
 */
class FileSystemUpdater {
    constructor(remoteFs, inMemoryFs) {
        this.remoteFs = remoteFs;
        this.inMemoryFs = inMemoryFs;
        /**
         * Map from URI to Observable of pending or completed content fetch
         */
        this.fetches = new Map();
        /**
         * Limits concurrent fetches to not fetch thousands of files in parallel
         */
        this.concurrencyLimit = new semaphore_async_await_1.default(100);
    }
    /**
     * Fetches the file content for the given URI and adds the content to the in-memory file system
     *
     * @param uri URI of the file to fetch
     * @return Observable that completes when the fetch is finished
     */
    fetch(uri) {
        // Limit concurrent fetches
        const observable = rxjs_1.Observable.fromPromise(this.concurrencyLimit.wait())
            .mergeMap(() => this.remoteFs.getTextDocumentContent(uri))
            .do(content => {
            this.concurrencyLimit.signal();
            this.inMemoryFs.add(uri, content);
        }, _err => {
            this.fetches.delete(uri);
        })
            .ignoreElements()
            .publishReplay()
            .refCount();
        this.fetches.set(uri, observable);
        return observable;
    }
    /**
     * Returns a promise that is resolved when the given URI has been fetched (at least once) to the in-memory file system.
     * This function cannot be cancelled because multiple callers get the result of the same operation.
     *
     * @param uri URI of the file to ensure
     * @return Observable that completes when the file was fetched
     */
    ensure(uri) {
        return this.fetches.get(uri) || this.fetch(uri);
    }
    /**
     * Fetches the file/directory structure for the given directory from the remote file system and saves it in the in-memory file system
     */
    fetchStructure() {
        const observable = this.remoteFs.getWorkspaceFiles(undefined)
            .do(uri => {
            this.inMemoryFs.add(uri);
        }, _err => {
            this.structureFetch = undefined;
        })
            .ignoreElements()
            .publishReplay()
            .refCount();
        this.structureFetch = observable;
        return observable;
    }
    /**
     * Returns a promise that is resolved as soon as the file/directory structure for the given directory has been synced
     * from the remote file system to the in-memory file system (at least once)
     *
     * @param span An OpenTracing span for tracing
     */
    ensureStructure() {
        return this.structureFetch || this.fetchStructure();
    }
    /**
     * Invalidates the content fetch cache of a file.
     * The next call to `ensure` will do a refetch.
     *
     * @param uri URI of the file that changed
     */
    invalidate(uri) {
        this.fetches.delete(uri);
    }
    /**
     * Invalidates the structure fetch cache.
     * The next call to `ensureStructure` will do a refetch.
     */
    invalidateStructure() {
        this.structureFetch = undefined;
    }
}
exports.FileSystemUpdater = FileSystemUpdater;
//# sourceMappingURL=fs.js.map