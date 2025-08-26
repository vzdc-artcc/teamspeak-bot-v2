import dotenv from "dotenv";
import {TeamSpeak} from "ts3-nodejs-library";
import {assignUserDataToClient, fetchUserData} from "./user";
import {PREFIX_LIVE, PREFIX_SB1, PREFIX_SB2, updateLivePosition, updateSb1Position, updateSb2Position} from "./atc";
import {cleanUpUnusedTempServerGroups, removeAllTempServerGroups} from "./lib/server_group";

dotenv.config();

const {
    TS_QUERY_USERNAME = '',
    TS_QUERY_PASSWORD = '',
    TS_QUERY_HOST = '',
    TS_QUERY_PORT = '',
} = process.env;

if (!TS_QUERY_USERNAME || !TS_QUERY_PASSWORD || !TS_QUERY_HOST || !TS_QUERY_PORT) {
    throw new Error("Missing TS_QUERY environment variables");
}

const teamspeak = new TeamSpeak({
    host: TS_QUERY_HOST,
    serverport: parseInt(TS_QUERY_PORT),
    username: TS_QUERY_USERNAME,
    password: TS_QUERY_PASSWORD,
    nickname: 'vZDC TeamSpeak Bot',
});

teamspeak.on("ready", async () => {
    await cleanUpUnusedTempServerGroups(teamspeak);

    setInterval(async () => {
        try {
            const clientList = (await teamspeak.clientList()).filter(client => client.type === 0);
            for (const client of clientList) {
                const userData = await fetchUserData(client.uniqueIdentifier);
                if (!userData) { continue; }
                await updateLivePosition(teamspeak, client, userData.cid);
                await updateSb1Position(teamspeak, client, userData.cid);
                await updateSb2Position(teamspeak, client, userData.cid);
            }
        } catch (err) {
            console.error("Error updating positions for clients.  Will retry in 60 seconds.", err);
        }
    }, 60 * 1000) // Every 60 seconds

    setInterval(async () => {
        await cleanUpUnusedTempServerGroups(teamspeak);
    }, 60 * 60 * 1000); // Every 60 minutes
});

teamspeak.on("clientconnect", async ({ client }) => {

    if (client.type !== 0) {
        // Ignore non-regular clients (e.g., server query clients)
        return;
    }

    const userData = await fetchUserData(client.uniqueIdentifier);
    await assignUserDataToClient(client, userData);
});

teamspeak.on("clientdisconnect", async ({ client }) => {
    if (!client || client.type !== 0) {
        return;
    }

    await removeAllTempServerGroups(teamspeak, client, PREFIX_LIVE);
    await removeAllTempServerGroups(teamspeak, client, PREFIX_SB1);
    await removeAllTempServerGroups(teamspeak, client, PREFIX_SB2);
});

