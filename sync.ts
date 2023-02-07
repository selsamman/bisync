import {ConfigFiles, DirSync, resolvePath} from "./DirSync";
import { Server } from "socket.io";
import { io } from "socket.io-client";
import * as child from 'child_process';
import * as path from "path";
import * as fs from 'fs';
import {homedir} from "os";
import date from 'date-and-time';
const fsp = fs.promises;
type Config = Array<Array<string>>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const args = require('args-parser')(process.argv);
//console.log(args);

const configFile = `${require('os').homedir()}/.bisync`;

interface Configuration {
    logFile : string | undefined,
    configFiles : ConfigFiles;
}

let config : Configuration = {
    logFile: undefined,
    configFiles: {}
}

function log(str : string) {
    const d = new Date();
    const toLog = `${date.format(d, "YYYY-MM-DD HH:MM:ss.SSS")}: ${str} \n`;
    try {
        if (config.logFile)
            fs.appendFileSync(config.logFile, Buffer.from(toLog, 'utf8'));
        else
            console.log(toLog);
        return true;
    } catch (e) {
        return false;
    }
}

(async function () {
    try {
        await processArgs(args);
    } catch (e : any) {
        console.log(e);
        log(e);
    }
})();


export async function processArgs (args : any) {
    // If being run as a damon
    if (args.daemon) {
        await synchronize();
        log(`Daemon Started`);
    } else {
        if (args.log) {
            config = await getConfig();
            config.logFile = resolvePath(process.cwd(), args.log);
            await saveConfig();
        }
        if (args.start) {
            try {
                await callDaemon('update', '');
                console.log('Daemon already running');
            } catch (e) {
                spawnDaemon();
                console.log('Daemon started');
            }
        } else if (args.stop) {
            try {
                await callDaemon('quit', "");
                console.log('Daemon stopped');
            } catch (e) {
                console.log(e);
            }
        } else if (args.watch) {
            try {
                config = await getConfig();
                config.configFiles[resolvePath(process.cwd(), args.watch)] = true;
                try {
                    await callDaemon('update', '');
                } catch (e) {
                    spawnDaemon();
                }
                console.log(`Watching ${args.watch}`);
                await saveConfig();
            } catch (e) {
                console.log(e);
                config = await getConfig();
            }
        } else if (args.forget) {
            try {
                config = await getConfig();
                delete config.configFiles[args.watch];
                try {
                    await callDaemon('update', '');
                } catch (e) {
                    spawnDaemon();
                }
                console.log(`Stopped watching ${args.watch}`);
                await saveConfig();
            } catch (e) {
                console.log(e);
                config = await getConfig();
            }
        } else
            console.log(`usage:
        npx bisync watch=<config-file>        to add a configuration file to be watched
        npx bisync forget=<config-file>       to stop watching directories in config file 
        npx bisync stop                       to stop the daemon 
        npx bisync start                      to restart the daemon (with all previous watches) 
`);
        process.exit(0);
    }

}

async function synchronize () {

    config = await getConfig();
    const sync = new DirSync(); // Create synchronization engine
    sync.setLogger(log);
    if (config) {
        sync.setLogger(log);
        await sync.setConfigs(config.configFiles);
    }

    const io = new Server(args.port || 3111);
    log('socket.io waiting for connection');
    io.on("connection", socket => {

        log('socket.io connected');

        socket.on('update', async configFile => {
            try {
                config = await getConfig();
                await sync.setConfigs(config.configFiles);
                io.emit('ok');
            } catch (e) {
                io.emit('error', e);
            }
        });

        socket.on('quit', () => {
            io.emit('ok');
            process.exit(0);
        });
    });
}

async function getConfig() : Promise<Configuration> {
    try {
        const configJSON = (await fsp.readFile(configFile)).toString();
        return JSON.parse(configJSON) as Configuration;
    } catch (e) {
        return {
            logFile : undefined,
            configFiles: {}
        }
    }
}
async function saveConfig() {
    await fsp.writeFile(configFile, JSON.stringify(config));
}

async function callDaemon (command : string, data : string) {
    return await new Promise((resolve, reject) => {
        const socket = io(`ws://localhost:${args.port || 3111}`)
        setTimeout(() => {
            reject('Daemon not running');
        },2000);
        socket.on("connect", () => {
            socket.emit(command, data);
        });
        socket.on('ok', (response) => {
            resolve(response);
        });
        socket.on('error', error => {
            reject(error);
        });
    })
}


function spawnDaemon() {
    process.on('exit', () => {
        const parsed = path.parse(__filename);
        const damonScript = parsed.ext === 'ts' ? `${parsed.dir}/build/${parsed.base}.js` : __filename;
        const spawnArgs = [damonScript, "--daemon"]
        const spawned: child.ChildProcess = child.spawn('node', spawnArgs,
        {
            detached: true,
            stdio: 'ignore'
        });
        spawned.unref();
    });
}
