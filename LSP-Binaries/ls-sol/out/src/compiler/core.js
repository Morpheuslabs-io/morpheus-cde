"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reservedCharacterPattern = /[^\w\s\/]/g;
function toPath(fileName, basePath, getCanonicalFileName) {
    const nonCanonicalizedPath = isRootedDiskPath(fileName)
        ? normalizePath(fileName)
        : getNormalizedAbsolutePath(fileName, basePath);
    return getCanonicalFileName(nonCanonicalizedPath);
}
exports.toPath = toPath;
function getNormalizedAbsolutePath(fileName, currentDirectory) {
    return getNormalizedPathFromPathComponents(getNormalizedPathComponents(fileName, currentDirectory));
}
exports.getNormalizedAbsolutePath = getNormalizedAbsolutePath;
function getNormalizedPathFromPathComponents(pathComponents) {
    if (pathComponents && pathComponents.length) {
        return pathComponents[0] + pathComponents.slice(1).join(exports.directorySeparator);
    }
}
exports.getNormalizedPathFromPathComponents = getNormalizedPathFromPathComponents;
function getDirectoryPath(path) {
    return path.substr(0, Math.max(getRootLength(path), path.lastIndexOf(exports.directorySeparator)));
}
exports.getDirectoryPath = getDirectoryPath;
/**
 * Returns length of path root (i.e. length of "/", "x:/", "//server/share/, file:///user/files")
 */
function getRootLength(path) {
    if (path.charCodeAt(0) === 47 /* slash */) {
        if (path.charCodeAt(1) !== 47 /* slash */)
            return 1;
        const p1 = path.indexOf("/", 2);
        if (p1 < 0)
            return 2;
        const p2 = path.indexOf("/", p1 + 1);
        if (p2 < 0)
            return p1 + 1;
        return p2 + 1;
    }
    if (path.charCodeAt(1) === 58 /* colon */) {
        if (path.charCodeAt(2) === 47 /* slash */)
            return 3;
        return 2;
    }
    // Per RFC 1738 'file' URI schema has the shape file://<host>/<path>
    // if <host> is omitted then it is assumed that host value is 'localhost',
    // however slash after the omitted <host> is not removed.
    // file:///folder1/file1 - this is a correct URI
    // file://folder2/file2 - this is an incorrect URI
    if (path.lastIndexOf("file:///", 0) === 0) {
        return "file:///".length;
    }
    const idx = path.indexOf("://");
    if (idx !== -1) {
        return idx + "://".length;
    }
    return 0;
}
exports.getRootLength = getRootLength;
/**
 * Gets the actual offset into an array for a relative offset. Negative offsets indicate a
 * position offset from the end of the array.
 */
function toOffset(array, offset) {
    return offset < 0 ? array.length + offset : offset;
}
/**
 * Appends a range of value to an array, returning the array.
 *
 * @param to The array to which `value` is to be appended. If `to` is `undefined`, a new array
 * is created if `value` was appended.
 * @param from The values to append to the array. If `from` is `undefined`, nothing is
 * appended. If an element of `from` is `undefined`, that element is not appended.
 * @param start The offset in `from` at which to start copying values.
 * @param end The offset in `from` at which to stop copying values (non-inclusive).
 */
function addRange(to, from, start, end) {
    if (from === undefined || from.length === 0)
        return to;
    if (to === undefined)
        return from.slice(start, end);
    start = start === undefined ? 0 : toOffset(from, start);
    end = end === undefined ? from.length : toOffset(from, end);
    for (let i = start; i < end && i < from.length; i++) {
        const v = from[i];
        if (v !== undefined) {
            to.push(from[i]);
        }
    }
    return to;
}
exports.addRange = addRange;
/**
 * Returns the element at a specific offset in an array if non-empty, `undefined` otherwise.
 * A negative offset indicates the element should be retrieved from the end of the array.
 */
function elementAt(array, offset) {
    if (array) {
        offset = toOffset(array, offset);
        if (offset < array.length) {
            return array[offset];
        }
    }
    return undefined;
}
exports.elementAt = elementAt;
/**
 * Returns the first element of an array if non-empty, `undefined` otherwise.
 */
function firstOrUndefined(array) {
    return elementAt(array, 0);
}
exports.firstOrUndefined = firstOrUndefined;
/**
 * Returns the last element of an array if non-empty, `undefined` otherwise.
 */
function lastOrUndefined(array) {
    return elementAt(array, -1);
}
exports.lastOrUndefined = lastOrUndefined;
/**
 * Performs a binary search, finding the index at which 'value' occurs in 'array'.
 * If no such index is found, returns the 2's-complement of first index at which
 * number[index] exceeds number.
 * @param array A sorted array whose first element must be no larger than number
 * @param number The value to be searched for in the array.
 */
