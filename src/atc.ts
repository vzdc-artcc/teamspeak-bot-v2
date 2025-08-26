import {TeamSpeak, TeamSpeakClient} from "ts3-nodejs-library";
import {createTempServerGroup, removeAllTempServerGroups} from "./lib/server_group";

const VNAS_LIVE="https://live.env.vnas.vatsim.net/data-feed/controllers.json";
const VNAS_SB1="https://sweatbox1.env.vnas.vatsim.net/data-feed/controllers.json";
const VNAS_SB2="https://sweatbox2.env.vnas.vatsim.net/data-feed/controllers.json";

export type VnasResponse = {
    updatedAt: Date;
    controllers: {
        artccId: string;
        positions: {
            defaultCallsign: string;
            isPrimary: boolean;
            isActive: boolean;
        }[];
        vatsimData: {
            cid: string;
            callsign: string;
            controllerInfo: string,
        };
    }[];
};


export const PREFIX_LIVE = ' ';
export const PREFIX_SB1 = 'SBX1 | ';
export const PREFIX_SB2 = 'SBX2 | ';

export async function updateLivePosition(teamspeak: TeamSpeak, client: TeamSpeakClient, cid: string,) {
    await updateOnlinePosition(teamspeak, client, cid, PREFIX_LIVE, VNAS_LIVE);
}

export async function updateSb1Position(teamspeak: TeamSpeak, client: TeamSpeakClient, cid: string,) {
    await updateOnlinePosition(teamspeak, client, cid, PREFIX_SB1, VNAS_SB1);
}

export async function updateSb2Position(teamspeak: TeamSpeak, client: TeamSpeakClient, cid: string,) {
    await updateOnlinePosition(teamspeak, client, cid, PREFIX_SB2, VNAS_SB2);
}

async function updateOnlinePosition(teamspeak: TeamSpeak, client: TeamSpeakClient, cid: string, prefix: string, endpoint: string) {
    const res = await fetch(endpoint);
    if (!res.ok) {
        console.error(`Failed to fetch online positions: ${res.statusText}`);
        return;
    }

    const data: VnasResponse = await res.json();

    const controller = data.controllers.find(c =>
        c.vatsimData.cid === cid &&
        // c.artccId === VNAS_ARTCC_ID &&
        !c.vatsimData.controllerInfo.includes('ATCTrainer'));

    if (!controller) {
        await removeAllTempServerGroups(teamspeak, client, prefix);
        return;
    }

    const primaryPosition = controller.positions.find(p => p.isPrimary && p.isActive);

    if (!primaryPosition) {
        await removeAllTempServerGroups(teamspeak, client, prefix);
        return;
    }

    const positionCallsign = primaryPosition.defaultCallsign || controller.vatsimData.callsign;
    const sg = await createTempServerGroup(teamspeak, `${prefix}${positionCallsign}`);

    if (sg && !client.servergroups.includes(sg.sgid)) {
        await removeAllTempServerGroups(teamspeak, client, prefix);
        await client.addGroups(sg.sgid);
    }
}