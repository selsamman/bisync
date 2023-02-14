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
                await sync.setConfig(file);
                await saveConfig(sync);
                io.emit('ok', `Watching ${file}`);
                log(`Daemon responded OK: Watching ${file}`);

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
            }
        });
        socket.on('update', async () => {
            log(`Request to update`);
            try {
                await getConfig();
                await sync.setConfigs(config.configFiles);
                await saveConfig(sync); // In case some were removed
                io.emit('ok', 'Daemon running');
                log(`Daemon responded OK: Daemon running`);
            } catch (e) {
                io.emit('error', e);
            }
        });

        socket.on('quit', () => {
            log(`Request to quit`);
            io.emit('ok', 'Daemon stopped');
            process.exit(0);
        });
    });
}