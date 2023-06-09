import {readFile, parseToml, execScript, stringifyObj, writeFile, deleteDep} from "./lib/utils";
import {getLatestVersion, getImmedteDep, getNestedDep, getTarballLinkAndName} from "./lib/api";
import { JsonMap } from "@iarna/toml";
import * as fs from "fs";

const main = async () => {
  try {
    const obj = parseToml(await readFile("./chef.toml"));
    if (process.argv[2] === "add") {
      if (process.argv.length == 3) {
        const dependency_list = obj["dependencies"] as object;
        const dev_dependency_list = obj["devDependncies"] as object;
        const all_dependencies = { ...dependency_list, ...dev_dependency_list };
        install(all_dependencies);
      } else {
        let cmd_map: JsonMap = {};
        const dependecy_list = process.argv.slice(3);
        const latest_list = [];
        for (let i of dependecy_list) latest_list.push(getLatestVersion(i));
        const resolved_list = await Promise.all(latest_list);
        for (let item of resolved_list) cmd_map[item[0]] = item[1];
        await install(cmd_map);
        for (let dep in cmd_map) obj["dependencies"][dep] = cmd_map[dep];
        let toml_str = stringifyObj(obj);
        writeFile("./chef.toml", toml_str);
      }
    } else if (process.argv[2] === "serve") {
      if (process.argv.length < 4) {
        console.error("invalid exec arg supplied");
      } else {
        //get scripts
        const script = obj["scripts"];
        if(script[process.argv[3]]) execScript(script[process.argv[3]]);
        else console.log(`🗡️ Error! No such script found`)
      }
    } else if (process.argv[2] === "remove") {
      if (process.argv.length < 4) {
        console.error("invalid delete arg supplied");
      } else {
        //get scripts
        const toml_lock_data = await readFile("./chef.lock.toml");
        const obj = parseToml(toml_lock_data);
        deleteDep(obj, process.argv.slice(3));
      }
    } else {
      console.error("invalid operation");
    }
  } catch (error) {
    console.log(error);
  }
};

const install = async (depenecyMap: JsonMap) => {
  let dependecy_graph: JsonMap = {};

  for (let cli_dep in depenecyMap) {
    console.log(`🍉 Resolving nested Dependencies for ${cli_dep}`);

    dependecy_graph[cli_dep] = {};
    dependecy_graph[cli_dep][cli_dep] = depenecyMap[cli_dep];

    const immediteDep = await getImmedteDep(
      cli_dep,
      depenecyMap[cli_dep] as string
    );
    for (let immed_dep in immediteDep) {
      console.log(` ➡️ immediate dependency: ${immed_dep}`);
      dependecy_graph[cli_dep][immed_dep] = immediteDep[immed_dep];
      const nestedDep = await getNestedDep(immed_dep, immediteDep[immed_dep] as string);
      for (let nested_dep in nestedDep) {
        console.log(`   ➡️ nested dependency: ${nested_dep}`); 
        dependecy_graph[cli_dep][nested_dep] = nestedDep[nested_dep];
      }
    }
  }
  const download_list = [];

  for (let j in dependecy_graph) {
    let map_obj = dependecy_graph[j] as JsonMap;
    console.log(`🍅 Downloading & Extracting dependencies`);
    for (let i in map_obj) {
      // remove this await to have it extract parallely while downloading
      download_list.push(await getTarballLinkAndName(i, map_obj[i] as string));
    }
  }
  await Promise.all(download_list);

  if (!fs.existsSync(`./chef.lock.toml`)) writeFile("./chef.lock.toml", stringifyObj(dependecy_graph));
  else {
    const obj = parseToml(await readFile("./chef.lock.toml"));
    let toml_str = stringifyObj({ ...dependecy_graph, ...obj });
    writeFile("./chef.lock.toml", toml_str);
  }
};

(async () => {await main();})()