function binarySearch(array, value, comparer, offset) {
    if (!array || array.length === 0) {
        return -1;
    }
    let low = offset || 0;
    let high = array.length - 1;
    comparer = comparer !== undefined
        ? comparer
        : (v1, v2) => (v1 < v2 ? -1 : (v1 > v2 ? 1 : 0));
    while (low <= high) {
        const middle = low + ((high - low) >> 1);
        const midValue = array[middle];
        if (comparer(midValue, value) === 0) {
            return middle;
        }
        else if (comparer(midValue, value) > 0) {
            high = middle - 1;
        }
        else {
            low = middle + 1;
        }
    }
    return ~low;
}
exports.binarySearch = binarySearch;
/**
 * Iterates through `array` by index and performs the callback on each element of array until the callback
 * returns a falsey value, then returns false.
 * If no such value is found, the callback is applied to each element of array and `true` is returned.
 */
function every(array, callback) {
    if (array) {
        for (let i = 0; i < array.length; i++) {
            if (!callback(array[i], i)) {
                return false;
            }
        }
    }
    return true;
}
exports.every = every;
function some(array, predicate) {
    if (array) {
        if (predicate) {
            for (const v of array) {
                if (predicate(v)) {
                    return true;
                }
            }
        }
        else {
            return array.length > 0;
        }
    }
    return false;
}
exports.some = some;
function createMultiMap() {
    const map = createMap();
    map.add = multiMapAdd;
    map.remove = multiMapRemove;
    return map;
}
exports.createMultiMap = createMultiMap;
function multiMapAdd(key, value) {
    let values = this.get(key);
    if (values) {
        values.push(value);
    }
    else {
        this.set(key, values = [value]);
    }
    return values;
}
function multiMapRemove(key, value) {
    const values = this.get(key);
    if (values) {
        unorderedRemoveItem(values, value);
        if (!values.length) {
            this.delete(key);
        }
    }
}
/** Remove the *first* occurrence of `item` from the array. */
function unorderedRemoveItem(array, item) {
    unorderedRemoveFirstItemWhere(array, element => element === item);
}
exports.unorderedRemoveItem = unorderedRemoveItem;
/** Remove the *first* element satisfying `predicate`. */
function unorderedRemoveFirstItemWhere(array, predicate) {
    for (let i = 0; i < array.length; i++) {
        if (predicate(array[i])) {
            unorderedRemoveItemAt(array, i);
            break;
        }
    }
}
function unorderedRemoveItemAt(array, index) {
    // Fill in the "hole" left at `index`.
    array[index] = array[array.length - 1];
    array.pop();
}
exports.unorderedRemoveItemAt = unorderedRemoveItemAt;
/**
 * Internally, we represent paths as strings with '/' as the directory separator.
 * When we make system calls (eg: LanguageServiceHost.getDirectory()),
 * we expect the host to correctly handle paths in our specified format.
 */
