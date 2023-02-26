import {DirSync} from "../DirSync";
import * as fs from 'fs';
import {execSync} from "child_process";
const fsp = fs.promises;
const configFile = `${require('os').homedir()}/.bisync`;
import {fileEventuallyContains, fileEventuallyDeleted, fileExists, fileEventuallyExists, trim} from "./test_helpers";

describe("File Sync Tests of DirSync.ts", () => {
    const testDataDir = 'testData_fileSync';
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

    it("change individual file", async () => {
        await fsp.mkdir(`${testDataDir}/from`);
        await fsp.mkdir(`${testDataDir}/to`);
        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'boo');
        await fsp.writeFile(`${testDataDir}/to/file1.txt`, 'boo');
        await fsp.writeFile(`${testDataDir}/bisync.json`, JSON.stringify(
            [
                [`from/file1.txt`, `to/file1.txt`]
            ]
        ));
        await sync.setConfig(`${testDataDir}/bisync.json`);
        await new Promise(r => setTimeout(() => r(true), 200)); // Allow init to finish
        expect(!!(await fsp.stat(`${testDataDir}/from/file1.txt`))).toBe(true);
        expect(!!(await fsp.stat(`${testDataDir}/to/file1.txt`))).toBe(true);        

        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'hoo');
        expect(await fileEventuallyContains(`${testDataDir}/to/file1.txt`, 'hoo')).toBe(true);

        await new Promise(f => setTimeout(() => f(true), 100));

        await fsp.writeFile(`${testDataDir}/to/file1.txt`, 'hoooo');
        expect(await fileEventuallyContains(`${testDataDir}/from/file1.txt`, 'hoooo')).toBe(true);
    });

    it("add individual file", async () => {
        await fsp.mkdir(`${testDataDir}/from`);
        await fsp.mkdir(`${testDataDir}/to`);
        await fsp.writeFile(`${testDataDir}/bisync.json`, JSON.stringify(
            [
                [`from/file1.txt`, `to/file1.txt`]
            ]
        ));
        await sync.setConfig(`${testDataDir}/bisync.json`);
        await new Promise(r => setTimeout(() => r(true), 200)); // Allow init to finish

        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'boo');
        expect(await fileEventuallyExists(`${testDataDir}/to/file1.txt`)).toBe(true);

        await new Promise(f => setTimeout(() => f(true), 100));

        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'hoo');
        expect(await fileEventuallyContains(`${testDataDir}/from/file1.txt`, 'hoo')).toBe(true);
    });

    it("delete individual file", async () => {
        await fsp.mkdir(`${testDataDir}/from`);
        await fsp.mkdir(`${testDataDir}/to`);
        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'boo');
        await fsp.writeFile(`${testDataDir}/to/file1.txt`, 'boo');
        await fsp.writeFile(`${testDataDir}/bisync.json`, JSON.stringify(
            [
                [`from/file1.txt`, `to/file1.txt`]
            ]
        ));
        await sync.setConfig(`${testDataDir}/bisync.json`);
        await new Promise(r => setTimeout(() => r(true), 200)); // Allow init to finish
        expect(!!await fsp.stat(`${testDataDir}/from/file1.txt`)).toBe(true);
        expect(!!await fsp.stat(`${testDataDir}/to/file1.txt`)).toBe(true);
        await fsp.rm(`${testDataDir}/from/file1.txt`);
        expect(await fileEventuallyDeleted(`${testDataDir}/to/file1.txt`)).toBe(true);
    });

    it("change file with different name", async () => {
        await Promise.all([
            fsp.mkdir(`${testDataDir}/from`),
            fsp.mkdir(`${testDataDir}/to`)]);
        await Promise.all([
            fsp.writeFile(`${testDataDir}/from/file1`, 'boo'),
            fsp.writeFile(`${testDataDir}/to/file2`, 'boo')]);

        await fsp.writeFile(`${testDataDir}/bisync.json`, JSON.stringify(
            [
                [`from/file1`, `to/file2`]
            ]
        ));
        await sync.setConfig(`${testDataDir}/bisync.json`);
        await new Promise(r => setTimeout(() => r(true), 200)); // Allow init to finish
        expect(!!(await fsp.stat(`${testDataDir}/from/file1`))).toBe(true);
        expect(!!(await fsp.stat(`${testDataDir}/to/file2`))).toBe(true);        

        await fsp.writeFile(`${testDataDir}/from/file1`, 'hoo');
        expect(await fileEventuallyContains(`${testDataDir}/to/file2`, 'hoo')).toBe(true);

        await new Promise(f => setTimeout(() => f(true), 100));

        await fsp.writeFile(`${testDataDir}/to/file2`, 'hoooo');
        expect(await fileEventuallyContains(`${testDataDir}/from/file1`, 'hoooo')).toBe(true);
    });

    it("naming error (file path==existing dir path)", async () => {
        await Promise.all([
            fsp.mkdir(`${testDataDir}/from`),
            fsp.mkdir(`${testDataDir}/to`),
            fsp.mkdir(`${testDataDir}/to/file1`), // directory with same name
        ]);
        await fsp.writeFile(`${testDataDir}/bisync.json`, JSON.stringify(
            [
                [`from/file1`, `to/file1`]
            ]
        ));
        await sync.setConfig(`${testDataDir}/bisync.json`);
        await new Promise(r => setTimeout(() => r(true), 200)); // Allow init to finish

        // TODO: Replace file expectations with log expectations
        await fsp.writeFile(`${testDataDir}/from/file1`, 'boo');
        expect(await fileEventuallyExists(`${testDataDir}/to/file1`)).toBe(true);

        await new Promise(f => setTimeout(() => f(true), 100));

        await fsp.writeFile(`${testDataDir}/from/file1`, 'hoo');
        expect(await fileEventuallyContains(`${testDataDir}/to/file1`, 'hoo')).toBe(true);
    });
});

