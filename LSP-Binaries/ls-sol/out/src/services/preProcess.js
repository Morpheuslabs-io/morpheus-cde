"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const language_solidity_1 = require("language-solidity");
function preProcessFile(sourceText) {
    const scanner = new language_solidity_1.Scanner(new language_solidity_1.CharStream(sourceText));
    const importedFiles = [];
    function nextToken() {
        return scanner.next();
    }
    function tokenText() {
        return scanner.currentLiteral;
    }
    function getFileReference() {
        const fileName = scanner.currentLiteral;
        const pos = scanner.currentLocation;
        return { fileName, pos: pos.start, end: pos.end };
    }
    function recordModuleName() {
        importedFiles.push(getFileReference());
    }
    /**
     * Returns true if at least one token was consumed from the stream
     */
    function tryConsumeImport() {
        let token = scanner.currentToken;
        if (token === language_solidity_1.TokenName.Import) {
            token = nextToken();
            if (token === language_solidity_1.TokenName.StringLiteral) {
                // import "mod";
                recordModuleName();
                return true;
            }
            else {
                if (token === language_solidity_1.TokenName.LBrace) {
                    token = nextToken();
                    // consume "{ a as B, c, d as D}" clauses
                    // make sure that it stops on EOF
                    while (token !== language_solidity_1.TokenName.RBrace && token !== language_solidity_1.TokenName.EOS) {
                        token = nextToken();
                    }
                    if (token === language_solidity_1.TokenName.RBrace) {
                        token = nextToken();
                        if (token === language_solidity_1.TokenName.StringLiteral && tokenText() === "from") {
                            token = nextToken();
                            if (token === language_solidity_1.TokenName.StringLiteral) {
                                // import {a as A} from "mod";
                                recordModuleName();
                            }
                        }
                    }
                }
                else if (token === language_solidity_1.TokenName.Mul) {
                    token = nextToken();
                    if (token === language_solidity_1.TokenName.As) {
                        token = nextToken();
                        if (token === language_solidity_1.TokenName.Identifier) {
                            token = nextToken();
                            if (token === language_solidity_1.TokenName.StringLiteral && tokenText() === "from") {
                                token = nextToken();
                                if (token === language_solidity_1.TokenName.StringLiteral) {
                                    // import * as NS from "mod"
                                    recordModuleName();
                                }
                            }
                        }
                    }
                }
            }
            return true;
        }
        return false;
    }
    function processImports() {
        scanner.resetSource(new language_solidity_1.CharStream(sourceText), "");
        nextToken();
        // Look for:
        //    import "mod";
        //    import {a as A } from "mod";
        //    import * as NS  from "mod"
        while (true) {
            if (scanner.currentToken === language_solidity_1.TokenName.EOS) {
                break;
            }
            if (tryConsumeImport()) {
                continue;
            }
            else {
                nextToken();
            }
        }
        scanner.reset();
    }
    processImports();
    return { importedFiles };
}
exports.preProcessFile = preProcessFile;
//# sourceMappingURL=preProcess.js.map