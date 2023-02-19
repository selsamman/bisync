import * as path from "path";
import * as fs from 'fs';
import assert from "assert";

const fsp = fs.promises;

type InfoType = "file" | "dir" | "error";

export interface Info {
    isDeleted: boolean,
    type: InfoType,
    dir : string,
    file : string,
    size: number,
    mtime: number, // file modified time
    time: number // current time
}

export async function pathInfo (p : string, deleted = false) : Promise<Info> {
    try {
        const stats = deleted ? {size: 0, mtime: new Date()} : await fsp.stat(p);
        let type: InfoType = "error";
        
        if (!deleted) {
            const _stats = (stats as fs.Stats);
            if (_stats.isDirectory()) type = "dir";
            else if (_stats.isFile()) type = "file";
        }

        return {
            isDeleted: deleted,
            type: type,
            dir: path.dirname(p),
            file: path.basename(p),
            size: stats.size,
            mtime: stats.size ? stats.mtime.getTime() : 0,
            time: (new Date()).getTime()
        };
    } catch (e) {
        return {
            type: "error",
            isDeleted: false,
            dir : '',
            file : '',
            size : 0,
            time: (new Date()).getTime(),
            mtime : 0,
        }
    }
}

export function getMirroredPath(fileInfo: Info, mirrorInfo: Info): string {
    assertInfoIsFile(fileInfo);

    // if mirror already points to a file - use as-is
    if (mirrorInfo.type === "file") return infoToPath(mirrorInfo);

    // if dir - use dir + basename
    else if (mirrorInfo.type === "dir") return path.join(mirrorInfo.dir, fileInfo.file);
    else {
        throw new Error(`Can't mirror path for unsupported Info type ${mirrorInfo.type}`);
    }
}

export function assertInfoIsFile(fileInfo: Info) {
    assert(fileInfo.type === "file", `fileInfo type is ${fileInfo.type}! (expected file)`);
}

export function infoToPath(info: Info): string {
    return path.join(info.dir, info.file);
}

/**
 * @returns true if the file either matches one of the group infos, or is contained in one of those (dirs)
 */
export function isFileInGroup(fileInfo: Info, group: Info[]): boolean {
    assertInfoIsFile(fileInfo);
    return group.some(grpItem => {
        isFileContainedInOther(fileInfo, grpItem);
    })
}

/**
 * @param fileInfo the file to check
 * @param other the container (could be same)
 * @returns true if other is either the same as fileInfo, or it's parent/ancestor dir
 */
export function isFileContainedInOther(fileInfo: Info, other: Info) {
    assertInfoIsFile(fileInfo);
    const filePath = infoToPath(fileInfo);
    const otherPath = infoToPath(other);
    if (other.type === "file") {
        return otherPath === filePath;
    } else if (other.type === "dir") {
        return fileInfo.dir.startsWith(otherPath);
    }
}


export function resolvePath(rootPath : string, relativePath : string) {
    if (path.isAbsolute(relativePath))
        return relativePath;
    return path.join(rootPath, relativePath);
}