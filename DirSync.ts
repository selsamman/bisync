/*
Synchronization engine based on chokidar.  Manages a watcher for each config file set with setConfig
 */
import chokidar, {FSWatcher} from 'chokidar';
import * as path from "path";
import * as fs from 'fs';

const fsp = fs.promises;




export type Config = Array<Array<string>>;
type Configs = {[index: string] : {watcher: FSWatcher, config: Config}};
export type ConfigFiles = {[index : string] : boolean}
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
    configs : Configs = {};
    ignore: {[index : string] : number} ={};

    // Copy file to sync dir as long as not copying to oneself or there
    // was entry setup to ignore the copy because it is the result of an
    // event from a previous copy
    async syncFile (from : string, to : string, fromTime : number) {
        try {

            const infoTo = await fileInfo(to); // File may not exist

            // Ignore entry for same file
            if (from === to)
                return;

            // An expected change due to our own file copy
            const ignoreEntry = this.ignore[from]
            if (ignoreEntry) {
                delete this.ignore[from];
                if ((infoTo.time - ignoreEntry) < ignoreThreshold) {
                    //this.log(`syncFile on ${to} ignored`);
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
                //this.log(`${from} is the same as ${to}`);
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
            this.log(`Creating directory ${dir}`);
            await fsp.mkdir(dir, {recursive: true});
        }
    }
    // Unlink file in to directory and record to ignore unlink event for the destination
    async unlinkFile (from : string, to : string) {
        try {
            // Gather info

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
    async processFile(info : Info, type : "sync" | "unlink") {
        for(const config in this.configs) {
            // Locate group that contains an entry matching the file
            const ix = this.configs[config].config.findIndex(group => group.find(dir => info.dir.startsWith(dir)));
            const group = this.configs[config].config[ix];
            if (group) {
                const fromDir = group.find(dir => info.dir.startsWith(dir)) || "";
                // All directories in that group must be synchronized
                group.forEach(dir => {
                    const fromPath = path.join(info.dir, info.file);
                    const toPath = path.join(dir, info.dir.substring(fromDir.length), info.file);
                    type === "sync" ? this.syncFile(fromPath, toPath, info.time) : this.unlinkFile(fromPath, toPath)
                });
            }
        }
    }
    async addFile (info : Info, type : "add" | "change") {
        const config = path.join(info.dir, info.file);
        if (this.configs[config]) {
            if (type === "change")
                await this.setConfig(config);
        } else
            await this.processFile(info, "sync");
    }
    async removeFile (info : Info) {
        const config = path.join(info.dir, info.file);
        if (this.configs[config])
            await this.removeConfig(config);
        else
            await this.processFile(info, "unlink");
    }
    async removeConfig (configFile : string) {
        if (this.configs[configFile]) {
            await this.configs[configFile].watcher.close();
            delete this.configs[configFile];
            this.log(`${configFile} no longer being watched`);
        } else {
            this.log(`attempt to remove ${configFile} failed`);
            throw new Error(`${configFile} was not being watched`);
        }
    }
    async setConfigs(configs : ConfigFiles) {
        this.log(`Setting configuration files ${Object.keys(configs).join(",")}`);
        // Any new or updated ones get added
        for (let configsKey in configs) {
            try {
                const newConfig = await this.getConfigDetails(configsKey);
                // If non-existent or outdated update it
                if (!this.configs[configsKey] || JSON.stringify(this.configs[configsKey].config) !== JSON.stringify(newConfig))
                   await this.setConfig(configsKey);
            } catch (e : any) {
                this.log(`${e} on setConfigs`);
                delete configs[configsKey];
            }
        }

        // Any ones we are currently processing that are no longer needed get unwatched
        for (let configsKey in this.configs) {
            if (!configs[configsKey])
                await this.removeConfig(configsKey);
        }
    }
    async getConfigDetails(configFile : string) {

        let config : any;
        let configDir : string;

        try {
            configDir = path.dirname(configFile);
            config = JSON.parse(Buffer.from(await fsp.readFile(configFile)).toString());
        } catch (e) {
            this.log(`Cannot open ${configFile}`);
            throw new Error(`Cannot open ${configFile}`);
        }

        if (!(config instanceof  Array))
            throw new Error(`configFile must be an array of arrays of directories`);
        config.forEach(group => {
            if (!(group instanceof  Array))
                throw new Error(`configFile must be an array of arrays of directories`);
            group.forEach(dir => {
                if (typeof dir !== 'string' )
                    throw new Error(`configFile must be an array of arrays of directories`);
            })
        })
        config.forEach((group, ix) => group.forEach((file : string, jx: number) =>
            config[ix][jx] = resolvePath(configDir, config[ix][jx])));

        return config as Config;
    }
    async setConfig (configFile : string) {

        const config = await this.getConfigDetails(configFile);

        this.log(`adding config ${JSON.stringify(config)}`);

        // Unwatch any files if this is a replacement config
        if (this.configs[configFile])
            await this.configs[configFile].watcher.close();

        // Create a new watcher that watches all directories in config file
        const watcher = chokidar.watch([...config.flat(), configFile], {});
        this.log(JSON.stringify([...config.flat(), configFile]));
        //watcher.add(configFile);
        watcher
            .on('add', path => {
                this.log(`add ${path}`);
                fileInfo(path).then(info => this.addFile(info, "add")).catch(e => this.log(`${e} ${e.stack} on add/addFile`));
            })
            .on('change', path => {
                this.log(`change ${path}`);
                fileInfo(path).then(info => this.addFile(info, "change")).catch(e => this.log(`${e} ${e.stack} on change/addFile`));
            })
            .on('unlink', path => {
                this.log(`unlink ${path}`);
                fileInfo(path, true).then(info => this.removeFile(info)).catch(e => this.log(`${e} ${e.stack} on unlink/removeFile`));
            });
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
export function resolvePath(rootPath : string, relativePath : string) {
    if (path.isAbsolute(relativePath))
        return relativePath;
    return path.join(rootPath, relativePath);
}
