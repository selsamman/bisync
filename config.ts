//console.log(args);
import {ConfigFiles, DirSync} from "./DirSync";
import {fsp} from "./util";

export interface Configuration {
    logFile: string | undefined,
    configFiles: ConfigFiles;
}

const configFile = `${require('os').homedir()}/.bisync`;
export let config: Configuration = {
    logFile: undefined,
    configFiles: {}
}

export async function getConfig() {
    try {
        const configJSON = (await fsp.readFile(configFile)).toString();
        config = JSON.parse(configJSON) as Configuration;
    } catch (e) {
        config = {
            logFile: undefined,
            configFiles: {}
        }
    }
}

export async function saveConfig(sync?: DirSync) {
    if (sync) {
        config.configFiles = {}
        Object.keys(sync.configs).forEach(file => config.configFiles[file] = true);
    }
    await fsp.writeFile(configFile, JSON.stringify(config));
}