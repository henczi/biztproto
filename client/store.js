const crypto = require('crypto');
const fs = require('fs');

const keyFile = './key.txt';
const dataFile = './data.txt';

var keyPair = null; 
var data = {
  receiveWindowSize: 300000, /* ms */
  lastReceivedTS: 0, // az utolsó szervertől kiolvasott üzenet időpontja (message queue)
  receiveWindowTS: 0, // a legfrissebb fogadott üzenet küldési ideje (replay window)
  groups: {},
  friends: {},
  messages: {},
  receiveWindow: [],
}; // default data

function getKeyPair() { return keyPair; }
function getData() { return data; }
function getPublicKey() { return keyPair.publicKey; }

function equalsPK(pk1, pk2) { return pk1.replace(/\n/g, '').trim() == pk2.replace(/\n/g, '').trim(); }

/**
 * Ismerős nevének lekérése publikus kulcs alapján
 */
function findFriendName(key) {
  const entries = Object.entries(data.friends);
  // Keresés az ismerősők közt
  for (let i = 0; i < entries.length; i++) {
    let [name, k] = entries[i];
    if (equalsPK(k, key)) return name; // első egyezés nevének visszadása
  }
  return '???'; // ha nem ismert
}

/**
 * Ablakon kívüli üzenetek törlése
 */
function receiveWindowRemoveOld() {
  data.receiveWindow = data.receiveWindow.filter(x => x.ts >= (data.receiveWindowTS - data.receiveWindowSize));
  writeData();
}

/**
 * Új elem hozzáadása a fogadási ablakhoz
 * @param {*} ts 
 * @param {*} data 
 */
function addItemToWindow(ts, item) {
  // újabb üzenet esetén
  if (ts > data.receiveWindowTS) {
    data.receiveWindowTS = ts; // TS frissítése
  }
  // beszúrás az ablakon belül vett adatok közé
  data.receiveWindow.push({ ts, data: item });
  writeData();
}

/**
 * lastReceivedTS frissítése, ha van újabb fogadott üzenet
 * @param {*} ts 
 */
function updateLastReceivedTS(ts) {
  if (ts > data.lastReceivedTS) {
    data.lastReceivedTS = ts;
    writeData();
  }
}

function createOrReadKey() {
  // Ha van kulcsfájl
  if (fs.existsSync(keyFile)) {
    keyPair = JSON.parse(fs.readFileSync(keyFile)); // kulcs beolvasása fájlból
    console.log('[*] KEY LOADED');
  // Ha nincs kulcsfájl
  } else {
    keyPair = createKeyPair(); // új kulcs létrehozása
    fs.writeFileSync(keyFile, JSON.stringify(keyPair)); // kulcs mentése fájlba
    console.log('[*] KEY GENERATED');
  }
}

/**
 * Új RSA kulcspár létrehozása
 */
function createKeyPair() {
  // Új (4096 bites) RSA kulcs létrehozása 
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
}

/**
 * Adatok beolvasása fájlból
 */
function readData() {
  if (fs.existsSync(dataFile)) {
    data = JSON.parse(fs.readFileSync(dataFile));
  }
}

/**
 * Adatok kiírása fájlba
 */
function writeData() {
  fs.writeFileSync(dataFile, JSON.stringify(data, null, '\t'));
}

/**
 * Új barát felvétele
 * @param {*} name 
 * @param {*} pubKey 
 */
function addFriend(name, pubKey) {
  if (!data.friends[name]) {
    data.friends[name] = pubKey;
    writeData(); // Mentés
    return true; // Sikeres hozzáadás
  } else {
    return false; // Sikertelen hozzáadás
  }
}

/**
 * Ismerettség lekérdezése publikus kulcs alapján
 */
function isFriend(userPubKey) {
  const friendList = Object.values(data.friends);
  for (let i = 0; i < friendList.length; i++) {
    const item = friendList[i];
    if (equalsPK(userPubKey, item)) // első egyezés esetén igaz
      return true;
  }
  return false;
}

/**
 * Új csoport létrehozása
 * @param {*} guid 
 * @param {*} participants 
 */
function addGroup(guid, participants) {
  if (!data.groups[guid]) {
    data.groups[guid] = participants;
    writeData(); // Mentés
    return true; // Sikeres hozzáadás
  } else {
    return false; // Sikertelen hozzáadás
  }
}

/**
 * Felhasználó csoporttagságának ellenőrzése publikus kulcs alapján
 */
function isUserInGroup(guid, userPubKey) {
  if (!data.groups[guid]) return;
  for (let i = 0; i < data.groups[guid].length; i++) {
    const item = data.groups[guid][i];
    if (equalsPK(userPubKey, item))
      return true;
  }
  return false;
}

/**
 * Fogadott üzenet mentése
 */
function addMessage(guid, plaintextMsg) {
  data.messages[guid] = data.messages[guid] || [];
  data.messages[guid].push(plaintextMsg);
  writeData();
}

function init() {
  // Adatok felolvasása fájlból
  createOrReadKey();
  readData();
}

module.exports = {
  equalsPK,
  getKeyPair,
  getPublicKey,
  getData,
  init,
  addFriend,
  addGroup,
  updateLastReceivedTS,
  findFriendName,
  addMessage,
  receiveWindowRemoveOld,
  addItemToWindow,
  isUserInGroup,
  isFriend,
}