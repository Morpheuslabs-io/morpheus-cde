"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
const rxjs_1 = require("@reactivex/rxjs");
/**
 * Converts a uri to an absolute path.
 * The OS style is determined by the URI. E.g. `file:///c:/foo` always results in `c:\foo`
 *
 * @param uri a file:// uri
 */
function uri2path(uri) {
    const parts = url.parse(uri);
    if (parts.protocol !== "file:") {
        throw new Error("Cannot resolve non-file uri to path: " + uri);
    }
    let filePath = parts.pathname || "";
    // If the path starts with a drive letter, return a Windows path
    if (/^\/[a-z]:\//i.test(filePath)) {
        filePath = filePath.substr(1).replace(/\//g, "\\");
    }
    return decodeURIComponent(filePath);
}
exports.uri2path = uri2path;
/**
 * Converts an abolute path to a file:// uri
 *
 * @param path an absolute path
 */
function path2uri(path) {
    // Require a leading slash, on windows prefixed with drive letter
    if (!/^(?:[a-z]:)?[\\\/]/i.test(path)) {
        throw new Error(`${path} is not an absolute path`);
    }
    const parts = path.split(/[\\\/]/);
    // If the first segment is a Windows drive letter, prefix with a slash and skip encoding
    let head = parts.shift();
    if (head !== "") {
        head = "/" + head;
    }
    else {
        head = encodeURIComponent(head);
    }
    return `file://${head}/${parts.map(encodeURIComponent).join("/")}`;
}
exports.path2uri = path2uri;
/**
 * Normalizes URI encoding by encoding _all_ special characters in the pathname
 */
function normalizeUri(uri) {
    const parts = url.parse(uri);
    if (!parts.pathname) {
        return uri;
    }
    const pathParts = parts.pathname.split("/").map(segment => encodeURIComponent(decodeURIComponent(segment)));
    // Decode Windows drive letter colon
    if (/^[a-z]%3A$/i.test(pathParts[1])) {
        pathParts[1] = decodeURIComponent(pathParts[1]);
    }
    parts.pathname = pathParts.join("/");
    return url.format(parts);
}
exports.normalizeUri = normalizeUri;
/**
 * Converts an Iterable to an Observable.
 * Workaround for https://github.com/ReactiveX/rxjs/issues/2306
 */
function observableFromIterable(iterable) {
    return rxjs_1.Observable.from(iterable);
}
exports.observableFromIterable = observableFromIterable;
/**
 * Normalizes path to match POSIX standard (slashes)
 * This conversion should only be necessary to convert windows paths when calling TS APIs.
 */
function toUnixPath(filePath) {
    return filePath.replace(/\\/g, "/");
}
exports.toUnixPath = toUnixPath;
//# sourceMappingURL=utilities.js.map