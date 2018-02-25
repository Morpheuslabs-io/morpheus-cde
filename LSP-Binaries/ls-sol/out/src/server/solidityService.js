"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const rxjs_1 = require("@reactivex/rxjs");
const _ = require("lodash");
const vscode_languageserver_1 = require("vscode-languageserver");
const core_1 = require("../compiler/core");
const services_1 = require("../services/services");
const fs_1 = require("./fs");
const logging_1 = require("./logging");
const memfs_1 = require("./memfs");
const projectManager_1 = require("./projectManager");
const utilities_1 = require("./utilities");
const defaultSoliumRules = {
    "array-declarations": true,
    "blank-lines": false,
    "camelcase": true,
    "deprecated-suicide": true,
    "double-quotes": true,
    "imports-on-top": true,
    "indentation": false,
    "lbrace": true,
    "mixedcase": true,
    "no-empty-blocks": true,
    "no-unused-vars": true,
    "no-with": true,
    "operator-whitespace": true,
    "pragma-on-top": true,
    "uppercase": true,
    "variable-declarations": true,
    "whitespace": true
};
const defaultSolhintRules = {};
/**
 * Handles incoming requests and return responses. There is a one-to-one-to-one
 * correspondence between TCP connection, SolidityService instance, and
 * language workspace. SolidityService caches data from the compiler across
 * requests. The lifetime of the SolidityService instance is tied to the
 * lifetime of the TCP connection, so its caches are deleted after the
 * connection is torn down.
 *
 * Methods are camelCase versions of the LSP spec methods and dynamically
 * dispatched. Methods not to be exposed over JSON RPC are prefixed with an
 * underscore.
 */
