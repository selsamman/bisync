import * as fs from 'fs';
import {execSync} from "child_process";
export const fsp = fs.promises;

export async function fileExists(file : string) {
    try {
        await fsp.stat(file);
        return true;
    } catch (_e) {
        return false;
    }
}
export async function fileEventuallyExists ( file : string) {
    return await new Promise( resolve => {
        const interval = setInterval(async () => {
            try {
                await fsp.stat(file);
                clearInterval(interval);
                resolve(true);
            } catch {}
        }, 50);
    });
}
export async function fileEventuallyContains ( file : string, value : string) {
    return await new Promise( resolve => {
        const interval = setInterval(async () => {
            const data : string = (await fsp.readFile(file)).toString();
            if (data === value) {
                clearInterval(interval);
                resolve(true);
            }
        }, 50);
    });
}
export async function fileEventuallyDeleted ( file : string) {
    return await new Promise( resolve => {
        const interval = setInterval(async () => {
            try {
                await fsp.stat(file);
                console.log(`${file} exists`);
            } catch {
                console.log(file + ' deleted');
                clearInterval(interval);
                resolve(true);
            }
        }, 50);
    });
}
export function trim(str : string) {
    return str.replace(/\n/, '')
        .replace(/\r/, '')
        .replace(/\\/g, "/");
}