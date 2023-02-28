import fs from "fs";
import date from "date-and-time";
import {config} from "./config";
import {ConfigFiles} from "./DirSync";

export const fsp = fs.promises;


export function log(str: string) {
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

export function verifyConfigFile(config : ConfigFiles) {

}

