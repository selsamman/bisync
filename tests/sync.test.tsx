import {DirSync} from "../DirSync";
import * as fs from 'fs';
const fsp = fs.promises;
const testDataDir = 'testData';

describe("File Sync Tests of DirSync.ts", () => {
    let sync : DirSync = new DirSync();
    beforeEach(async () => {
        sync = new DirSync();
        await fsp.mkdir(testDataDir);
    });
    afterEach(async() => {
        sync.quit();
        await fsp.rm(testDataDir, {recursive: true})
    });
    it("can sync single level", async () => {
        await fsp.mkdir(`${testDataDir}/from`);
        await fsp.mkdir(`${testDataDir}/to`);
        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'boo');
        await fsp.writeFile(`${testDataDir}/bisync.json`, JSON.stringify(
            [
                [`from`, `to`]
            ]
        ));
        await sync.setConfig(`${testDataDir}/bisync.json`);
        expect(!!await fsp.stat(`${testDataDir}/from/file1.txt`)).toBe(true);
        expect(await fileEventuallyExists(`${testDataDir}/to/file1.txt`)).toBe(true);
    });
});
async function fileEventuallyExists ( file : string) {
    return await new Promise( resolve => {
        const interval = setInterval(async () => {
            try {
                await fsp.stat(file);
                console.log(file + ' exists');
                clearInterval(interval);
                resolve(true);
            } catch {}
        }, 50);
    });
}