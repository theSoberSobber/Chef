#!/usr/bin/env node
import * as fs from "fs";
import { AnyJson, JsonMap, parse, stringify } from "@iarna/toml";
import { parse as urlParser } from "url";
import { basename } from "path";
import * as decompress from "decompress";
import { copySync, removeSync } from "fs-extra";
import { spawn } from "child_process";
import { dir_name } from "./api";

export const readFile = (path: string): Promise<string> => {
  return new Promise((res, rej) => {
    fs.readFile(path, "utf8", (err, data) => {
      if (err) rej(err);
      res(data);
    });
  });
};

export const writeJson = async (path: string, obj:AnyJson): Promise<boolean> => {
  return new Promise(async (res, rej) => {
    let package_json_str = JSON.stringify(obj, null, 4);
    // figure out a method to write beautified json
    await writeFile("./package.json", package_json_str);
    res(true); 
  });
}

export const writeFile = (path: string, content: string) => {
  return new Promise((res, rej) => {
    fs.writeFile(path, content, (err) => {
      if (err) rej(err);
      res(true);
    });
  });
};

export const stringifyObj = (payload: JsonMap): string => {
  const str = stringify(payload);
  return str;
};

export const log = (message: string): void => {
  console.error(message);
  return;
};

export const parseToml = (payload: string): JsonMap => {
  const obj = parse(payload);
  return obj;
};

export const getFileName = (path: string): string => {
  var parsed = urlParser(path);
  return basename(parsed.pathname as string);
};

export const unZip = async (module_location: string, newWrite: string) => {
  decompress(module_location, newWrite)
    .then((_files) => {
      //delete the tarball
      removeSync(module_location);
      const item = newWrite.split("/")[newWrite.split("/").length-1];
      if(fs.existsSync(`${newWrite}/package`)) moveFolder(`${newWrite}/package`, newWrite);
      else if(fs.existsSync(`${newWrite}/${item}`)) moveFolder(`${newWrite}/${item}`, newWrite);
      else {
        let container: string[] = fs.readdirSync(`${newWrite}`);
        moveFolder(`${newWrite}/${container[0]}`, newWrite);
      }
    })
    .catch((err) => {
      if (err) console.log(err);
    });
};

const moveFolder = (src: string, des: string): void => {
  try {
    copySync(src, des);
    removeSync(src);
  } catch (e) {
    console.log("🍈 An Error Occured, please open an issue on the Chef Github Repo.");
    console.log(e);
    // MASSIVE TODO: rollback current transaction and mark as uninstalled on all errors occured during install
    // implement status exit codes in all functions for that
  }
};

export const execScript = (command: string): void => {
  console.log(`➡️ ${command}\n`);
  //parse the commad
  let cmd = command.split(" ");
  const child = spawn(cmd[0], cmd.slice(1));
  let ScriptOutput = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (data) => {
    console.log(data);
    data = data.toString();
    ScriptOutput += data;
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (data) => {
    console.log(`🔪 Child Process Error: `);
    console.log(data);
    console.log(`🔪 This is not an error with Chef rather than with the child process.\n`);
  });
  child.on("error", (error) => {
    console.log(`🔪 Error in spawning Child Process: `);
    console.log(error);
    console.log(`🔪 This is not an error with Chef rather than with the child process.\n`);
  });
  child.on("close", (code) => {
    if (code !== 0) {
      console.log(`🍴 Error!`);
      console.log(`🍎 Exited with status ${code}`);
    }
  });
};

export const deleteDep = async (payload: JsonMap, delete_item: string[]) => {
  for (let item of delete_item) {
    let dep = payload[item] as JsonMap;
    delete payload[item];
    if (dep) {
      let check = false;
      //check if a dependecy sub dependecy relies on this
      for (let sub_dep in payload) {
        if ((payload[sub_dep] as JsonMap)[item]) {
          check = true;
        }
      }
      if (check === false) {
        removeSync(`./${dir_name}/${item}`);
        console.log(`🗡️ Deleted ${item}`);
      }
      //update package.json
      if(fs.existsSync("./package.json")){
        const json_data = await readFile("./package.json");
        const obj = JSON.parse(json_data);
        if ((obj["dependencies"] as JsonMap)[item]) {
          delete (obj["dependencies"] as JsonMap)[item];
        } else {
          delete (obj["devDependencies"] as JsonMap)[item];
        }
        await writeJson("./package.json", obj);
      }
      //update the lock file
      let toml_str = stringifyObj(payload);
      writeFile("./chef.lock.toml", toml_str);
    } else console.error(`🗡️ Package ${item} not found.`);
  }
  // console.log(payload, delete_item);
};

const colors = {
  "dim": "\x1b[2m",
  "underscore": "\x1b[4m",
  "red": "\x1b[91m",
  "green": "\x1b[92m",
  "yellow": "\x1b[93m",
  "bg-red": "\x1b[41m",
  "bg-green": "\x1b[42m",
  "bg-yellow": "\x1b[43m",
  "reset": "\x1b[0m"
};

const map = ["red", "yellow", "green"];
const bgMap = ["bg-red", "bg-yellow", "bg-green"];

export const searchDataDisplay = async (data: any) => {
  console.log(`🔪 <pName>: <popularity>, <confidence>\n`);
  const len = Object.keys(data).length;
  for(let i of data) if(i.score.detail.popularity*100>30 || len<=3){
    const pConf = Math.floor(3*i.score.detail.popularity);
    const fConf = Math.floor(3*i.score.final);
    const conf = Math.floor((3*i.score.detail.popularity+3*i.score.final)/2);
    console.log(`🍅 ${colors[map[conf]]}${i.package.name}${colors.reset} : ${colors[map[pConf]]}${Math.floor(i.score.detail.popularity*100)}%${colors.reset}, ${colors[map[fConf]]}${Math.floor(i.score.final*100)}%${colors.reset}
  ➡️ ${i.package.description}
  ➡️ ${colors.dim}${i.package.links.npm}${colors.reset}`);
  }
  console.log(``);
}