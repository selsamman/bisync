import {config, getConfig, saveConfig} from "./config";
import {DirSync} from "./DirSync";
import {log} from "./util";
import {Server} from "socket.io";

export async function synchronize() {

    await getConfig();
    const sync = new DirSync(); // Create synchronization engine
    sync.setLogger(log);

    const io = new Server(3111);
    log('socket.io waiting for connection');
    io.on("connection", socket => {

        log('socket.io connected');

        socket.on('ping', () => io.emit('ok', 'Daemon running'));

        socket.on('watch', async file => {
            log(`Request to watch ${file}`);
            try {
                const warnings : Array<string> = [];
                await sync.setConfig(file, warnings);
                await saveConfig(sync);
                io.emit('ok', `${formatWarnings(warnings)}Watching ${file}`);
                log(`${formatWarnings(warnings)}Daemon responded OK: Watching ${file}`);

            } catch (e: any) {
                log(e);
                io.emit('error', e.message);
            }
        });
        socket.on('unwatch', async file => {
            log(`Request to forgot ${file}`);
            try {
                await sync.removeConfig(file);
                await saveConfig(sync);
                io.emit('ok', `No longer watching ${file}`)
                log(`Daemon responded OK: Daemon no longer watching ${file}`);
            } catch (e: any) {
                log(e);
                log(`Daemon responded Error: ${e.message}`);
                io.emit('error', e.message);
            }
        });
        socket.on('update', async () => {
            log(`Request to update`);
            try {
                const warnings : Array<string> = [];
                await getConfig();
                await sync.setConfigs(config.configFiles, warnings);
                await saveConfig(sync); // In case some were removed
                io.emit('ok', `${formatWarnings(warnings)}Daemon running`);
                log(`Daemon responded OK: Daemon running`);
            } catch (e : any) {
                io.emit('error', e.message);
            }
        });

        socket.on('quit', () => {
            log(`Request to quit`);
            io.emit('ok', 'Daemon stopped');
            process.exit(0);
        });
    });
}

function formatWarnings (warnings : Array<string>) {
    return warnings.length ? warnings.map(w => `Warning: ${w}\n`).join('') : '';
}