exports.directorySeparator = "/";
const directorySeparatorCharCode = 47 /* slash */;
function normalizeSlashes(path) {
    return path.replace(/\\/g, "/");
}
exports.normalizeSlashes = normalizeSlashes;
function getNormalizedParts(normalizedSlashedPath, rootLength) {
    const parts = normalizedSlashedPath.substr(rootLength).split(exports.directorySeparator);
    const normalized = [];
    for (const part of parts) {
        if (part !== ".") {
            if (part === ".." && normalized.length > 0 && lastOrUndefined(normalized) !== "..") {
                normalized.pop();
            }
            else {
                // A part may be an empty string (which is 'falsy') if the path had consecutive slashes,
                // e.g. "path//file.ts".  Drop these before re-joining the parts.
                if (part) {
                    normalized.push(part);
                }
            }
        }
    }
    return normalized;
}
/** A path ending with '/' refers to a directory only, never a file. */
function pathEndsWithDirectorySeparator(path) {
    return path.charCodeAt(path.length - 1) === directorySeparatorCharCode;
}
exports.pathEndsWithDirectorySeparator = pathEndsWithDirectorySeparator;
function normalizePath(path) {
    path = normalizeSlashes(path);
    const rootLength = getRootLength(path);
    const root = path.substr(0, rootLength);
    const normalized = getNormalizedParts(path, rootLength);
    if (normalized.length) {
        const joinedParts = root + normalized.join(exports.directorySeparator);
        return pathEndsWithDirectorySeparator(path) ? joinedParts + exports.directorySeparator : joinedParts;
    }
    else {
        return root;
    }
}
exports.normalizePath = normalizePath;
function normalizePathAndParts(path) {
    path = normalizeSlashes(path);
    const rootLength = getRootLength(path);
    const root = path.substr(0, rootLength);
    const parts = getNormalizedParts(path, rootLength);
    if (parts.length) {
        const joinedParts = root + parts.join(exports.directorySeparator);
        return { path: pathEndsWithDirectorySeparator(path) ? joinedParts + exports.directorySeparator : joinedParts, parts };
    }
    else {
        return { path: root, parts };
    }
}
exports.normalizePathAndParts = normalizePathAndParts;
function combinePaths(path1, path2) {
    if (!(path1 && path1.length))
        return path2;
    if (!(path2 && path2.length))
        return path1;
    if (getRootLength(path2) !== 0)
        return path2;
    if (path1.charAt(path1.length - 1) === exports.directorySeparator)
        return path1 + path2;
    return path1 + exports.directorySeparator + path2;
}
exports.combinePaths = combinePaths;
function pathIsRelative(path) {
    return /^\.\.?($|[\\/])/.test(path);
}
exports.pathIsRelative = pathIsRelative;
function isExternalModuleNameRelative(moduleName) {
    // TypeScript 1.0 spec (April 2014): 11.2.1
    // An external module name is "relative" if the first term is "." or "..".
    // Update: We also consider a path like `C:\foo.ts` "relative" because we do not search for it in `node_modules` or treat it as an ambient module.
    return pathIsRelative(moduleName) || isRootedDiskPath(moduleName);
}
exports.isExternalModuleNameRelative = isExternalModuleNameRelative;
function isRootedDiskPath(path) {
    return getRootLength(path) !== 0;
}
exports.isRootedDiskPath = isRootedDiskPath;
/** Works like Array.prototype.findIndex, returning `-1` if no element satisfying the predicate is found. */
function findIndex(array, predicate) {
    for (let i = 0; i < array.length; i++) {
        if (predicate(array[i], i)) {
            return i;
        }
    }
    return -1;
}
exports.findIndex = findIndex;
/**
 * Flattens an array containing a mix of array or non-array elements.
 *
 * @param array The array to flatten.
 */
