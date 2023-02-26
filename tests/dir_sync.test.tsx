import {DirSync} from "../DirSync";
import * as fs from 'fs';
const fsp = fs.promises;
import {fileEventuallyContains, fileEventuallyDeleted, fileExists, fileEventuallyExists, trim} from "./test_helpers";

describe("Dir Sync Tests of DirSync.ts", () => {
    const testDataDir = 'testData_dirSync';
    let sync : DirSync = new DirSync();
    beforeEach(async () => {
        sync = new DirSync();
        try{await fsp.rm(testDataDir, {recursive: true})} catch (_e) {}
        try{await fsp.mkdir(testDataDir);} catch (_e) {}
    });
    afterEach(async() => {
        sync.quit();
        await fsp.rm(testDataDir, {recursive: true})
    });
    it("on initialize can sync single level", async () => {
        await fsp.mkdir(`${testDataDir}/from`);
        await fsp.mkdir(`${testDataDir}/to`);
        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'boo');
        await writeConfig();
        await sync.setConfig(`${testDataDir}/bisync.json`);
        expect(!!await fsp.stat(`${testDataDir}/from/file1.txt`)).toBe(true);
        expect(await fileEventuallyExists(`${testDataDir}/to/file1.txt`)).toBe(true);
    });
    it("on initialize can sync multi level", async () => {
        await fsp.mkdir(`${testDataDir}/from/somewhere/else`, {recursive: true});
        await fsp.writeFile(`${testDataDir}/from/somewhere/else/file1.txt`, 'boo');
        await writeConfig();
        await sync.setConfig(`${testDataDir}/bisync.json`);
        expect(!!await fsp.stat(`${testDataDir}/from/somewhere/else/file1.txt`)).toBe(true);
        expect(await fileEventuallyExists(`${testDataDir}/to/somewhere/else/file1.txt`)).toBe(true);
    });
    it("post initialize can remove single level", async () => {
        await fsp.mkdir(`${testDataDir}/from`);
        await fsp.mkdir(`${testDataDir}/to`);
        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'boo');
        await fsp.writeFile(`${testDataDir}/to/file1.txt`, 'boo');
        await writeConfig();
        await sync.setConfig(`${testDataDir}/bisync.json`);
        await new Promise(r => setTimeout(() => r(true), 200)); // Allow init to finish
        expect(!!await fsp.stat(`${testDataDir}/from/file1.txt`)).toBe(true);
        expect(!!await fsp.stat(`${testDataDir}/to/file1.txt`)).toBe(true);
        await fsp.rm(`${testDataDir}/from/file1.txt`);
        expect(await fileEventuallyDeleted(`${testDataDir}/to/file1.txt`)).toBe(true);
    });
    it("post initialize can remove multi level", async () => {
        await fsp.mkdir(`${testDataDir}/from/somewhere/else`, {recursive: true});
        await fsp.mkdir(`${testDataDir}/to/somewhere/else`, {recursive: true});
        await fsp.writeFile(`${testDataDir}/from/somewhere/else/file1.txt`, 'boo');
        await fsp.writeFile(`${testDataDir}/to/somewhere/else/file1.txt`, 'boo');
        await writeConfig();
        await sync.setConfig(`${testDataDir}/bisync.json`);
        await new Promise(r => setTimeout(() => r(true), 200)); // Allow init to finish
        //        expect(!!await fsp.stat(`${testDataDir}/from/somewhere/else/file1.txt`)).toBe(true);
        expect(!!await fsp.stat(`${testDataDir}/to/somewhere/else/file1.txt`)).toBe(true);
        await fsp.rm(`${testDataDir}/from/somewhere/else/file1.txt`);
        expect(await fileEventuallyDeleted(`${testDataDir}/to/somewhere/else/file1.txt`)).toBe(true);
    });
    it("change file within synced dirs", async () => {
        await fsp.mkdir(`${testDataDir}/from`);
        await fsp.mkdir(`${testDataDir}/to`);
        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'boo');
        await fsp.writeFile(`${testDataDir}/to/file1.txt`, 'boo');
        await writeConfig();
        await sync.setConfig(`${testDataDir}/bisync.json`);
        await new Promise(r => setTimeout(() => r(true), 200)); // Allow init to finish
        expect(!!await fsp.stat(`${testDataDir}/from/file1.txt`)).toBe(true);
        expect(!!await fsp.stat(`${testDataDir}/to/file1.txt`)).toBe(true);
        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'hoo');
        expect(await fileEventuallyContains(`${testDataDir}/to/file1.txt`, 'hoo')).toBe(true);
    });

    async function writeConfig() {
        await fsp.writeFile(`${testDataDir}/bisync.json`, JSON.stringify(
            [
                [`from`, `to`]
            ]
        ));
    }
});

