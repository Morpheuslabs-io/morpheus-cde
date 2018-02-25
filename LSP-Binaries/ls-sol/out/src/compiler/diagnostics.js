"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
function solcErrToDiagnostic(error) {
    const { message, formattedMessage, severity } = error;
    const errorSegments = formattedMessage.split(":");
    const line = parseInt(errorSegments[1]);
    const column = parseInt(errorSegments[2]);
    return {
        message,
        range: {
            start: {
                line: line - 1,
                character: column
            },
            end: {
                line: line - 1,
                character: column
            },
        },
        severity: getDiagnosticSeverity(severity)
    };
}
exports.solcErrToDiagnostic = solcErrToDiagnostic;
function getDiagnosticSeverity(severity) {
    switch (severity) {
        case "error":
            return vscode_languageserver_1.DiagnosticSeverity.Error;
        case "warning":
            return vscode_languageserver_1.DiagnosticSeverity.Warning;
        default:
            return vscode_languageserver_1.DiagnosticSeverity.Error;
    }
}
function soliumErrObjectToDiagnostic(errObject) {
    const line = errObject.line - 1;
    const severity = errObject.type === "warning" ? vscode_languageserver_1.DiagnosticSeverity.Warning : vscode_languageserver_1.DiagnosticSeverity.Error;
    return {
        message: `${errObject.ruleName}: ${errObject.message}`,
        range: {
            start: { character: errObject.column, line },
            end: { character: errObject.node.end, line }
        },
        severity,
    };
}
exports.soliumErrObjectToDiagnostic = soliumErrObjectToDiagnostic;
function solhintErrObjectToDiagnostic(errObject) {
    const line = errObject.line - 1;
    const character = errObject.column - 1;
    const severity = (errObject.severity === 3) ? vscode_languageserver_1.DiagnosticSeverity.Warning : vscode_languageserver_1.DiagnosticSeverity.Error;
    return {
        message: `${errObject.message} [${errObject.ruleId}]`,
        range: {
            start: { line, character },
            end: { line, character: character + 1 },
        },
        severity
    };
}
exports.solhintErrObjectToDiagnostic = solhintErrObjectToDiagnostic;
//# sourceMappingURL=diagnostics.js.map