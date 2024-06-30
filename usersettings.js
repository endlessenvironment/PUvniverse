// usersettings.js

import { getDatabase, ref, set, get, remove } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";
import { setCookie, getCookie, eraseCookie } from './cookies.js';

const database = getDatabase();

export async function setNickname(userId, nickname) {
    setCookie(`nickname_${userId}`, nickname, 30); // Store for 30 days
    try {
        await set(ref(database, `nicknames/${userId}`), nickname);
        await set(ref(database, `connections/${userId}`), nickname);
        console.log("Nickname set successfully");
        return true;
    } catch (error) {
        console.error("Error setting nickname: ", error);
        return false;
    }
}

// ... (rest of the code remains the same)

export async function getNickname(userId) {
    const cookieNickname = getCookie(`nickname_${userId}`);
    if (cookieNickname) {
        return cookieNickname;
    }

    try {
        const snapshot = await get(ref(database, `nicknames/${userId}`));
        if (snapshot.exists()) {
            const nickname = snapshot.val();
            setCookie(`nickname_${userId}`, nickname, 30); // Store for 30 days
            return nickname;
        } else {
            console.log("No nickname found");
            return null;
        }
    } catch (error) {
        console.error("Error getting nickname: ", error);
        return null;
    }
}

export function updateNickname(userId, newNickname) {
    return setNickname(userId, newNickname);
}

export async function initializeNickname(userId) {
    let nickname = getCookie(`nickname_${userId}`);
    if (!nickname) {
        nickname = await getNickname(userId);
    }
    if (!nickname) {
        nickname = `User_${userId.slice(0, 5)}`;
        await setNickname(userId, nickname);
    }
    document.getElementById('ListNickname').value = nickname;
    return nickname;
}

export function setupNicknameListener(userId) {
    const nicknameInput = document.getElementById('ListNickname');
    nicknameInput.addEventListener('change', () => {
        const newNickname = nicknameInput.value.trim();
        if (newNickname) {
            updateNickname(userId, newNickname);
        }
    });
}

export async function deleteNickname(userId) {
    try {
        await remove(ref(database, `nicknames/${userId}`));
        console.log("Nickname deleted successfully");
        return true;
    } catch (error) {
        console.error("Error deleting nickname: ", error);
        return false;
    }
}