function flatten(array) {
    let result;
    if (array) {
        result = [];
        for (const v of array) {
            if (v) {
                if (isArray(v)) {
                    addRange(result, v);
                }
                else {
                    result.push(v);
                }
            }
        }
    }
    return result;
}
exports.flatten = flatten;
function matchFiles(path, extensions, excludes, includes, useCaseSensitiveFileNames, currentDirectory, depth, getFileSystemEntries) {
    path = normalizePath(path);
    currentDirectory = normalizePath(currentDirectory);
    const patterns = getFileMatcherPatterns(path, excludes, includes, useCaseSensitiveFileNames, currentDirectory);
    const regexFlag = useCaseSensitiveFileNames ? "" : "i";
    const includeFileRegexes = patterns.includeFilePatterns && patterns.includeFilePatterns.map(pattern => new RegExp(pattern, regexFlag));
    const includeDirectoryRegex = patterns.includeDirectoryPattern && new RegExp(patterns.includeDirectoryPattern, regexFlag);
    const excludeRegex = patterns.excludePattern && new RegExp(patterns.excludePattern, regexFlag);
    // Associate an array of results with each include regex. This keeps results in order of the "include" order.
    // If there are no "includes", then just put everything in results[0].
    const results = includeFileRegexes ? includeFileRegexes.map(() => []) : [[]];
    const comparer = useCaseSensitiveFileNames ? compareStrings : compareStringsCaseInsensitive;
    for (const basePath of patterns.basePaths) {
        visitDirectory(basePath, combinePaths(currentDirectory, basePath), depth);
    }
    return flatten(results);
    function visitDirectory(path, absolutePath, depth) {
        let { files, directories } = getFileSystemEntries(path);
        files = files.slice().sort(comparer);
        for (const current of files) {
            const name = combinePaths(path, current);
            const absoluteName = combinePaths(absolutePath, current);
            if (extensions && !fileExtensionIsOneOf(name, extensions))
                continue;
            if (excludeRegex && excludeRegex.test(absoluteName))
                continue;
            if (!includeFileRegexes) {
                results[0].push(name);
            }
            else {
                const includeIndex = findIndex(includeFileRegexes, re => re.test(absoluteName));
                if (includeIndex !== -1) {
                    results[includeIndex].push(name);
                }
            }
        }
        if (depth !== undefined) {
            depth--;
            if (depth === 0) {
                return;
            }
        }
        directories = directories.slice().sort(comparer);
        for (const current of directories) {
            const name = combinePaths(path, current);
            const absoluteName = combinePaths(absolutePath, current);
            if ((!includeDirectoryRegex || includeDirectoryRegex.test(absoluteName)) &&
                (!excludeRegex || !excludeRegex.test(absoluteName))) {
                visitDirectory(name, absoluteName, depth);
            }
        }
    }
}
exports.matchFiles = matchFiles;
function contains(array, value) {
    if (array) {
        for (const v of array) {
            if (v === value) {
                return true;
            }
        }
    }
    return false;
}
exports.contains = contains;
function indexOfAnyCharCode(text, charCodes, start) {
    for (let i = start || 0; i < text.length; i++) {
        if (contains(charCodes, text.charCodeAt(i))) {
            return i;
        }
    }
    return -1;
}
exports.indexOfAnyCharCode = indexOfAnyCharCode;
function removeTrailingDirectorySeparator(path) {
    if (path.charAt(path.length - 1) === exports.directorySeparator) {
        return path.substr(0, path.length - 1);
    }
    return path;
}
exports.removeTrailingDirectorySeparator = removeTrailingDirectorySeparator;
function compareValues(a, b) {
    if (a === b)
        return 0 /* EqualTo */;
    if (a === undefined)
        return -1 /* LessThan */;
    if (b === undefined)
        return 1 /* GreaterThan */;
    return a < b ? -1 /* LessThan */ : 1 /* GreaterThan */;
}
exports.compareValues = compareValues;
function compareStrings(a, b, ignoreCase) {
    if (a === b)
        return 0 /* EqualTo */;
    if (a === undefined)
        return -1 /* LessThan */;
    if (b === undefined)
        return 1 /* GreaterThan */;
    if (ignoreCase) {
        if (String.prototype.localeCompare) {
            const result = a.localeCompare(b, /*locales*/ undefined, { usage: "sort", sensitivity: "accent" });
            return result < 0 ? -1 /* LessThan */ : result > 0 ? 1 /* GreaterThan */ : 0 /* EqualTo */;
        }
        a = a.toUpperCase();
        b = b.toUpperCase();
        if (a === b)
            return 0 /* EqualTo */;
    }
    return a < b ? -1 /* LessThan */ : 1 /* GreaterThan */;
}
function compareStringsCaseInsensitive(a, b) {
    return compareStrings(a, b, /*ignoreCase*/ true);
}
const wildcardCharCodes = [42 /* asterisk */, 63 /* question */];
function getIncludeBasePath(absolute) {
    const wildcardOffset = indexOfAnyCharCode(absolute, wildcardCharCodes);
    if (wildcardOffset < 0) {
        // No "*" or "?" in the path
        return !hasExtension(absolute)
            ? absolute
            : removeTrailingDirectorySeparator(getDirectoryPath(absolute));
    }
    return absolute.substring(0, absolute.lastIndexOf(exports.directorySeparator, wildcardOffset));
}
/**
 * Computes the unique non-wildcard base paths amongst the provided include patterns.
 */
