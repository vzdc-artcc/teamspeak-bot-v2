import {TeamSpeak, TeamSpeakClient} from "ts3-nodejs-library";
import * as fs from "node:fs";

const FILE_NAME = 'temp_server_groups.json';
const DATA_DIR = process.env.DATA_DIR || './data';
const FILE_PATH = `${DATA_DIR}/${FILE_NAME}`;

export async function createTempServerGroup(teamspeak: TeamSpeak, name: string) {
    if (await teamspeak.getServerGroupByName(name)) {
        return teamspeak.getServerGroupByName(name);
    }
    const sg = await teamspeak.serverGroupCreate(name);

    await sg.addPerm({
        permname: 'i_group_show_name_in_tree',
        permvalue: 1,
        permskip: false,
        permnegated: false,
    });

    await sg.addPerm({
        permname: 'i_group_needed_member_remove_power',
        permvalue: 70,
        permskip: false,
        permnegated: false,
    });

    await sg.addPerm({
        permname: 'i_group_needed_member_add_power',
        permvalue: 70,
        permskip: false,
        permnegated: false,
    });

    await sg.addPerm({
        permname: 'i_group_needed_member_add_power',
        permvalue: 70,
        permskip: false,
        permnegated: false,
    });

    await sg.addPerm({
        permname: 'i_group_needed_modify_power',
        permvalue: 70,
        permskip: false,
        permnegated: false,
    });

    // create a file, if not there in data directory with created server group ids locally
    if (!fs.existsSync(FILE_PATH)) {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, {recursive: true});
        }
        fs.writeFileSync(FILE_PATH, JSON.stringify([sg.sgid]));
    } else {
        const existingGroups = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
        if (!existingGroups.includes(sg.sgid)) {
            existingGroups.push(sg.sgid);
            fs.writeFileSync(FILE_PATH, JSON.stringify(existingGroups));
        }
    }
}

// export async function removeTempServerGroup(teamspeak: TeamSpeak, name: string, force = false) {
//     const sg = await teamspeak.getServerGroupByName(name);
//
//     if (sg) {
//         await sg.del(force);
//
//         if (fs.existsSync(FILE_PATH) && fs.readFileSync(FILE_PATH, 'utf-8').length > 0) {
//             const existingGroups = JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
//             const index = existingGroups.indexOf(sg.sgid);
//             if (index !== -1) {
//                 existingGroups.splice(index, 1);
//                 fs.writeFileSync(FILE_PATH, JSON.stringify(existingGroups));
//             }
//         }
//     }
// }

export const removeAllTempServerGroups = async (teamspeak: TeamSpeak, client: TeamSpeakClient, prefix = '') => {
    if (!fs.existsSync(FILE_PATH)) {
        return;
    }

    const allTempGroups: string[] = fs.readFileSync(FILE_PATH, 'utf-8').length === 0 ? [] : JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));
    const clientServerGroups = client.servergroups;

    for (const sgid of allTempGroups) {
        if (clientServerGroups.includes(sgid)) {
            const sg = await teamspeak.getServerGroupById(sgid);
            if (sg && sg.name.startsWith(prefix)) {
                try {
                    await client.delGroups(sgid);
                    await sg.del();
                    fs.writeFileSync(FILE_PATH, JSON.stringify(allTempGroups.filter((g) => g !== sgid)));
                } catch (error) {
                    console.error(`Error removing server group ${sg.name}: Group in use still`);
                }
            }
        }
    }
}

export async function cleanUpUnusedTempServerGroups(teamspeak: TeamSpeak) {
    if (!fs.existsSync(FILE_PATH)) {
        return;
    }

    const existingGroups: string[] =  fs.readFileSync(FILE_PATH, 'utf-8').length === 0 ? [] : JSON.parse(fs.readFileSync(FILE_PATH, 'utf-8'));

    const removeIdsFromFile: string[] = [];

    for (const sgid of existingGroups) {
        try {
            const sg = await teamspeak.getServerGroupById(sgid);
            if (sg) {
                const clients = await sg.clientList();
                if (clients.length === 0) {
                    await sg.del();
                    removeIdsFromFile.push(sgid);
                }
            } else {
                removeIdsFromFile.push(sgid);
            }
        } catch (error) {
            console.error(`Error removing server group with ID ${sgid}:`, error);
        }
    }

    fs.writeFileSync(FILE_PATH, JSON.stringify(existingGroups.filter(id => !removeIdsFromFile.includes(id))));
}