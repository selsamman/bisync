// Attempt to send message to daemon and spawn the daemon if needed
// Returns response from daemon or false if an error was output
import {io} from "socket.io-client";
import path from "path";
import child from "child_process";

export async function sendOrStartDaemon(command: string, data: string) {
    try {
        return await callDaemon(command, data);
    } catch (e: any) {
        try {
            if (e.match(/Daemon not running/))
                spawnDaemon();
            return await callDaemon(command, data);
        } catch (e: any) {
            return e;
        }
    }

}

export async function isDaemonRunning () {
    try {
        await callDaemon('ping', '', 500);
        return true;
    } catch (e) {
        return false;
    }
}

async function callDaemon(command: string, data: string, timeout = 2000) {
    return await new Promise((resolve, reject) => {
        const socket = io(`ws://localhost:3111`)
        setTimeout(() => {
            reject('Daemon not running');
        }, timeout);
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

let mainFile = ""
export function setMainFile(name : string) {
    mainFile = name;
}
function spawnDaemon() {
    const parsed = path.parse(mainFile);
    const damonScript = parsed.ext === 'ts' ? `${parsed.dir}/build/${parsed.base}.js` : mainFile;
    const spawnArgs = [damonScript, "--daemon"]
    const spawned: child.ChildProcess = child.spawn('node', spawnArgs,
        {
            detached: true,
            stdio: 'ignore'
        });
    spawned.unref();
}