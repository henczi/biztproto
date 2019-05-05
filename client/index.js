const crypto = require('crypto');
const readline = require('readline');
const store = require('./store');

store.init();

function createSign(privateKey, data) {
  const signer = crypto.createSign('SHA256');

  signer.update(data);
  signer.end();

  return signer.sign(privateKey).toString('base64');
}

function verifySign(publicKey, data, signature) {
  const verifier = crypto.createVerify('SHA256');

  verifier.update(data);
  verifier.end();

  return verifier.verify(publicKey, Buffer.from(signature, 'base64'));
}

function createSymmetricKey() {
  const key = "1234567890123456";
  const nonce = crypto.randomBytes(12); // 96 bit
  const counter0 = Buffer.alloc(4, 0);// 32 bit
  const iv = Buffer.concat([nonce, counter0]).toString('base64');
  return {key, iv};
}

function encryptMessage({key, iv}, data) {
  const cipher = crypto.createCipheriv("aes-128-ctr", key, Buffer.from(iv, 'base64'));
  return cipher.update(data, 'utf-8', 'base64') + cipher.final('base64');
}

function decryptMessage({key, iv}, encryptedData) {
  const cipher = crypto.createDecipheriv("aes-128-ctr", key, Buffer.from(iv, 'base64'))
  return cipher.update(encryptedData, 'base64', 'utf8') + cipher.final('utf-8');
}

function publicEncryptKey(publicKey, {key, iv}) {
  const keyStr = key + '|' + iv;
  return crypto.publicEncrypt(publicKey, Buffer.from(keyStr)).toString('base64');
}

function privateDecryptKey(privateKey, encrypedKeyStr) {
  const decrypedKeyStr = crypto.privateDecrypt(privateKey, Buffer.from(encrypedKeyStr, 'base64')).toString();
  const [key, iv] = decrypedKeyStr.split('|');
  return { key, iv };
}

/* --------- */

let sign = createSign(store.getKey().privateKey, 'alma-áéáű');
console.log('sign', sign);
let verify = verifySign(store.getKey().publicKey, 'alma-áéáű', sign);
console.log('verify', verify);

/* --------- */

let symmetricKey = createSymmetricKey();
console.log('symmetric key', symmetricKey);

let encryped = encryptMessage(symmetricKey, 'HELLoooo');
console.log('encryped msg', encryped);

let publicEncryptedSymmetricKey = publicEncryptKey(store.getKey().publicKey, symmetricKey);
console.log('pub encr key', publicEncryptedSymmetricKey);

let privateDecryptedSymmetricKey = privateDecryptKey(store.getKey().privateKey, publicEncryptedSymmetricKey);
console.log('priv decr key', privateDecryptedSymmetricKey);

let decrypted = decryptMessage(privateDecryptedSymmetricKey, encryped);
console.log('decrypted msg', decrypted);

/* --------- */


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
