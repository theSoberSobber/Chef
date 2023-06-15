#!/usr/bin/env node
import {readFile, parseToml, execScript, stringifyObj, writeFile, deleteDep, log, searchDataDisplay, writeJson} from "./lib/utils";
import {getLatestVersion, getImmedteDep, getNestedDep, getTarballLinkAndName, helpMsg} from "./lib/api";
import { JsonMap } from "@iarna/toml";
import * as fs from "fs";
import axios from "axios";

const base_url = "https://registry.npmjs.org";

const main = async () => {
  try {
    let obj, objJson: (JsonMap | undefined) = undefined;
    if(fs.existsSync("./package.json")) objJson = JSON.parse(await readFile("./package.json"));
    let v: boolean = false, dev:boolean = true;
    for(let i: number = 0; i<process.argv.length; i++){
      if(process.argv[i]=="--verbose" || process.argv[i]=="-v"){
        v=true;
        process.argv.splice(i, 1);
      }
      if(process.argv[i]=="--no-dev" || process.argv[i]=="-n"){
        dev=false;
        process.argv.splice(i, 1);
      }
      if(process.argv[i]=="--global" || process.argv[i]=="-g") return log(`🔪 Global Installs are currently not supported.`);
    }
    if(process.argv.length===2) console.log(helpMsg);
    else if(process.argv[2] === "help") console.log(helpMsg);
    else if (process.argv[2] === "add") {
      let objLock: (string | undefined | JsonMap) = undefined;
      if(fs.existsSync("./chef.lock.toml")) objLock = await parseToml(await readFile("./chef.lock.toml"));
      if (process.argv.length == 3) {
        if(objJson!=undefined){
          const dependency_list = objJson["dependencies"] as object;
          const dev_dependency_list = objJson["devDependencies"] as object;
          // add lock file check 
          let all_dependencies : JsonMap = {};
          for(let i in dependency_list){
            i = i.toLowerCase();
            if(objLock!=undefined && objLock[i]!=undefined) console.log(`😋 Requirement ${i} already satisfied. Skipping...`);
            else all_dependencies[i]=(dependency_list as JsonMap)[i];
          }
          if(dev) for(let i in dev_dependency_list){
            i = i.toLowerCase();
            if(objLock!=undefined && objLock[i]!=undefined) console.log(`😋 Requirement ${i} already satisfied. Skipping...`);
            else all_dependencies[i]=(dev_dependency_list as JsonMap)[i];
          }
          await install(all_dependencies, v);
        } else return log(`🔪 No Valid package.json found, Exiting...`);
      } else {
        let cmd_map: JsonMap = {}, cmd_toml_map: JsonMap = {};
        const dependecy_list = process.argv.slice(3);
        const latest_list = [], tomlList = [];
        for (let i of dependecy_list){
          i=i.toLowerCase();
          if(objLock!=undefined && objLock[i]!=undefined) console.log(`😋 Requirement ${i} already satisfied. Skipping...`);
          else latest_list.push(getLatestVersion(i));
          tomlList.push(getLatestVersion(i));
        }
        const resolved_list = await Promise.all(latest_list);
        const resolved_toml_list = await Promise.all(tomlList);
        for (let item of resolved_list) cmd_map[item[0]] = item[1];
        for (let item of resolved_toml_list) cmd_toml_map[item[0]] = item[1];
        await install(cmd_map, v);
        if(objJson!=undefined){
          for (let dep in cmd_toml_map) (objJson["dependencies"] as JsonMap)[dep] = cmd_toml_map[dep];
          await writeJson("./package.json", objJson);
        }
      }
    }else if (process.argv[2] === "serve") {
      if (process.argv.length < 4) {
        console.error("🔪 Invalid Serve Arguments passed.");
      } else {
        if(objJson===undefined) return log(`🔪 No Valid package.json found, Exiting...`);
        const script = objJson["scripts"] as JsonMap;
        if(script[process.argv[3]]){
          for(let i of (script[process.argv[3]] as string).split("&&")){
            console.log(`\n➡️ ${process.argv[3]}`);
            execScript(i);
          }
        } else console.log(`🗡️ Error! No such script found`);
      }
    } else if (process.argv[2] === "remove") {
      if (process.argv.length < 4) console.error("invalid remove arg supplied");
      else {
        const obj = parseToml(await readFile("./chef.lock.toml"));
        deleteDep(obj, process.argv.slice(3));
      }
    } else if(process.argv[2] === "search" || process.argv[2] === "s"){
      const searchKeys = process.argv.slice(3);
      for(let i of searchKeys){
        let { data } = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${i}`);
        data = data.objects;
        console.log(`🍅 ${i}`);
        for(let pkg of data) if(pkg.package.name.includes(i)) console.log(` ➡️ ${pkg.package.name}`);
      }
    } else if(process.argv[2] === "recommend" || process.argv[2] === "r"){
      const searchKey = process.argv.slice(3).toString().replace(",", "%20");
      let { data } = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${searchKey}`);
      data=data.objects;
      await searchDataDisplay(data);
    } else if (process.argv[2] === "init") {
      if(fs.existsSync("./package.json")) console.log("🔪 Chef is already working on this project!");
      else {
        await writeFile("./package.json", `{\n\t"scripts": {},\n\t"dependencies": {},\n\t"devDependencies": {}\n}`);
        console.log(`🔪 Directory Initialized to work with Chef 😋`);
      }
    } else if(process.argv[2] === "taste"){
      console.log("🥝 Command not ready yet! Sorry, here's a cookie for the inconvineance caused 🍪🥹");
      
    } else if(process.argv[2] != undefined) console.error("🥝 Invalid operation");
  } catch (error: any) {
    console.log(error);
    if(error?.response?.status=="404") return log(`🔪 Package name not found on ${base_url}. (${error.response.status})`);
    else {
      error+='\n';
      if(fs.existsSync("./log.txt")) fs.appendFileSync("./log.txt", error);
      else writeFile("./log.txt", error);
      return log("🍈 An Error Occured, please open an issue with the ./log.txt file on the Chef Github Repo.");
    }
  }
};