function getBasePaths(path, includes, useCaseSensitiveFileNames) {
    // Storage for our results in the form of literal paths (e.g. the paths as written by the user).
    const basePaths = [path];
    if (includes) {
        // Storage for literal base paths amongst the include patterns.
        const includeBasePaths = [];
        for (const include of includes) {
            // We also need to check the relative paths by converting them to absolute and normalizing
            // in case they escape the base path (e.g "..\somedirectory")
            const absolute = isRootedDiskPath(include) ? include : normalizePath(combinePaths(path, include));
            // Append the literal and canonical candidate base paths.
            includeBasePaths.push(getIncludeBasePath(absolute));
        }
        // Sort the offsets array using either the literal or canonical path representations.
        includeBasePaths.sort(useCaseSensitiveFileNames ? compareStrings : compareStringsCaseInsensitive);
        // Iterate over each include base path and include unique base paths that are not a
        // subpath of an existing base path
        for (const includeBasePath of includeBasePaths) {
            if (every(basePaths, basePath => !containsPath(basePath, includeBasePath, path, !useCaseSensitiveFileNames))) {
                basePaths.push(includeBasePath);
            }
        }
    }
    return basePaths;
}
function containsPath(parent, child, currentDirectory, ignoreCase) {
    if (parent === undefined || child === undefined)
        return false;
    if (parent === child)
        return true;
    parent = removeTrailingDirectorySeparator(parent);
    child = removeTrailingDirectorySeparator(child);
    if (parent === child)
        return true;
    const parentComponents = getNormalizedPathComponents(parent, currentDirectory);
    const childComponents = getNormalizedPathComponents(child, currentDirectory);
    if (childComponents.length < parentComponents.length) {
        return false;
    }
    for (let i = 0; i < parentComponents.length; i++) {
        const result = compareStrings(parentComponents[i], childComponents[i], ignoreCase);
        if (result !== 0 /* EqualTo */) {
            return false;
        }
    }
    return true;
}
exports.commonPackageFolders = ["node_modules", "bower_components", "jspm_packages"];
const implicitExcludePathRegexPattern = `(?!(${exports.commonPackageFolders.join("|")})(/|$))`;
const filesMatcher = {
    /**
     * Matches any single directory segment unless it is the last segment and a .min.js file
     * Breakdown:
     *  [^./]                   # matches everything up to the first . character (excluding directory seperators)
     *  (\\.(?!min\\.js$))?     # matches . characters but not if they are part of the .min.js file extension
     */
    singleAsteriskRegexFragment: "([^./]|(\\.(?!min\\.js$))?)*",
    /**
     * Regex for the ** wildcard. Matches any number of subdirectories. When used for including
     * files or directories, does not match subdirectories that start with a . character
     */
    doubleAsteriskRegexFragment: `(/${implicitExcludePathRegexPattern}[^/.][^/]*)*?`,
    replaceWildcardCharacter: match => replaceWildcardCharacter(match, filesMatcher.singleAsteriskRegexFragment)
};
const directoriesMatcher = {
    singleAsteriskRegexFragment: "[^/]*",
    /**
     * Regex for the ** wildcard. Matches any number of subdirectories. When used for including
     * files or directories, does not match subdirectories that start with a . character
     */
    doubleAsteriskRegexFragment: `(/${implicitExcludePathRegexPattern}[^/.][^/]*)*?`,
    replaceWildcardCharacter: match => replaceWildcardCharacter(match, directoriesMatcher.singleAsteriskRegexFragment)
};
const excludeMatcher = {
    singleAsteriskRegexFragment: "[^/]*",
    doubleAsteriskRegexFragment: "(/.+?)?",
    replaceWildcardCharacter: match => replaceWildcardCharacter(match, excludeMatcher.singleAsteriskRegexFragment)
};
const wildcardMatchers = {
    files: filesMatcher,
    directories: directoriesMatcher,
    exclude: excludeMatcher
};
function getRegularExpressionsForWildcards(specs, basePath, usage) {
    if (specs === undefined || specs.length === 0) {
        return undefined;
    }
    return flatMap(specs, spec => spec && getSubPatternFromSpec(spec, basePath, usage, wildcardMatchers[usage]));
}
/**
 * An "includes" path "foo" is implicitly a glob "foo/** /*" (without the space) if its last component has no extension,
 * and does not contain any glob characters itself.
 */