class SolidityService {
    constructor(client, options = {}) {
        this.client = client;
        this.options = options;
        /**
         * Settings synced though `didChangeConfiguration`
         */
        this.settings = {
            solidity: {
                solium: {
                    enabled: true,
                    rules: defaultSoliumRules
                },
                solhint: {
                    enabled: true,
                    rules: defaultSolhintRules
                },
                compilerOptions: services_1.getDefaultCompilerOptions()
            }
        };
        this.logger = new logging_1.LSPLogger(client);
    }
    initialize(params) {
        this.accessDisk = !(params.capabilities.xcontentProvider && params.capabilities.xfilesProvider);
        if (params.rootUri || params.rootPath) {
            this.root = params.rootPath || utilities_1.uri2path(params.rootUri);
            this.rootUri = params.rootUri || utilities_1.path2uri(params.rootPath);
            // The root URI always refers to a directory
            if (!this.rootUri.endsWith("/")) {
                this.rootUri += "/";
            }
            this.globalProjectManager = this._createProjectManager({ root: this.root, rootUri: this.rootUri });
        }
        else {
            this.perDirectoryProjectManagerCache = new Map();
        }
        const result = {
            capabilities: {
                // Tell the client that the server works in FULL text document sync mode
                textDocumentSync: vscode_languageserver_1.TextDocumentSyncKind.Full,
                hoverProvider: false,
                signatureHelpProvider: {
                    triggerCharacters: ["(", ","]
                },
                definitionProvider: false,
                referencesProvider: false,
                documentSymbolProvider: false,
                workspaceSymbolProvider: false,
                completionProvider: {
                    resolveProvider: false,
                    triggerCharacters: ["."]
                },
                codeActionProvider: false,
                renameProvider: false,
                executeCommandProvider: {
                    commands: []
                }
            }
        };
        return rxjs_1.Observable.of({
            op: "add",
            path: "",
            value: result
        });
    }
    /*
     * Creates a new ProjectManager for the given path.
     *
     * @param rootPath the root path
     * @param accessDisk Whether the language server is allowed to access the local file system
     */
    _createProjectManager(params) {
        // The remote (or local), asynchronous, file system to fetch files from
        const fileSystem = this.accessDisk ? new fs_1.LocalFileSystem(params.rootUri) : new fs_1.RemoteFileSystem(this.client);
        // Holds file contents and workspace structure in memory
        const inMemoryFileSystem = new memfs_1.InMemoryFileSystem(params.root, this.logger);
        // Syncs the remote file system with the in-memory file system
        const updater = new fs_1.FileSystemUpdater(fileSystem, inMemoryFileSystem);
        return new projectManager_1.ProjectManager(params.root, inMemoryFileSystem, updater, this.settings.solidity.compilerOptions, this.logger);
    }
    getProjectManager(uri) {
        const path = utilities_1.uri2path(uri);
        // If the root path is set, return the global ProjectManager.
        if (this.root)
            return this.globalProjectManager;
        const root = core_1.getDirectoryPath(path);
        let projectManager = this.perDirectoryProjectManagerCache.get(root);
        if (!projectManager) {
            projectManager = this._createProjectManager({ root, rootUri: utilities_1.path2uri(root) });
            this.perDirectoryProjectManagerCache.set(root, projectManager);
        }
        return projectManager;
    }
    /**
     * The initialized notification is sent from the client to the server after the client received the
     * result of the initialize request but before the client is sending any other request or notification
     * to the server. The server can use the initialized notification for example to dynamically register
     * capabilities.
     */
    initialized() {
        return __awaiter(this, void 0, void 0, function* () {
            // No op.
        });
    }
    /**
     * The shutdown request is sent from the client to the server. It asks the server to shut down,
     * but to not exit (otherwise the response might not be delivered correctly to the client).
     * There is a separate exit notification that asks the server to exit.
     *
     * @return Observable of JSON Patches that build a `null` result
     */
    shutdown(_params = {}) {
        return rxjs_1.Observable.of({ op: "add", path: "", value: null });
    }
    /**
     * A notification sent from the client to the server to signal the change of configuration
     * settings.
     */
    workspaceDidChangeConfiguration(params) {
        _.merge(this.settings, params.settings);
    }
    /**
     * The document open notification is sent from the client to the server to signal newly opened
     * text documents. The document's truth is now managed by the client and the server must not try
     * to read the document's truth using the document's uri.
     */
    textDocumentDidOpen(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = utilities_1.normalizeUri(params.textDocument.uri);
            const text = params.textDocument.text;
            // Ensure files needed for most operations are fetched
            const projectManager = this.getProjectManager(uri);
            yield projectManager.ensureReferencedFiles(uri).toPromise();
            projectManager.didOpen(uri, text);
            yield new Promise(resolve => setTimeout(resolve, 200));
            this._publishDiagnostics(uri);
        });
    }
    /**
     * The document change notification is sent from the client to the server to signal changes to a
     * text document. In 2.0 the shape of the params has changed to include proper version numbers
     * and language ids.
     */
    textDocumentDidChange(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = utilities_1.normalizeUri(params.textDocument.uri);
            let text;
            for (const change of params.contentChanges) {
                if (change.range || change.rangeLength) {
                    throw new Error("incremental updates in textDocument/didChange not supported for file " + uri);
                }
                text = change.text;
            }
            if (!text) {
                return;
            }
            this.getProjectManager(uri).didChange(uri, text);
            yield new Promise(resolve => setTimeout(resolve, 200));
            this._publishDiagnostics(uri);
        });
    }
    /**
     * The document save notification is sent from the client to the server when the document was
     * saved in the client.
     */
    textDocumentDidSave(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = utilities_1.normalizeUri(params.textDocument.uri);
            const projectManager = this.getProjectManager(uri);
            yield projectManager.ensureReferencedFiles(uri).toPromise();
            projectManager.didSave(uri);
        });
    }
    /**
     * The document close notification is sent from the client to the server when the document got
     * closed in the client. The document's truth now exists where the document's uri points to
     * (e.g. if the document's uri is a file uri the truth now exists on disk).
     */
    textDocumentDidClose(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const uri = utilities_1.normalizeUri(params.textDocument.uri);
            // Ensure files needed to suggest completions are fetched
            const projectManager = this.getProjectManager(uri);
            yield projectManager.ensureReferencedFiles(uri).toPromise();
            projectManager.didClose(uri);
            // Clear diagnostics
            this.client.textDocumentPublishDiagnostics({ uri, diagnostics: [] });
        });
    }
    /**
     * Generates and publishes diagnostics for a given file
     *
     * @param uri URI of the file to check
     */
    _publishDiagnostics(uri) {
        const config = this.getProjectManager(uri).getParentConfiguration(uri);
        if (!config) {
            return;
        }
        const fileName = utilities_1.uri2path(uri);
        const diagnostics = config.getService().getCompilerDiagnostics(fileName);
        if (this.settings.solidity.solium.enabled) {
            const soliumDiagnostics = config.getService().getSoliumDiagnostics(fileName, this.settings.solidity.solium.rules);
            diagnostics.push(...soliumDiagnostics);
        }
        if (this.settings.solidity.solhint.enabled) {
            const solhintDiagnostics = config.getService().getSolhintDiagnostics(fileName, this.settings.solidity.solhint.rules);
            diagnostics.push(...solhintDiagnostics);
        }
        this.client.textDocumentPublishDiagnostics({ uri, diagnostics });
    }
    /**
     * The Completion request is sent from the client to the server to compute completion items at a
     * given cursor position. Completion items are presented in the
     * [IntelliSense](https://code.visualstudio.com/docs/editor/editingevolved#_intellisense) user
     * interface. If computing full completion items is expensive, servers can additionally provide
     * a handler for the completion item resolve request ('completionItem/resolve'). This request is
     * sent when a completion item is selected in the user interface. A typically use case is for
     * example: the 'textDocument/completion' request doesn't fill in the `documentation` property
     * for returned completion items since it is expensive to compute. When the item is selected in
     * the user interface then a 'completionItem/resolve' request is sent with the selected
     * completion item as a param. The returned completion item should have the documentation
     * property filled in.
     *
     * @return Observable of JSON Patches that build a `CompletionList` result
     */
    textDocumentCompletion(params) {
        const uri = utilities_1.normalizeUri(params.textDocument.uri);
        const projectManager = this.getProjectManager(uri);
        // Ensure files needed to suggest completions are fetched
        return projectManager.ensureReferencedFiles(uri, undefined, undefined)
            .toArray()
            .mergeMap(() => {
            const fileName = utilities_1.uri2path(uri);
            const configuration = projectManager.getConfiguration(fileName);
            configuration.ensureConfigFile();
            const completions = configuration.getService().getCompletionsAtPosition(fileName, params.position);
            return rxjs_1.Observable.from(completions)
                .map(item => {
                return { op: "add", path: "/items/-", value: item };
            })
                .startWith({ op: "add", path: "/isIncomplete", value: false });
        })
            .startWith({ op: "add", path: "", value: { isIncomplete: true, items: [] } });
    }
}
exports.SolidityService = SolidityService;
//# sourceMappingURL=solidityService.js.map