const install = async (depenecyMap: JsonMap, v: boolean) => {
  let objLock: (string | undefined | JsonMap) = undefined;
  if(fs.existsSync("./chef.lock.toml")) objLock = await parseToml(await readFile("./chef.lock.toml"));
  
  let dependecy_graph: JsonMap = {};

  for (let cli_dep in depenecyMap) {
    if(objLock!=undefined && objLock[cli_dep]!=undefined) continue;
    if(v) console.log(`🍉 Resolving nested Dependencies for ${cli_dep}`);

    dependecy_graph[cli_dep] = {};
    (dependecy_graph[cli_dep] as JsonMap)[cli_dep] = depenecyMap[cli_dep];

    const immediteDep: JsonMap = await getImmedteDep(cli_dep, depenecyMap[cli_dep] as string);
    for (let immed_dep in immediteDep) {
      if(objLock!=undefined && objLock[immed_dep]!=undefined) continue;
      if(v) console.log(` ➡️ immediate dependency: ${immed_dep}`);
      (dependecy_graph[cli_dep] as JsonMap)[immed_dep] = immediteDep[immed_dep];
      const nestedDep: JsonMap = await getNestedDep(immed_dep, immediteDep[immed_dep] as string);
      for (let nested_dep in nestedDep) {
        if(v) console.log(`   ➡️ nested dependency: ${nested_dep}`);
        (dependecy_graph[cli_dep] as JsonMap)[nested_dep] = nestedDep[nested_dep];
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
    await writeFile("./chef.lock.toml", toml_str);
  }
  let dependency_cnt: number = 0;
  for(let i in dependecy_graph) dependency_cnt+=(Object.keys(dependecy_graph[i]).length-1); 
  console.log(`🍒 Successfuly added ${Object.keys(depenecyMap).length} package(s) and ${dependency_cnt} dependency(s).`);
  if(!v) console.log("🍌 Specify --verbose or -v to get more detailed info on install.");
};

(async () => {await main();})()
