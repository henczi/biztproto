const crypto = require('crypto');
const readline = require('readline');
const store = require('./store');

store.init();

function createSign(privateKey, data) {
  const signer = crypto.createSign('SHA256');

  signer.update(data);
  signer.end();

  return signer.sign(privateKey); // TODO: Buffer -> b64
}

function verifySign(publicKey, data, signature) {
  const verifier = crypto.createVerify('SHA256');

  verifier.update(data); // TODO: b64 -> Buffer
  verifier.end();

  return verifier.verify(publicKey, signature);
}

function createSymmetricKey() {
  
}


let sign = createSign(store.getKey().privateKey, 'alma-áéáű');
console.log('sign', sign);
let verify = verifySign(store.getKey().publicKey, 'alma-áéáű', sign);
console.log('verify', verify);





const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(q) {
  return new Promise((r) => rl.question(q, r))
}

const MENU = {
  '0': { name: 'Kilépés' },
  '1': { name: 'Csoportok', fn: groups },
  '2': { name: 'Új csoport létrehozása', fn: newGroup },
  '3': { name: 'Ismerősök', fn: friends },
  '4': { name: 'Új ismerős felvétele', fn: newFriend },
}

async function menu() {
  let answer;
  do {
    Object.keys(MENU).forEach(x => console.log(`${x} - ${MENU[x].name}`))
    answer = await question('#>');
    if (MENU.hasOwnProperty(answer)) {
      if (answer == '0') process.exit();
      else await MENU[answer].fn();
    }
  } while(true)
}

async function groups() {
  console.log('groups')
}

async function newGroup() {
  console.log('new group')
}

async function friends() {
  console.log('friends')
}

async function newFriend() {
  console.log('new friend')
}

async function groupChat() {
  console.log('group chat');
}


menu();