function isImplicitGlob(lastPathComponent) {
    return !/[.*?]/.test(lastPathComponent);
}
exports.isImplicitGlob = isImplicitGlob;
function getSubPatternFromSpec(spec, basePath, usage, { singleAsteriskRegexFragment, doubleAsteriskRegexFragment, replaceWildcardCharacter }) {
    let subpattern = "";
    let hasRecursiveDirectoryWildcard = false;
    let hasWrittenComponent = false;
    const components = getNormalizedPathComponents(spec, basePath);
    const lastComponent = lastOrUndefined(components);
    if (usage !== "exclude" && lastComponent === "**") {
        return undefined;
    }
    // getNormalizedPathComponents includes the separator for the root component.
    // We need to remove to create our regex correctly.
    components[0] = removeTrailingDirectorySeparator(components[0]);
    if (isImplicitGlob(lastComponent)) {
        components.push("**", "*");
    }
    let optionalCount = 0;
    for (let component of components) {
        if (component === "**") {
            if (hasRecursiveDirectoryWildcard) {
                return undefined;
            }
            subpattern += doubleAsteriskRegexFragment;
            hasRecursiveDirectoryWildcard = true;
        }
        else {
            if (usage === "directories") {
                subpattern += "(";
                optionalCount++;
            }
            if (hasWrittenComponent) {
                subpattern += exports.directorySeparator;
            }
            if (usage !== "exclude") {
                let componentPattern = "";
                // The * and ? wildcards should not match directories or files that start with . if they
                // appear first in a component. Dotted directories and files can be included explicitly
                // like so: **/.*/.*
                if (component.charCodeAt(0) === 42 /* asterisk */) {
                    componentPattern += "([^./]" + singleAsteriskRegexFragment + ")?";
                    component = component.substr(1);
                }
                else if (component.charCodeAt(0) === 63 /* question */) {
                    componentPattern += "[^./]";
                    component = component.substr(1);
                }
                componentPattern += component.replace(reservedCharacterPattern, replaceWildcardCharacter);
                // Patterns should not include subfolders like node_modules unless they are
                // explicitly included as part of the path.
                //
                // As an optimization, if the component pattern is the same as the component,
                // then there definitely were no wildcard characters and we do not need to
                // add the exclusion pattern.
                if (componentPattern !== component) {
                    subpattern += implicitExcludePathRegexPattern;
                }
                subpattern += componentPattern;
            }
            else {
                subpattern += component.replace(reservedCharacterPattern, replaceWildcardCharacter);
            }
        }
        hasWrittenComponent = true;
    }
    while (optionalCount > 0) {
        subpattern += ")?";
        optionalCount--;
    }
    return subpattern;
}
function getFileMatcherPatterns(path, excludes, includes, useCaseSensitiveFileNames, currentDirectory) {
    path = normalizePath(path);
    currentDirectory = normalizePath(currentDirectory);
    const absolutePath = combinePaths(currentDirectory, path);
    return {
        includeFilePatterns: map(getRegularExpressionsForWildcards(includes, absolutePath, "files"), pattern => `^${pattern}$`),
        includeFilePattern: getRegularExpressionForWildcard(includes, absolutePath, "files"),
        includeDirectoryPattern: getRegularExpressionForWildcard(includes, absolutePath, "directories"),
        excludePattern: getRegularExpressionForWildcard(excludes, absolutePath, "exclude"),
        basePaths: getBasePaths(path, includes, useCaseSensitiveFileNames)
    };
}
exports.getFileMatcherPatterns = getFileMatcherPatterns;
function replaceWildcardCharacter(match, singleAsteriskRegexFragment) {
    return match === "*" ? singleAsteriskRegexFragment : match === "?" ? "[^/]" : "\\" + match;
}
function getRegularExpressionForWildcard(specs, basePath, usage) {
    const patterns = getRegularExpressionsForWildcards(specs, basePath, usage);
    if (!patterns || !patterns.length) {
        return undefined;
    }
    const pattern = patterns.map(pattern => `(${pattern})`).join("|");
    // If excluding, match "foo/bar/baz...", but if including, only allow "foo".
    const terminator = usage === "exclude" ? "($|/)" : "$";
    return `^(${pattern})${terminator}`;
}
exports.getRegularExpressionForWildcard = getRegularExpressionForWildcard;
function getNormalizedPathComponents(path, currentDirectory) {
    path = normalizeSlashes(path);
    let rootLength = getRootLength(path);
    if (rootLength === 0) {
        // If the path is not rooted it is relative to current directory
        path = combinePaths(normalizeSlashes(currentDirectory), path);
        rootLength = getRootLength(path);
    }
    return normalizedPathComponents(path, rootLength);
}
function normalizedPathComponents(path, rootLength) {
    const normalizedParts = getNormalizedParts(path, rootLength);
    return [path.substr(0, rootLength)].concat(normalizedParts);
}
function endsWith(str, suffix) {
    const expectedPos = str.length - suffix.length;
    return expectedPos >= 0 && str.indexOf(suffix, expectedPos) === expectedPos;
}
function fileExtensionIs(path, extension) {
    return path.length > extension.length && endsWith(path, extension);
}
const solidityPattern = /\.sol$/;
function isSolidityFile(filename) {
    return solidityPattern.test(filename);
}
exports.isSolidityFile = isSolidityFile;
const packageJsonPattern = /(^|\/)package\.json$/;
function isPackageJsonFile(filename) {
    return packageJsonPattern.test(filename);
}
exports.isPackageJsonFile = isPackageJsonFile;
const ethPmJsonPattern = /(^|\/)ethpm\.json$/;
function isEthPmJsonFile(filename) {
    return ethPmJsonPattern.test(filename);
}
exports.isEthPmJsonFile = isEthPmJsonFile;
/** Create a new map. If a template object is provided, the map will copy entries from it. */
function createMap() {
    return new Map();
}
exports.createMap = createMap;
const hasOwnProperty = Object.prototype.hasOwnProperty;
function createMapFromTemplate(template) {
    const map = new Map();
    // Copies keys/values from template. Note that for..in will not throw if
    // template is undefined, and instead will just exit the loop.
    for (const key in template) {
        if (hasOwnProperty.call(template, key)) {
            map.set(key, template[key]);
        }
    }
    return map;
}
exports.createMapFromTemplate = createMapFromTemplate;
/**
 * Iterates through 'array' by index and performs the callback on each element of array until the callback
 * returns a truthy value, then returns that value.
 * If no such value is found, the callback is applied to each element of array and undefined is returned.
 */
