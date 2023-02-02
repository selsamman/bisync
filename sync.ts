import {DirSync} from "./DirSync";
import { Server } from "socket.io";
import { io } from "socket.io-client";
import * as child from 'child_process';
import * as path from "path";
import * as fs from 'fs';
import date from 'date-and-time';
const fsp = fs.promises;
type Config = Array<Array<string>>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const args = require('args-parser')(process.argv);
console.log(args);


function log(str : string) {
    const d = new Date();
    const toLog = `${date.format(d, "YYYY-MM-DD HH:MM:ss.SSS")}: ${str} \n`;
    try {
        if (args.log !== 'none')
            fs.appendFileSync(args.log, Buffer.from(toLog, 'utf8'));
    } catch (e) {
        console.log(`error ${e} logging`);
    }
}
(async function () {
    try {
        await resolveArgs();
        await processArgs();
    } catch (e : any) {
        console.log(e);
        log(e);
    }
})();

async function resolveArgs () {
    if (!args.config)
        args.config = path.resolve('./bisync.json');
    if (!args.log)
        args.log = 'none';
    log(JSON.stringify(args));
    try {
        await fsp.stat(args.config)
    } catch (e) {
        throw new Error(`${args.config} not found`);
    }
}

async function processArgs () {
    // If being run as a damon
    if (args.daemon) {
        log(`Daemon Started with ${args.config}`)
        const sync = new DirSync();         // Create synchronization engine
        sync.setLogger(log);
        await sync.setConfig(args.config);
        const io = new Server(args.port || 3111);
        log('socket.io waiting for connection');
        io.on("connection", socket => {
            log('socket.io connected');
            socket.emit('ShotCommanderWebApp');
            socket.on('config', configFile =>
                sync.setConfig(configFile)
                .then(() => log(`configuring with ${args.config}`)));
            socket.on('quit', () => {
                sync.quit();
                log('quitting daemon');
                process.exit(0);
            });
        });
    } else if (args.stop) {
        const socket = io(`ws://localhost:${args.port || 3111}`)
        setTimeout(() => {
            console.log('daemon not running');
            process.exit(0);
        },2000);
        socket.on('ShotCommanderWebApp', () => {
            console.log('stopping daemon');
            socket.emit('quit');
            setTimeout(() => process.exit(0), 500);
        })
    } else {
        const configPath = path.dirname(args.config);
        const config = JSON.parse(Buffer.from(await fsp.readFile(args.config)).toString()) as Config;
        config.forEach((group, ix) => {
            console.log(`Group ${ix + 1}`);
            group.forEach( (file, jx) => console.log(`  - ${path.resolve(configPath,config[ix][jx])}`));
        })

        const socket = io(`ws://localhost:${args.port || 3111}`);
        setTimeout(() => spawnDaemon(), 1000);
        socket.on('ShotCommanderWebApp', () => {
            socket.emit('config', args.config || 'tsconfig.json');
            console.log(`daemon configured with ${args.config}`)
            process.exit(0);
        });
    }

    function spawnDaemon() {
        process.on('exit', () => {
            const spawnArgs = [__filename, "--daemon", `--config=${args.config}`, `--log=${args.log}`]
            const spawned: child.ChildProcess = child.spawn('node', spawnArgs,
            {
                detached: true,
                stdio: 'ignore'
            });
            spawned.unref();
            console.log(`daemon starting with ${args.config}`);
        });
        process.exit(0);
    }
}