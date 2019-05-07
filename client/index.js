const crypto = require('crypto');
const readline = require('readline');
const store = require('./store');
const message = require('./message');

store.init();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Egy soros input beolvasás
 */
function question(q) {
  return new Promise((r) => rl.question(q, r))
}

/**
 * Publikus kulcs beolvasása
 */
function readPubKey() {
  return new Promise(resolve => {
    let input = '';
    const cb = (line) => {
      input += line + '\n';
      if (input.indexOf('-----END PUBLIC KEY-----') >= 0){
        rl.removeListener('line', cb);
        resolve(input);
      }
    }
    rl.addListener('line', cb);
  })
}

/**
 * Az aktív megnyitott chat
 */
global.ACTIVE_CHAT_GROUP = null;

/**
 * Menüpontok és hozzá tartozó függvények
 */
const MENU = {
  '0': { name: 'Kilépés' },
  '1': { name: 'Csoportok', fn: groups },
  '2': { name: 'Új csoport létrehozása', fn: newGroup },
  '3': { name: 'Ismerősök', fn: friends },
  '4': { name: 'Új ismerős felvétele', fn: newFriend },
  '5': { name: 'Publikus kulcs', fn: printPublicKey },
}

async function menu() {
  let answer;
  while (true) {
    console.clear();
    console.log('----MENU----');
    // menüpontok megjelenítlése
    Object.keys(MENU).forEach(x => console.log(`${x} - ${MENU[x].name}`))
    answer = await question('#>'); // választott menüpont beolvasása
    if (MENU.hasOwnProperty(answer)) {
      console.clear();
      if (answer == '0') process.exit(); // kilépés
      else await MENU[answer].fn(); // menüpont "megnyitása"
    }
  }
}

async function printPublicKey() {
  // saját publikus kulcs megjelenítésa
  console.log(store.getKeyPair().publicKey);
  await question('KILEPES>'); // kilépés enterre
}

async function groups() {
  console.log('----CSOPORTOK----');
  console.log('x - Kilépés   |   <id> - csoport választás'); // help megjalenítása
  const groups = store.getData().groups;
  const groupKeys = Object.keys(groups); // csoportok listája
  groupKeys.forEach((x, i) => console.log(`\t ${i} - ${x}`)); // csoportok kiírása
  let selected;
  while (true) {
    selected = await question('CSOPORT#>'); // valásztott csoport bekérése
    if (selected == 'x') break; // kilépés (menübe)
    selected = parseInt(selected, 10);
    // ha létezik a választott csoport, akkor chat megnyitása
    if (selected >= 0 && selected < groupKeys.length) {
      await groupChat(groupKeys[selected]);
    }
  }
}

async function newGroup() {
  console.log('----UJ CSOPORT----');
  const friends = store.getData().friends;
  const name = await question('Név: '); // csoportnév bekérése
  const participants = [store.getPublicKey()]; // csoporttagok (kezdetben csak saját maga)
  const friendNames = []; // felvett barátok név alapján
  while (true) {
    const participant = await question('Új tag (nev): '); // új tag felvétele (név alapján)
    // üres tag megadása - csoport létrehozás befejezése
    if (participant == '') break; // kilépés
    // megadott tag felvétele, ha az a barátok között van és még nem lett felvéve
    if (friends.hasOwnProperty(participant) && friendNames.indexOf(participant) < 0) {
      friendNames.push(participant); // név lista frissítése
      participants.push(friends[participant]); // hozzáadás a tagokhoz
    }
  }
  const guid = `${name}_${+new Date}`; // csoport azonosító létrehozása
  console.log(guid + ' - ' + friendNames); // csoport tagok kiírása
  // csoport indító (HELLO) üzenet létrehozása
  const signedHelloMsg = message.createHelloMessage(store.getKeyPair(), guid, participants);
  // csoport indító (HELLO) üzenet (titkosítása és) elküldése a részvevőknek
  message.encryptAndSendMessageTo(signedHelloMsg, participants);
  await question('KILEPES>'); // kilépés enterre
}

async function friends() {
  console.log('----BARATOK----');
  const friends = store.getData().friends;
  const friendKeys = Object.keys(friends); // barátok nevei
  friendKeys.forEach(x => console.log(`\t- ${x}`)); // nevek megjelenítése
  await question('KILEPES>'); // kilépés enterre
}

async function newFriend() {
  console.log('----UJ BARAT----');
  const name = await question('Név: '); // név bekérése
  console.log('Publikus kulcs: ');
  let pubKey = await readPubKey(); // publikus kulcs beolvasása
  const result = store.addFriend(name, pubKey); // barát hozzáadása
  console.log(result ? 'Sikere hozzáadás' : 'Sikertelen hozzáadás'); // eredmény megjelenítésa
  await question('KILEPES>'); // kilépés enterre
}

async function groupChat(guid) {
  console.clear();
  const participants = store.getData().groups[guid];
  const messages = store.getData().messages[guid] || [];
  // Előző 10 üzenet kiírása
  console.log('Utolsó 10 üzenet:');
  messages.slice(-10).forEach(x => console.log(x));
  // Aktív chat beállítása
  global.ACTIVE_CHAT_GROUP = guid;
  while (true) {
    const text = await question('');
    // ':q!' - kilépés :D
    if (text == ':q!') break;
    if (text) {
      const signedTextMessage = message.createTextMessage(store.getKeyPair(), guid, text);
      message.encryptAndSendMessageTo(signedTextMessage, participants);
    }
  }
  // Aktív chat törlése
  global.ACTIVE_CHAT_GROUP = null;
  console.clear();
}

message.startReceiveMessage();
menu();