function forEach(array, callback) {
    if (array) {
        for (let i = 0; i < array.length; i++) {
            const result = callback(array[i], i);
            if (result) {
                return result;
            }
        }
    }
    return undefined;
}
exports.forEach = forEach;
function getBaseFileName(path) {
    if (path === undefined) {
        return undefined;
    }
    const i = path.lastIndexOf(exports.directorySeparator);
    return i < 0 ? path : path.substring(i + 1);
}
exports.getBaseFileName = getBaseFileName;
function hasExtension(fileName) {
    return getBaseFileName(fileName).indexOf(".") >= 0;
}
exports.hasExtension = hasExtension;
function fileExtensionIsOneOf(path, extensions) {
    for (const extension of extensions) {
        if (fileExtensionIs(path, extension)) {
            return true;
        }
    }
    return false;
}
exports.fileExtensionIsOneOf = fileExtensionIsOneOf;
const extensionsToRemove = [".sol" /* Sol */];
function removeFileExtension(path) {
    for (const ext of extensionsToRemove) {
        const extensionless = tryRemoveExtension(path, ext);
        if (extensionless !== undefined) {
            return extensionless;
        }
    }
    return path;
}
exports.removeFileExtension = removeFileExtension;
function tryRemoveExtension(path, extension) {
    return fileExtensionIs(path, extension) ? removeExtension(path, extension) : undefined;
}
exports.tryRemoveExtension = tryRemoveExtension;
function removeExtension(path, extension) {
    return path.substring(0, path.length - extension.length);
}
exports.removeExtension = removeExtension;
/**
 *  List of supported extensions in order of file resolution precedence.
 */
exports.supportedSolidityExtensions = [".sol" /* Sol */];
function hasSolidityFileExtension(fileName) {
    return forEach(exports.supportedSolidityExtensions, extension => fileExtensionIs(fileName, extension));
}
exports.hasSolidityFileExtension = hasSolidityFileExtension;
/**
 * Tests whether a value is an array.
 */
function isArray(value) {
    return Array.isArray ? Array.isArray(value) : value instanceof Array;
}
exports.isArray = isArray;
/**
 * Tests whether a value is string
 */
function isString(text) {
    return typeof text === "string";
}
exports.isString = isString;
function map(array, f) {
    let result;
    if (array) {
        result = [];
        for (let i = 0; i < array.length; i++) {
            result.push(f(array[i], i));
        }
    }
    return result;
}
exports.map = map;
/**
 * Maps an array. If the mapped value is an array, it is spread into the result.
 *
 * @param array The array to map.
 * @param mapfn The callback used to map the result into one or more values.
 */
