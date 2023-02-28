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
export async function fileEventuallyExists ( file : string, timeout: number = 500) {
    return await new Promise( resolve => {
        let timePassed = 0;
        let delta = 50;
        const interval = setInterval(async () => {
            try {
                const stat = await fsp.stat(file);
                clearInterval(interval);
                resolve(stat.isFile());
            } catch {
                timePassed += delta;
                if (timePassed >= timeout) resolve(false);
            }
        }, delta);
    });
}
export async function fileEventuallyContains ( file : string, value : string, timeout: number = 500) {
    return await new Promise( resolve => {
        let timePassed = 0;
        let delta = 50;
        const interval = setInterval(async () => {
            try
            {
                const data : string = (await fsp.readFile(file)).toString();
                if (data === value) {
                    clearInterval(interval);
                    resolve(true);
                }
                
                timePassed += delta;
                if (timePassed >= timeout) resolve(false);
        } catch {
            resolve(false);
        }
        }, delta);
    });
}
export async function fileEventuallyDeleted ( file : string, timeout: number = 500) {
    return await new Promise( resolve => {
        let timePassed = 0;
            let delta = 50;
        const interval = setInterval(async () => {
            try {
                await fsp.stat(file);
                console.log(`${file} exists`);
                timePassed += delta;
                if (timePassed >= timeout) resolve(false);
            } catch {
                console.log(file + ' deleted');
                clearInterval(interval);
                resolve(true);
            }
        }, delta);
    });
}
export function trim(str : string) {
    return str.replace(/\n/, '')
        .replace(/\r/, '')
        .replace(/\\/g, "/");
}