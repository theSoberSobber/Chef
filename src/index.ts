#!/usr/bin/env node
import {readFile, parseToml, execScript, stringifyObj, writeFile, deleteDep} from "./lib/utils";
import {getLatestVersion, getImmedteDep, getNestedDep, getTarballLinkAndName} from "./lib/api";
import { JsonMap } from "@iarna/toml";
import * as fs from "fs";

const main = async () => {
  try {
    let obj: (Object | undefined) = undefined;
    if(fs.existsSync("./chef.toml")) obj = parseToml(await readFile("./chef.toml"));
    let v: boolean = false; 
    for(let i: number = 0; i<process.argv.length; i++){
      if(process.argv[i]=="--verbose" || process.argv[i]=="-v"){
        v=true;
        process.argv.splice(i, 1);
      }
      if(process.argv[i]=="--global" || process.argv[i]=="-g"){
        console.log(`🔪 Global Installs are currently not supported.`);
        return;
      }
    }
    // add
    if (process.argv[2] === "add") {
      if (process.argv.length == 3) {
        if(obj!=undefined){
          const dependency_list = obj["dependencies"] as object;
          const dev_dependency_list = obj["devDependncies"] as object;
          const all_dependencies = { ...dependency_list, ...dev_dependency_list };
          install(all_dependencies, v);
        } else console.log(`🔪 No Valid chef.toml found, Exiting...`);
      } else {
        let cmd_map: JsonMap = {};
        const dependecy_list = process.argv.slice(3);
        const latest_list = [];
        let objLock: (string | undefined | object) = undefined;
        if(fs.existsSync("./chef.lock.toml")) objLock = await parseToml(await readFile("./chef.lock.toml"));
        for (let i of dependecy_list){
          if(objLock!=undefined && objLock[i]!=undefined) console.log(`😋 Requirement ${i} already satisfied. Skipping...`);
          else latest_list.push(getLatestVersion(i));
        }
        const resolved_list = await Promise.all(latest_list);
        for (let item of resolved_list) cmd_map[item[0]] = item[1];
        await install(cmd_map, v);
        if(obj!=undefined){
          for (let dep in cmd_map) obj["dependencies"][dep] = cmd_map[dep];
          let toml_str = stringifyObj(obj);
          writeFile("./chef.toml", toml_str);
        }
      }
    }else if (process.argv[2] === "serve") {
      if (process.argv.length < 4) {
        console.error("Invalid serve arguments supplied.");
      } else {
        const script = obj["scripts"];
        if(script[process.argv[3]]) execScript(script[process.argv[3]]);
        else console.log(`🗡️ Error! No such script found`);
      }
    } else if (process.argv[2] === "remove") {
      if (process.argv.length < 4) console.error("invalid remove arg supplied");
      else {
        const obj = parseToml(await readFile("./chef.lock.toml"));
        deleteDep(obj, process.argv.slice(3));
      }
    } else console.error("🥝 Invalid operation");
  } catch (error: any) {
    console.log("🍈 An Error Occured, please open an issue with the ./log.txt file on the Chef Github Repo.");
    error+='\n';
    if(fs.existsSync("./log.txt")) fs.appendFileSync("./log.txt", error);
    else writeFile("./log.txt", error);
  }
};

const install = async (depenecyMap: JsonMap, v: boolean) => {
  let dependecy_graph: JsonMap = {};

  for (let cli_dep in depenecyMap) {
    if(v) console.log(`🍉 Resolving nested Dependencies for ${cli_dep}`);

    dependecy_graph[cli_dep] = {};
    dependecy_graph[cli_dep][cli_dep] = depenecyMap[cli_dep];

    const immediteDep = await getImmedteDep(cli_dep, depenecyMap[cli_dep] as string);
    for (let immed_dep in immediteDep) {
      if(v) console.log(` ➡️ immediate dependency: ${immed_dep}`);
      dependecy_graph[cli_dep][immed_dep] = immediteDep[immed_dep];
      const nestedDep = await getNestedDep(immed_dep, immediteDep[immed_dep] as string);
      for (let nested_dep in nestedDep) {
        if(v) console.log(`   ➡️ nested dependency: ${nested_dep}`);
        dependecy_graph[cli_dep][nested_dep] = nestedDep[nested_dep];
      }
    }
  }
  const download_list = [];

  for (let j in dependecy_graph) {
    let map_obj = dependecy_graph[j] as JsonMap;
    if(v) console.log(`🍅 Downloading & Extracting dependencies`);
    for (let i in map_obj) {
      // remove this await to have it extract parallely while downloading
      // will make it faster, but will screw up the UI
      download_list.push(await getTarballLinkAndName(i, map_obj[i] as string, v));
    }
  }
  await Promise.all(download_list);

  if (!fs.existsSync(`./chef.lock.toml`)) writeFile("./chef.lock.toml", stringifyObj(dependecy_graph));
  else {
    const obj = parseToml(await readFile("./chef.lock.toml"));
    let toml_str = stringifyObj({ ...dependecy_graph, ...obj });
    writeFile("./chef.lock.toml", toml_str);
  }
  let dependency_cnt: number = 0;
  for(let i in dependecy_graph) dependency_cnt+=(Object.keys(dependecy_graph[i]).length-1); 
  console.log(`🍒 Successfuly added ${Object.keys(depenecyMap).length} package(s) and ${dependency_cnt} dependency(s).`);
  if(!v) console.log("🍌 Specify --verbose or -v to get more detailed info on install.");
};

(async () => {await main();})()