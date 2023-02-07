import {DirSync} from "../DirSync";
import * as fs from 'fs';
import {exec, execSync} from "child_process";
import {processArgs} from "../sync";
const fsp = fs.promises;


describe("File Sync Tests of DirSync.ts", () => {
    const testDataDir = 'testData1';
    let sync : DirSync = new DirSync();
    beforeEach(async () => {
        sync = new DirSync();
        await fsp.mkdir(testDataDir);
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
    it("change file", async () => {
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
describe ("Daemon can operate",  () => {
    let started = false;
    beforeAll(() => {
        const out = trim(execSync(`node build/sync.js stop`).toString());
        console.log(out);
        started =  out === 'Damon stopped';
    });
    afterAll( () => {
        if (started)
            console.log(execSync(`node build/sync.js start`).toString());
    });
    it ("can start and stop daemon", async () => {
        expect(trim(execSync(`node build/sync.js start`).toString())).toBe('Daemon started');
        await new Promise(r => setTimeout(() => r(true), 100));
        expect(trim(execSync(`node build/sync.js stop`).toString())).toBe('Daemon stopped');
    });

});
async function fileEventuallyExists ( file : string) {
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
async function fileEventuallyContains ( file : string, value : string) {
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
async function fileEventuallyDeleted ( file : string) {
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
function trim(str : string) {
    return str.replace(/\n/, '').replace(/\r/, '');
}
