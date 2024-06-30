import { getDatabase, ref, set, get } from "https://www.gstatic.com/firebasejs/9.1.1/firebase-database.js";

const database = getDatabase();

export function setNickname(userId, nickname) {
    return set(ref(database, `nicknames/${userId}`), nickname)
        .then(() => {
            console.log("Nickname set successfully");
            return true;
        })
        .catch((error) => {
            console.error("Error setting nickname: ", error);
            return false;
        });
}

export function getNickname(userId) {
    return get(ref(database, `nicknames/${userId}`))
        .then((snapshot) => {
            if (snapshot.exists()) {
                return snapshot.val();
            } else {
                console.log("No nickname found");
                return null;
            }
        })
        .catch((error) => {
            console.error("Error getting nickname: ", error);
            return null;
        });
}

export function updateNickname(userId, newNickname) {
    return setNickname(userId, newNickname);
}

export async function initializeNickname(userId) {
    const nickname = await getNickname(userId);
    if (nickname) {
        document.getElementById('ListNickname').value = nickname;
    } else {
        const defaultNickname = `User_${userId.slice(0, 5)}`;
        await setNickname(userId, defaultNickname);
        document.getElementById('ListNickname').value = defaultNickname;
    }
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