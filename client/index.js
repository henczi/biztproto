const crypto = require('crypto');
const readline = require('readline');
const store = require('./store');
const message = require('./message');

store.init();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(q) {
  return new Promise((r) => rl.question(q, r))
}

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

global.ACTIVE_CHAT_GROUP = null;

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
    Object.keys(MENU).forEach(x => console.log(`${x} - ${MENU[x].name}`))
    answer = await question('#>');
    if (MENU.hasOwnProperty(answer)) {
      console.clear();
      if (answer == '0') process.exit();
      else await MENU[answer].fn();
    }
  }
}

async function printPublicKey() {
  console.log(store.getKeyPair().publicKey);
  await question('#>');
}

async function groups() {
  console.log('----CSOPORTOK----');
  console.log('x - Kilépés   |   <id> - csoport választás');
  const groups = store.getData().groups;
  const groupKeys = Object.keys(groups);
  groupKeys.forEach((x, i) => console.log(`\t ${i} - ${x}`));
  let selected;
  while (true) {
    selected = await question('CSOPORT#>');
    if (selected == 'x') break;
    selected = parseInt(selected, 10);
    if (selected >= 0 && selected < groupKeys.length) {
      await groupChat(groupKeys[selected]);
    }
  }
}

async function newGroup() {
  console.log('----UJ CSOPORT----');
  const friends = store.getData().friends;
  const name = await question('Név: ');
  const participants = [store.getPublicKey()];
  const friendNames = [];
  while (true) {
    const participant = await question('Új tag (nev): ');
    // üres tag megadása - csoport létrehozás befejezése
    if (participant == '') break;
    // beszúrás, ha van ilyen 
    if (friends.hasOwnProperty(participant) && friendNames.indexOf(participant) < 0) {
      friendNames.push(participant);
      participants.push(friends[participant]);
    }
  }
  const guid = `${name}_${+new Date}`;
  console.log(guid + ' - ' + friendNames);
  const signedHelloMsg = message.createHelloMessage(store.getKeyPair(), guid, participants);
  message.encryptAndSendMessageTo(signedHelloMsg, participants);
}

async function friends() {
  console.log('----BARATOK----');
  const friends = store.getData().friends;
  const friendKeys = Object.keys(friends);
  friendKeys.forEach(x => console.log(`\t- ${x}`));
  await question('BARATOK#>');
}

async function newFriend() {
  console.log('----UJ BARAT----');
  const name = await question('Név: ');
  console.log('Publikus kulcs: ');
  let pubKey = await readPubKey();
  const result = store.addFriend(name, pubKey);
  console.log(result ? 'Sikere hozzáadás' : 'Sikertelen hozzáadás');
  await question('#>');
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
