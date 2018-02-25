"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageserver_1 = require("vscode-languageserver");
const solparse = require("solparse");
function getGlobalFunctionCompletions() {
    return [
        {
            detail: "assert(bool condition): throws if the condition is not met - to be used for internal errors.",
            insertText: "assert(${1:condition});",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Function,
            label: "assert",
        },
        {
            detail: "require(bool condition): throws if the condition is not met - to be used for errors in inputs or external components.",
            insertText: "require(${1:condition});",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Method,
            label: "require",
        },
        {
            detail: "revert(): abort execution and revert state changes",
            insertText: "revert();",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Method,
            label: "revert",
        },
        {
            detail: "addmod(uint x, uint y, uint k) returns (uint):" +
                "compute (x + y) % k where the addition is performed with arbitrary precision and does not wrap around at 2**256",
            insertText: "addmod(${1:x},${2:y},${3:k})",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Method,
            label: "addmod",
        },
        {
            detail: "mulmod(uint x, uint y, uint k) returns (uint):" +
                "compute (x * y) % k where the multiplication is performed with arbitrary precision and does not wrap around at 2**256",
            insertText: "mulmod(${1:x},${2:y},${3:k})",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Method,
            label: "mulmod",
        },
        {
            detail: "keccak256(...) returns (bytes32):" +
                "compute the Ethereum-SHA-3 (Keccak-256) hash of the (tightly packed) arguments",
            insertText: "keccak256(${1:x})",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Method,
            label: "keccak256",
        },
        {
            detail: "sha256(...) returns (bytes32):" +
                "compute the SHA-256 hash of the (tightly packed) arguments",
            insertText: "sha256(${1:x})",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Method,
            label: "sha256",
        },
        {
            detail: "sha3(...) returns (bytes32):" +
                "alias to keccak256",
            insertText: "sha3(${1:x})",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Method,
            label: "sha3",
        },
        {
            detail: "ripemd160(...) returns (bytes20):" +
                "compute RIPEMD-160 hash of the (tightly packed) arguments",
            insertText: "ripemd160(${1:x})",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Method,
            label: "ripemd160",
        },
        {
            detail: "ecrecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) returns (address):" +
                "recover the address associated with the public key from elliptic curve signature or return zero on error",
            insertText: "ecrecover(${1:hash},${2:v},${3:r},${4:s})",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Method,
            label: "ecrecover",
        },
    ];
}
function getGlobalVariableCompletions() {
    return [
        {
            detail: "Current block",
            kind: vscode_languageserver_1.CompletionItemKind.Variable,
            label: "block",
        },
        {
            detail: "Current message",
            kind: vscode_languageserver_1.CompletionItemKind.Variable,
            label: "msg",
        },
        {
            detail: "(uint): current block timestamp (alias for block.timestamp)",
            kind: vscode_languageserver_1.CompletionItemKind.Variable,
            label: "now",
        },
        {
            detail: "Current transaction",
            kind: vscode_languageserver_1.CompletionItemKind.Variable,
            label: "tx",
        },
    ];
}
function getTypeCompletions() {
    const types = ["address", "string", "bytes", "byte", "int", "uint", "bool", "hash"];
    return types.map(type => {
        const item = vscode_languageserver_1.CompletionItem.create(type);
        item.kind = vscode_languageserver_1.CompletionItemKind.Keyword;
        item.detail = type + " type";
        return item;
    });
}
function getUnitCompletions() {
    const etherUnits = ["wei", "finney", "szabo", "ether"];
    const etherUnitCompletions = etherUnits.map(etherUnit => {
        const item = vscode_languageserver_1.CompletionItem.create(etherUnit);
        item.kind = vscode_languageserver_1.CompletionItemKind.Unit;
        item.detail = etherUnit + ": ether unit";
        return item;
    });
    const timeUnits = ["seconds", "minutes", "hours", "days", "weeks", "years"];
    const timeUnitCompletions = timeUnits.map(timeUnit => {
        const item = vscode_languageserver_1.CompletionItem.create(timeUnit);
        item.kind = vscode_languageserver_1.CompletionItemKind.Unit;
        item.detail = timeUnit + ": time unit";
        return item;
    });
    return etherUnitCompletions.concat(timeUnitCompletions);
}
function getCompletionsAtPosition(host, fileName, position) {
    if (host.readFile) {
        const text = host.readFile(fileName);
        const lineTexts = text.split(/\r?\n/g);
        const lineText = lineTexts[position.line];
        const { triggeredByDot, wordEndCharacter } = isCompletionTriggeredByDot(lineText, position.character);
        if (triggeredByDot) {
            return getContextualCompletions(lineText, wordEndCharacter);
        }
        else {
            return getAllCompletions(text);
        }
    }
    return [];
}
exports.getCompletionsAtPosition = getCompletionsAtPosition;
function getAllCompletions(text) {
    let result;
    try {
        result = solparse.parse(text);
    }
    catch (err) {
        return [];
    }
    const completionItems = [];
    for (const element of result.body) {
        if (element.type !== "ContractStatement" && element.type !== "LibraryStatement") {
            continue;
        }
        if (typeof element.body === "undefined" || element.body === null) {
            continue;
        }
        const contractName = element.name;
        for (const contractElement of element.body) {
            switch (contractElement.type) {
                case "FunctionDeclaration":
                    if (contractElement.name !== contractName) {
                        completionItems.push(createFunctionEventCompletionItem(contractElement, "function", contractName));
                    }
                    break;
                case "EventDeclaration":
                    completionItems.push(createFunctionEventCompletionItem(contractElement, "event", contractName));
                    break;
                case "StateVariableDeclaration":
                    const typeStr = typeStringFromLiteral(contractElement.literal);
                    const completionItem = vscode_languageserver_1.CompletionItem.create(contractElement.name);
                    completionItem.kind = vscode_languageserver_1.CompletionItemKind.Field;
                    completionItem.detail = "(state variable in " + contractName + ") " + typeStr + " " + contractElement.name;
                    completionItems.push(completionItem);
                    break;
            }
        }
    }
    const completions = [
        ...completionItems,
        ...getGlobalFunctionCompletions(),
        ...getGlobalVariableCompletions(),
        ...getTypeCompletions(),
        ...getUnitCompletions()
    ];
    return completions;
}
function isCompletionTriggeredByDot(line, character) {
    let start = 0;
    let triggeredByDot = false;
    for (let i = character; i >= 0; i--) {
        if (line[i] === " ") {
            triggeredByDot = false;
            i = 0;
            start = 0;
            break;
        }
        if (line[i] === ".") {
            start = i;
            i = 0;
            triggeredByDot = true;
            break;
        }
    }
    return {
        triggeredByDot,
        wordEndCharacter: start
    };
}
function getContextualCompletions(lineText, wordEndCharacter) {
    if (isCompletionTrigeredByVariableName("block", lineText, wordEndCharacter)) {
        return getBlockCompletions();
    }
    else if (isCompletionTrigeredByVariableName("msg", lineText, wordEndCharacter)) {
        return getMsgCompletions();
    }
    else if (isCompletionTrigeredByVariableName("tx", lineText, wordEndCharacter)) {
        return getTxCompletions();
    }
    else {
        return [];
    }
}
function isCompletionTrigeredByVariableName(variableName, lineText, wordEndCharacter) {
    const length = variableName.length;
    if (wordEndCharacter >= length
        && lineText.substr(wordEndCharacter - length, length) === variableName) {
        return true;
    }
    return false;
}
function createFunctionEventCompletionItem(contractElement, type, contractName) {
    const completionItem = vscode_languageserver_1.CompletionItem.create(contractElement.name);
    const paramsInfo = createParamsInfo(contractElement.params);
    const paramsSnippet = createFunctionParamsSnippet(contractElement.params);
    let returnParamsInfo = createParamsInfo(contractElement.returnParams);
    if (returnParamsInfo !== "") {
        returnParamsInfo = " returns (" + returnParamsInfo + ")";
    }
    const info = "(" + type + " in " + contractName + ") " + contractElement.name + "(" + paramsInfo + ")" + returnParamsInfo;
    completionItem.kind = vscode_languageserver_1.CompletionItemKind.Function;
    completionItem.insertTextFormat = 2;
    completionItem.insertText = contractElement.name + "(" + paramsSnippet + ");";
    completionItem.documentation = info;
    completionItem.detail = info;
    return completionItem;
}
function typeStringFromLiteral(literal) {
    let isMapping = false;
    let suffixType = "";
    const literalType = literal.literal;
    if (typeof literalType.type !== "undefined") {
        isMapping = literalType.type === "MappingExpression";
        if (isMapping) {
            suffixType = "(" + typeStringFromLiteral(literalType.from) + " => " + typeStringFromLiteral(literalType.to) + ")";
        }
    }
    const isArray = literal.array_parts.length > 0;
    if (isArray) {
        suffixType = suffixType + "[]";
    }
    if (isMapping) {
        return "mapping" + suffixType;
    }
    return literalType + suffixType;
}
function createParamsInfo(params) {
    if (typeof params === "undefined" || params === null) {
        return "";
    }
    let paramsInfo = "";
    for (const paramElement of params) {
        const typStr = typeStringFromLiteral(paramElement.literal);
        let currentParamInfo = "";
        if (typeof paramElement.id === "undefined" || paramElement.id === null) {
            currentParamInfo = typStr;
        }
        else {
            currentParamInfo = typStr + " " + paramElement.id;
        }
        if (paramsInfo === "") {
            paramsInfo = currentParamInfo;
        }
        else {
            paramsInfo = paramsInfo + ", " + currentParamInfo;
        }
    }
    return paramsInfo;
}
function createFunctionParamsSnippet(params) {
    if (typeof params === "undefined" || params === null) {
        return "";
    }
    let paramsSnippet = "";
    let counter = 0;
    for (const paramElement of params) {
        counter = counter + 1;
        const currentParamSnippet = "${" + counter + ":" + paramElement.id + "}";
        if (paramsSnippet === "") {
            paramsSnippet = currentParamSnippet;
        }
        else {
            paramsSnippet = paramsSnippet + ", " + currentParamSnippet;
        }
    }
    return paramsSnippet;
}
function getBlockCompletions() {
    return [
        {
            detail: "(address): Current block miner’s address",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "coinbase"
        },
        {
            detail: "(bytes32): Hash of the given block - only works for 256 most recent blocks excluding current",
            insertText: "blockhash(${1:blockNumber});",
            insertTextFormat: 2,
            kind: vscode_languageserver_1.CompletionItemKind.Method,
            label: "blockhash"
        },
        {
            detail: "(uint): current block difficulty",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "difficulty"
        },
        {
            detail: "(uint): current block gaslimit",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "gasLimit"
        },
        {
            detail: "(uint): current block number",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "number"
        },
        {
            detail: "(uint): current block timestamp as seconds since unix epoch",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "timestamp"
        }
    ];
}
function getTxCompletions() {
    return [
        {
            detail: "(uint): gas price of the transaction",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "gas",
        },
        {
            detail: "(address): sender of the transaction (full call chain)",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "origin",
        },
    ];
}
function getMsgCompletions() {
    return [
        {
            detail: "(bytes): complete calldata",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "data"
        },
        {
            detail: "(uint): remaining gas",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "gas"
        },
        {
            detail: "(address): sender of the message (current call)",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "sender"
        },
        {
            detail: "(bytes4): first four bytes of the calldata (i.e. function identifier)",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "sig"
        },
        {
            detail: "(uint): number of wei sent with the message",
            kind: vscode_languageserver_1.CompletionItemKind.Property,
            label: "value"
        }
    ];
}
//# sourceMappingURL=completions.js.map