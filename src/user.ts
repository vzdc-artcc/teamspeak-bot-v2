import {TeamSpeakClient} from "ts3-nodejs-library";
import dotenv from "dotenv";
import {RATINGS} from "./lib/rating";

dotenv.config();

export type UserData = {
    controllerStatus: 'HOME' | 'VISITOR' | 'NONE',
    rating: number,
    onlinePosition?: string,
    cid: string
}

const {
    WEBSITE_USER_API = '',
    WEBSITE_USER_API_KEY = '',
    SG_ADD_UID = '',
    SG_HOME = '',
    SG_VISITOR = '',
    SG_GUEST = '',
    SG_ADMIN = '',
} = process.env;

const ratingRoles = RATINGS.map((rating) => process.env[`SG_${rating}`] || '').filter(Boolean);

if (!WEBSITE_USER_API || !WEBSITE_USER_API_KEY) {
    throw new Error("Missing WEBSITE_USER_API or WEBSITE_USER_API_KEY environment variables");
}

export async function assignUserDataToClient(client: TeamSpeakClient, userData?: UserData) {

    const clientServerGroups = client.servergroups;

    if (clientServerGroups.includes(SG_ADMIN)) {
        if (clientServerGroups.includes(SG_ADD_UID)) {
            await client.delGroups(SG_ADD_UID);
        }

        return; // Admins are immune
    }

    if (!userData) {
        client.message("You have not registered your TeamSpeak Unique ID on your profile in the vZDC website. This is required to sync your rating and membership status, and to assign online position roles.");
        client.message("You can find your TeamSpeak Unique ID under `Tools>Identities`. You may have to hit the `Go Advanced` link next to the OK button if you do not see your Unique ID.  You can use a local identity or a synchronized identity.");
        client.message("Add your UID on the vZDC Website in the dropdown menu in the top right corner or in the sidebar.");
        client.message("After you have added your Unique ID to your profile, please disconnect from the server and reconnect.");

        if (!clientServerGroups.includes(SG_ADD_UID)) {
            await client.addGroups(SG_ADD_UID);
        }
        return;
    }

    if (userData.rating === 0) {
        await client.kickFromServer("Suspended users are not allowed to connect to the vZDC TeamSpeak server. Please contact an administrator if you think this is a mistake.");
        return;
    }

    const userSgIds = getUserSgIds(userData);

    await removeAllExistingUserRoles(client, clientServerGroups);

    await client.addGroups(userSgIds);

    if (clientServerGroups.includes(SG_ADD_UID)) {
        await client.delGroups(SG_ADD_UID);
    }
}

export async function fetchUserData(uid: string): Promise<UserData | undefined> {
    const response = await fetch(`${WEBSITE_USER_API}?key=${WEBSITE_USER_API_KEY}`, {
        method: 'POST',
        body: uid,
    });

    if (response.status === 404) {
        return undefined;
    }

    if (!response.ok) {
        console.log(`Failed to fetch user data: ${response.statusText}`);
        return undefined;
    }

    return response.json();
}

function getUserSgIds(userData: UserData): string[] {

    const sgIds: string[] = []

    switch (userData.controllerStatus) {
        case 'HOME':
            sgIds.push(SG_HOME);
            break;
        case 'VISITOR':
            sgIds.push(SG_VISITOR);
            break;
        default:
            sgIds.push(SG_GUEST);
            break;
    }

    sgIds.push(ratingRoles[userData.rating]);

    return sgIds;
}

async function removeAllExistingUserRoles(client: TeamSpeakClient, currentServerGroups: string[]) {
    const rolesToRemove = [
        SG_HOME,
        SG_VISITOR,
        SG_GUEST,
        ...ratingRoles
    ];

    for (const role of rolesToRemove) {
        if (currentServerGroups.includes(role)) {
            await client.delGroups(role);
        }
    }
}