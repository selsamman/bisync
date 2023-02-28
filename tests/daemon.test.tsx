import * as fs from 'fs';
import {execSync} from "child_process";
const fsp = fs.promises;
const configFile = `${require('os').homedir()}/.bisync`;
import {fileEventuallyContains, fileEventuallyDeleted, fileExists, fileEventuallyExists, trim} from "./test_helpers";

describe ("Daemon can operate",  () => {
    let started = false;
    const testDataDir = 'testData_daemon';
    let config = "";
    beforeAll(async () => {
        config = (await fsp.readFile(configFile)).toString();
        const out = trim(execSync(`node build/sync.js stop`).toString());
        console.log(out);
        started = out === 'Daemon stopped';
        try{await fsp.rm(`test.log`);}catch(_e){}
        await fsp.writeFile(configFile, JSON.stringify({
            logFile: undefined,
            configFiles: {}
        }));
    });
    afterAll( async () => {
        console.log(execSync(`node build/sync.js stop`).toString());
        await fsp.writeFile(configFile, config);
        if (started)
            console.log(execSync(`node build/sync.js start`).toString());
    });
    beforeEach(async () => {
        try{await fsp.mkdir(testDataDir);}catch(_e){}
    });
    afterEach(async() => {
        execSync(`node build/sync.js stop`);
        try{await fsp.rm(testDataDir, {recursive: true})}catch(_e){}
    });
    it ("can start and stop daemon", async () => {
        
        expect(trim(execSync(`node build/sync.js start`).toString())).toBe('Daemon running');
        // TODO: There seemes to be a race condition where the next line could come back as "Daemon not running"
        // Maybe this is because other tests jest runs in parallel all affect the same daemon on port 3111?
        expect(trim(execSync(`node build/sync.js stop`).toString())).toBe('Daemon stopped');
    });
    it("create config file while daemon running", async () => {
        await fsp.mkdir(`${testDataDir}/from`);
        await fsp.mkdir(`${testDataDir}/to`);
        await fsp.writeFile(`${testDataDir}/from/file1.txt`, 'foo');
        await fsp.writeFile(`${testDataDir}/bisync.json`, "[]");
        execSync(`node build/sync.js log=test.log`);
        expect(trim(execSync(`node build/sync.js watch=${testDataDir}/bisync.json`).toString()))
            .toBe(trim(`Watching ${process.cwd()}/${testDataDir}/bisync.json`));
        expect(await fileExists(`${testDataDir}/from/file1.txt`)).toBe(true);
        expect(await fileExists(`${testDataDir}/to/file1.txt`)).toBe(false);
        await writeConfig();
        execSync(`node build/sync.js status`)
        expect(await fileEventuallyExists(`${testDataDir}/to/file1.txt`)).toBe(true);
        execSync('node build/sync.js stop');
    });
    async function writeConfig() {
        await fsp.writeFile(`${testDataDir}/bisync.json`, JSON.stringify(
            [
                [`from`, `to`]
            ]
        ));
    }
});