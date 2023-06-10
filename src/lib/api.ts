#!/usr/bin/env node
import axios from "axios";
import * as fs from "fs";
import * as https from "https";
import { getFileName, unZip } from "./utils";

export const dir_name = "node_modules";
const base_url = "https://registry.npmjs.org";

//get latest dependecy version
export const getLatestVersion = async (dependecy: string): Promise<string[]> => {
  try {
    const { data } = await axios.get(`${base_url}/${dependecy}`);
    return [dependecy, data["dist-tags"]["latest"]];
  } catch (err) {
    throw err;
  }
};

//get dependecies and dev dependencies of packages in our toml config
export const getImmedteDep = async (dependecy: string, version: string): Promise<{}> => {
  try {
    const { data } = await axios.get(
      `${base_url}/${dependecy}/${await getVersion(dependecy, version)}`
    );
    //get immediate dependencies of the dependency
    const related_dep = data["dependencies"];
    return related_dep;
  } catch (err) {
    throw err;
  }
};

export const getNestedDep = async (dependecy: string, version: string): Promise<{}> => {
  try {
    const { data } = await axios.get(`${base_url}/${dependecy}/${await getVersion(dependecy, version)}`);
    let all_dependecies = {};
    const related_dep = data["dependencies"];
    const all_related_dep = { ...related_dep };
    //if there are nested dependecies, recursively call the function
    if (Object.values(all_related_dep).length > 0) {
      //append to the dep map
      for (let item in all_related_dep) {
        all_dependecies[item] = all_related_dep[item];
        let v= await getNestedDep(item, all_related_dep[item] as string)
        for(let a in v) all_dependecies[a] = v[a];
      }
    }
    return all_dependecies;
  } catch (err) {
    console.error(err);
  }
};

export const getTarballLinkAndName = async (dependecy: string, version: string, v: boolean) => {
  try {
    if(v)   (` ➡️ Downloading: ${dependecy}`);
    const { data } = await axios.get(`${base_url}/${dependecy}/${await getVersion(dependecy, version)}`);
    const download_link = data["dist"]["tarball"];
    const name = data["name"];
    await downloadAndunZip([download_link, name], v);
  } catch (err) {
    console.error(err);
  }
};

const downloadAndunZip = async (link: string[], v: boolean) => {
  try {
    if(v) console.log(`   ➡️ Extracting: ${link[1]}`);
    if (!fs.existsSync(`./${dir_name}`)) fs.mkdirSync(`${dir_name}`);
    const fileName = getFileName(link[0]);

    const module_location = `./${dir_name}/${fileName}`;

    const file = fs.createWriteStream(module_location);
    const request = https.get(link[0], function (response) {
      response.pipe(file);
      file.on("finish", async () => {
        //extract zip and copy to right location
        file.close();
        await unZip(module_location, `./${dir_name}/${link[1]}`);
      });
    });
  } catch (err) {
    console.log(err);
  }
};

// fails many cases and is the source of error most of the time :((
const getVersion = async (dependency: string, version: string): Promise<string> => {
  if (version.includes("*")) {
    const ver = await getLatestVersion(dependency);
    return ver[1];
  } else {
    if(version.split(".").length==3){
      const pattern = /\b(\d+)\.(\d+)\.(\d+)\b/g;
      const matches = version.match(pattern);
      return matches[0];
    } else {
      // "~2" type
      const ver = await getLatestVersion(dependency);
      return ver[1];
    }
  }
};