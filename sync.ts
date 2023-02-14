import {resolvePath} from "./DirSync";
import * as os from "os";
import {fsp, log} from "./util";
import {config, getConfig, saveConfig} from "./config";
import {synchronize} from "./daemon";
import {isDaemonRunning, sendOrStartDaemon, setMainFile} from "./daemonInterface";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const args = require('args-parser')(process.argv);
setMainFile(__filename);

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

        // Otherwise process args and exit

        // Only one argument at a time
        if (Object.keys(args).length > 1)
            args = {};

        // Output config files and current logging destination as well as daemon status
        if (args.status) {
            const running = await isDaemonRunning();
            await getConfig();
            console.log(running ? 'Daemon running' : 'Daemon not running');
            if (Object.keys(config.configFiles).length > 0) {
                if (running)
                    console.log(`These configuration files are in effect:`);
                else
                    console.log(`These configuration files will be in effect when it is started:`);
            }
            Object.keys(config.configFiles).forEach(key => console.log(` - ${key}`));
            console.log(`Current log file: ${config.logFile}`);

        // Start daemon if needed after updating log in config file and inform daemon if running
        } else if (args.log) {
            await getConfig();
            config.logFile = resolvePath(process.cwd(), args.log);
            await saveConfig();
            await sendOrStartDaemon('update', '');

        // If daemon not running start it and force it to take configuration
        } else if (args.start) {
            if (await isDaemonRunning())
                console.log('Daemon already running');
            else
                console.log(await sendOrStartDaemon('update', ''));

        } else if (args.stop) {
            if (await isDaemonRunning())
                console.log(await sendOrStartDaemon('quit', ''));
            else
                console.log('Daemon was not running');

        // Start daemon if needed and have it watch a new config
        } else if (args.watch) {
            console.log(await sendOrStartDaemon('watch', resolvePath(process.cwd(), args.watch)));

        // Start daemon if needed and have it watch a new config
        } else if (args.unwatch) {
            console.log(await sendOrStartDaemon('unwatch', resolvePath(process.cwd(), args.unwatch)));

        } else if (args.install) {
            await install();

        } else
            usage();

        process.exit(0);
    }

}

function usage () {
    console.log(`usage:
        npx bisync watch=<config-file>        to add a configuration file to be watched and start daemon
        npx bisync unwatch=<config-file>       to stop watching directories in config file and start daemon 
        npx bisync stop                       to stop the daemon 
        npx bisync start                      to restart the daemon (with all previous watches)
        npx bisync log=<logfile-name>         log events to a file
        npx bisync status                     show status of daemon and which config files are in effect
        npx bisync install                    prepare your system to automatically start bisync on login 
`);
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
