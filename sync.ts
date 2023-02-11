import {ConfigFiles, DirSync, resolvePath} from "./DirSync";
import { Server } from "socket.io";
import { io } from "socket.io-client";
import * as child from 'child_process';
import * as path from "path";
import * as fs from 'fs';
import date from 'date-and-time';
import * as os from "os";
const fsp = fs.promises;
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
        if (Object.keys(args).length > 1)
            args = {};
        if (args.status) {
            try {
                await callDaemon('update', "");
                console.log('Daemon running')
                if (Object.keys((await getConfig()).configFiles).length > 0)
                    console.log(`These configuration files are in effect:`);
            } catch (e) {
                console.log('Daemon not running - these configuration files will be in effect when it is started:');
                if (Object.keys((await getConfig()).configFiles).length > 0)
                    console.log(`These configuration files will be in effect when it is started:`);
            }
            Object.keys((await getConfig()).configFiles).forEach(key => console.log(` - ${key}`));
            console.log(`Current log file: ${(await getConfig()).logFile}`);
        } else if (args.log) {
            config = await getConfig();
            config.logFile = resolvePath(process.cwd(), args.log);
            await saveConfig();
        } else if (args.start) {
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
                await saveConfig();
                try {
                    await callDaemon('update', '');
                } catch (e) {
                    spawnDaemon();
                }
                console.log(`Watching ${args.watch}`);
            } catch (e) {
                console.log(e);
                config = await getConfig();
            }
        } else if (args.forget) {
            try {
                config = await getConfig();
                delete config.configFiles[args.forget];
                await saveConfig();
                try {
                    await callDaemon('update', '');
                } catch (e) {
                    spawnDaemon();
                }
                console.log(`Stopped watching ${args.forget}`);

            } catch (e) {
                console.log(e);
                config = await getConfig();
            }
        } else if (args.install) {
            await install();
        } else
            console.log(`usage:
        npx bisync watch=<config-file>        to add a configuration file to be watched and start daemon
        npx bisync forget=<config-file>       to stop watching directories in config file and start daemon 
        npx bisync stop                       to stop the daemon 
        npx bisync start                      to restart the daemon (with all previous watches)
        npx bisync log=<logfile-name>         log events to a file
        npx bisync status                     show status of daemon and which config files are in effect
        npx bisync install                    prepare your system to automatically start bisync on login 
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
        log(JSON.stringify(config.configFiles));
        await saveConfig(); // In case some were removed
    }

    const io = new Server(args.port || 3111);
    log('socket.io waiting for connection');
    io.on("connection", socket => {

        log('socket.io connected');

        socket.on('update', async () => {
            try {
                config = await getConfig();
                await sync.setConfigs(config.configFiles);
                await saveConfig(); // In case some were removed
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

async function install() {
    if (os.platform() === 'darwin') {
        const commandFile = `${require('os').homedir()}/start_bisync.command`;
        await fsp.writeFile(commandFile, 'npx bisync start');
        console.log(`To complete installation of damon:
1) In Preferences go to Users & Groups
2) Select your user name.
3) Add ${commandFile} to login items
You will see a terminal window open each time you login and start bisync
`);

    } else if (os.platform() === 'win32') {
        const commandFile = `${require('os').homedir()}/start_bisync.bat`;
        await fsp.writeFile(commandFile, 'npx bisync start');
        console.log(`${commandFile} created to start bisync on login`);
    } else {
        console.log(`Cannot automatically install a script to start bisync on this operating system
You will need to add a startup script to run "npx bisync start" on login
`);
    }
}
