const crypto = require('crypto');
const fs = require('fs');

const keyFile = './key.txt';
const dataFile = './data.txt';

var keyPair = null; 
var data = {
  lastReceivedTS: 0, // az utolsó szervertől kiolvasott üzenet időpontja
  receiveTS: 0, // a legfrissebb fogadott üzenet küldési ideje
  groups: {},
  friends: {},
  messages: {},
}; // default data

function getKeyPair() { return keyPair; }
function getData() { return data; }

function getPublicKey() {
  return keyPair.publicKey;
}

function findFriendName(key) {
  const entries = Object.entries(data.friends);
  for (let i = 0; i < entries.length; i++) {
    let [name, k] = entries[i];
    if (k == key) return name;
  }
  return '???';
}

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
  getKeyPair,
  getPublicKey,
  getData,
  init,
  addFriend,
  addGroup,
  updateLastReceivedTS,
  findFriendName,
  addMessage,
}