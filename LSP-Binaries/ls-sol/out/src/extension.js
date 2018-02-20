"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const vscode_languageclient_1 = require("vscode-languageclient");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "solidity-language-server" is now active!');
    const serverModule = path.join(__dirname, "server", "languageServerIpc.js");
    const serverOptions = {
        debug: {
            module: serverModule,
            options: {
                execArgv: ["--nolazy", "--debug=6004"],
            },
            transport: vscode_languageclient_1.TransportKind.ipc,
        },
        run: {
            module: serverModule,
            transport: vscode_languageclient_1.TransportKind.ipc,
        },
    };
    const clientOptions = {
        documentSelector: ["solidity"],
        synchronize: {
            configurationSection: "solidity" // Synchronize the setting section 'solidity' to the server
        }
    };
    const clientDisposible = new vscode_languageclient_1.LanguageClient("solidity", "Solidity Language Server", serverOptions, clientOptions).start();
    // Push the disposable to the context's subscriptions so that the
    // client can be deactivated on extension deactivation
    context.subscriptions.push(clientDisposible);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map