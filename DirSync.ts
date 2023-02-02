/*
Synchronization engine based on chokidar.  Manages a watcher for each config file set with setConfig
 */
import chokidar, {FSWatcher} from 'chokidar';
import * as path from "path";
import * as fs from 'fs';
const fsp = fs.promises;
type Config = Array<Array<string>>;
interface Info {
    dir : string,
    file : string,
    size: number,
    mtime: number, // file modified time
    time: number // current time
}
const ignoreThreshold = 60 * 1000;
export class DirSync {
    log: (_message: string) => void = msg => console.log(msg);

    setLogger(log : (message: string) => void) {
        this.log = log;
    }
    configs : {[index: string] : {watcher: FSWatcher, config: Config}} = {};
    ignore: {[index : string] : number} ={};

    // Copy file to sync dir as long as not copying to oneself or there
    // was entry setup to ignore the copy because it is the result of an
    // event from a previous copy
    async syncFile (file : string, fromDir : string, fromTime: number, toDir : string) {
        try {

            // Assemble info for source and destination files
            let from = path.join(fromDir, file);
            let to = path.join(toDir, file);
            const infoTo = await fileInfo(to); // File may not exist

            // Ignore entry for same file
            if (from === to)
                return;

            // An expected change due to our own file copy
            const ignoreEntry = this.ignore[from]
            if (ignoreEntry) {
                delete this.ignore[from];
                if ((infoTo.time - ignoreEntry) < ignoreThreshold) {
                    this.log(`syncFile on ${to} ignored`);
                    return;
                } else
                    this.log(`out of date ignore entry on ${to} ignored`);
            }

            // Destination later than source because of initial sync
            if (infoTo.size && infoTo.mtime > fromTime) {
                const t = from;
                from = to;
                to = t;
            }

            // Remember to ignore the destination file
            this.ignore[to] = infoTo.time;

            const fromData = await fsp.readFile(from)

            // If same data ignore
            if (infoTo.mtime && Buffer.compare(fromData, await fsp.readFile(to)) === 0) {
                this.log(`${from} is the same as ${to}`);
                return;
            }

            // Copy the file
            await this.createDirectoriesIfNeeded(path.dirname(to));
            await fsp.writeFile(to, fromData);
            this.log(`${from} copied to ${to}`);

        } catch (e) {this.log(`${e} on syncFile`)}
    }

    // Go recursively through path creating directories as needed
    async createDirectoriesIfNeeded(dir : string) {
        try {
            await fsp.stat(dir);
            return;  // Directory exists we are done
        } catch (e) {
            this.log(`Creating director ${dir}`);
            await fsp.mkdir(dir, {recursive: true});
        }
    }
    // Unlink file in to directory and record to ignore unlink event for the destination
    async unlinkFile (file : string, fromDir : string, toDir : string) {
        try {
            // Gather info
            const from = path.join(fromDir, file);
            const to = path.join(toDir, file);
            const time = (new Date()).getTime();

            // Ignore entry for same file
            if (from === to)
                return;

            // If this was an expected unlink from our own doing ignore
            if (this.ignore[to] && this.ignore[to] > (time - ignoreThreshold)) {
                delete this.ignore[to];
                return;
            }

            // Remember to ignore our own delete
            this.ignore[to] = time;

            // delete the file
            await fsp.unlink(to);
            this.log(`${to} unlinked`);

        } catch (e) {this.log(`${e} on unlinkFile`)}
    }
    async addFile (info : Info) {
        for(const config in this.configs) {
            const ix = this.configs[config].config.findIndex(group => group.find(dir => info.dir.startsWith(dir)));
            this.configs[config].config[ix].forEach(dir => this.syncFile(info.file, info.dir, info.time, dir));
        }
    }
    async removeFile (info : Info) {
        for(const config in this.configs) {
            const ix = this.configs[config].config.findIndex(group => group.find(dir => info.dir.startsWith(dir)));
            this.configs[config].config[ix].forEach(dir => this.unlinkFile(info.file, info.dir, dir));
        }
    }
    async setConfig (configFile : string) {

        // Read config file and normalize paths
        const configPath = path.dirname(configFile);
        const config = JSON.parse(Buffer.from(await fsp.readFile(configFile)).toString()) as Config;
        config.forEach((group, ix) => group.forEach( (file, jx) =>
            config[ix][jx] = path.resolve(configPath,config[ix][jx])))
        this.log(`adding config ${JSON.stringify(config)}`);

        // Unwatch any files if this is a replacement config
        if (this.configs[configFile])
            await this.configs[configFile].watcher.close();

        // Create a new watcher that watches all directories in config file
        const watcher = chokidar.watch(config.flat(), {})
        watcher
            .on('add', path => {
                this.log(`add ${path}`);
                fileInfo(path).then(info => this.addFile(info)).catch(e => this.log(e));
            })
            .on('change', path => {
                this.log(`change ${path}`);
                fileInfo(path).then(info => this.addFile(info)).catch(e => this.log(e));
            })
            .on('unlink', path => {
                this.log(`unlink ${path}`);
                fileInfo(path, true).then(info => this.removeFile(info)).catch(e => this.log(e));
            });
        setTimeout(() => this.log('fuck'), 2000);
        // Save it
        this.configs[configFile] = {watcher, config};
    }
    quit () {
        for (const configFile in this.configs)
            this.configs[configFile].watcher.close().then(() => this.log('quitting'));
    }
    async  getConfig () {
        return
    }
}
async function fileInfo (p : string, deleted = false) : Promise<Info> {
    try {
        const info = deleted ? {size: 0, mtime: new Date()} : await fsp.stat(p);
        return {
            dir: path.dirname(p),
            file: path.basename(p),
            size: info.size,
            mtime: info.size ? info.mtime.getTime() : 0,
            time: (new Date()).getTime()
        }
    } catch (e) {
        return {
            dir : '',
            file : '',
            size : 0,
            time: (new Date()).getTime(),
            mtime : 0,
        }
    }
}