function flatMap(array, mapfn) {
    let result;
    if (array) {
        result = [];
        for (let i = 0; i < array.length; i++) {
            const v = mapfn(array[i], i);
            if (v) {
                if (isArray(v)) {
                    addRange(result, v);
                }
                else {
                    result.push(v);
                }
            }
        }
    }
    return result;
}
exports.flatMap = flatMap;
function filter(array, f) {
    if (array) {
        const len = array.length;
        let i = 0;
        while (i < len && f(array[i]))
            i++;
        if (i < len) {
            const result = array.slice(0, i);
            i++;
            while (i < len) {
                const item = array[i];
                if (f(item)) {
                    result.push(item);
                }
                i++;
            }
            return result;
        }
    }
    return array;
}
exports.filter = filter;
function dropWhile(array, f) {
    let result;
    let drop = true;
    if (array) {
        result = [];
        for (let i = 0; i < array.length; i++) {
            if (drop && !f(array[i])) {
                drop = false;
            }
            if (!drop) {
                result.push(array[i]);
            }
        }
    }
    return result;
}
exports.dropWhile = dropWhile;
function arrayFrom(iterator, map) {
    const result = [];
    for (let { value, done } = iterator.next(); !done; { value, done } = iterator.next()) {
        result.push(map ? map(value) : value);
    }
    return result;
}
exports.arrayFrom = arrayFrom;
function noop() { }
exports.noop = noop;
/** Do nothing and return false */
function returnFalse() { return false; }
exports.returnFalse = returnFalse;
/** Do nothing and return true */
function returnTrue() { return true; }
exports.returnTrue = returnTrue;
function memoize(callback) {
    let value;
    return () => {
        if (callback) {
            value = callback();
            callback = undefined;
        }
        return value;
    };
}
exports.memoize = memoize;
var Debug;
(function (Debug) {
    Debug.currentAssertionLevel = 0 /* None */;
    Debug.isDebugging = false;
    function shouldAssert(level) {
        return Debug.currentAssertionLevel >= level;
    }
    Debug.shouldAssert = shouldAssert;
    function assert(expression, message, verboseDebugInfo, stackCrawlMark) {
        if (!expression) {
            if (verboseDebugInfo) {
                message += "\r\nVerbose Debug Information: " + (typeof verboseDebugInfo === "string" ? verboseDebugInfo : verboseDebugInfo());
            }
            fail(message ? "False expression: " + message : "False expression.", stackCrawlMark || assert);
        }
    }
    Debug.assert = assert;
    function assertEqual(a, b, msg, msg2) {
        if (a !== b) {
            const message = msg ? msg2 ? `${msg} ${msg2}` : msg : "";
            fail(`Expected ${a} === ${b}. ${message}`);
        }
    }
    Debug.assertEqual = assertEqual;
    function assertLessThan(a, b, msg) {
        if (a >= b) {
            fail(`Expected ${a} < ${b}. ${msg || ""}`);
        }
    }
    Debug.assertLessThan = assertLessThan;
    function assertLessThanOrEqual(a, b) {
        if (a > b) {
            fail(`Expected ${a} <= ${b}`);
        }
    }
    Debug.assertLessThanOrEqual = assertLessThanOrEqual;
    function assertGreaterThanOrEqual(a, b) {
        if (a < b) {
            fail(`Expected ${a} >= ${b}`);
        }
    }
    Debug.assertGreaterThanOrEqual = assertGreaterThanOrEqual;
    function fail(message, stackCrawlMark) {
        debugger;
        const e = new Error(message ? `Debug Failure. ${message}` : "Debug Failure.");
        if (Error.captureStackTrace) {
            Error.captureStackTrace(e, stackCrawlMark || fail);
        }
        throw e;
    }
    Debug.fail = fail;
    function assertNever(member, message, stackCrawlMark) {
        return fail(message || `Illegal value: ${member}`, stackCrawlMark || assertNever);
    }
    Debug.assertNever = assertNever;
    function getFunctionName(func) {
        if (typeof func !== "function") {
            return "";
        }
        else if (func.hasOwnProperty("name")) {
            return func.name;
        }
        else {
            const text = Function.prototype.toString.call(func);
            const match = /^function\s+([\w\$]+)\s*\(/.exec(text);
            return match ? match[1] : "";
        }
    }
    Debug.getFunctionName = getFunctionName;
})(Debug = exports.Debug || (exports.Debug = {}));
function createGetCanonicalFileName(useCaseSensitiveFileNames) {
    return useCaseSensitiveFileNames
        ? ((fileName) => fileName)
        : ((fileName) => fileName.toLowerCase());
}
exports.createGetCanonicalFileName = createGetCanonicalFileName;
function sortAndDeduplicateDiagnostics(diagnostics) {
    return deduplicateSortedDiagnostics(diagnostics.sort(compareDiagnostics));
}
exports.sortAndDeduplicateDiagnostics = sortAndDeduplicateDiagnostics;
function deduplicateSortedDiagnostics(diagnostics) {
    if (diagnostics.length < 2) {
        return diagnostics;
    }
    const newDiagnostics = [diagnostics[0]];
    let previousDiagnostic = diagnostics[0];
    for (let i = 1; i < diagnostics.length; i++) {
        const currentDiagnostic = diagnostics[i];
        const isDupe = compareDiagnostics(currentDiagnostic, previousDiagnostic) === 0 /* EqualTo */;
        if (!isDupe) {
            newDiagnostics.push(currentDiagnostic);
            previousDiagnostic = currentDiagnostic;
        }
    }
    return newDiagnostics;
}
exports.deduplicateSortedDiagnostics = deduplicateSortedDiagnostics;
function compareDiagnostics(d1, d2) {
    return compareValues(d1.range.start, d2.range.start) ||
        compareValues(d1.range.end, d2.range.end) ||
        compareValues(d1.severity, d2.severity) ||
        compareValues(d1.code, d2.code) ||
        compareValues(d1.source, d2.source) ||
        compareStrings(d1.message, d2.message) ||
        0 /* EqualTo */;
}
exports.compareDiagnostics = compareDiagnostics;
//# sourceMappingURL=core.js.map