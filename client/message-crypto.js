const crypto = require('crypto');

/**
 * Aláírás létrehozása
 * @param {*} privateKey 
 * @param {*} data 
 */
function createSign(privateKey, data) {
  const signer = crypto.createSign('SHA256'); // aláíro létrehozása SHA-256 hash

  // aláíró feltöltése az aláírandó adattal
  signer.update(data);
  signer.end();

  // base64 kódolt aláírás létrehozása a privát kulcs segítségével
  return signer.sign(privateKey).toString('base64'); 
}

/**
 * Aláírás ellenőrzése
 * @param {*} publicKey 
 * @param {*} data 
 * @param {*} signature 
 */
function verifySign(publicKey, data, signature) {
  const verifier = crypto.createVerify('SHA256'); // aláíró letrehozása SHA-256 hash

  // aláíró feltöltése az aláírandó adattal
  verifier.update(data);
  verifier.end();

  // aláírás ellenőrzése a publikus kulcs és a base64 kódolt aláírás segítségével
  return verifier.verify(publicKey, Buffer.from(signature, 'base64')); 
}

/**
 * Véletlen szöveges kulcs létrehozása
 */
function createRandomKey() {
  return crypto.randomBytes(16).toString('base64').substring(0,16);
}

/**
 * Új szimmetrikus kulcs és iv (counter) létrehozása
 */
function createSymmetricKey() {
  const key = createRandomKey(); // véletlen szöveges kulcs - 16byte
  const nonce = crypto.randomBytes(12); // 96 bit
  const counter0 = Buffer.alloc(4, 0);// 32 bit
  // Counter állapot 96 bites nonce prefix, és 32 bites számláló 0 értékkel
  const iv = Buffer.concat([nonce, counter0]).toString('base64'); // base64 kódolva
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
  const keyStr = key + '|' + iv; // kulcs és iv (counter állapot) összefűzése
  return crypto.publicEncrypt(publicKey, Buffer.from(keyStr)).toString('base64');
}

function privateDecryptKey(privateKey, encrypedKeyStr /* base64 */) {
  const decrypedKeyStr = crypto.privateDecrypt(privateKey, Buffer.from(encrypedKeyStr, 'base64')).toString();
  const [key, iv] = decrypedKeyStr.split('|'); // kulcs és iv (counter állapot) szétválasztása
  return { key, iv };
}

module.exports = {
  createSign,
  verifySign,
  createSymmetricKey,
  encryptMessage,
  decryptMessage,
  publicEncryptKey,
  privateDecryptKey,
}

/*

let sign = createSign(store.getKeyPair().privateKey, 'alma-áéáű');
console.log('sign', sign);
let verify = verifySign(store.getKeyPair().publicKey, 'alma-áéáű', sign);
console.log('verify', verify);



let symmetricKey = createSymmetricKey();
console.log('symmetric key', symmetricKey);

let encryped = encryptMessage(symmetricKey, 'HELLoooo');
console.log('encryped msg', encryped);

let publicEncryptedSymmetricKey = publicEncryptKey(store.getKeyPair().publicKey, symmetricKey);
console.log('pub encr key', publicEncryptedSymmetricKey);

let privateDecryptedSymmetricKey = privateDecryptKey(store.getKeyPair().privateKey, publicEncryptedSymmetricKey);
console.log('priv decr key', privateDecryptedSymmetricKey);

let decrypted = decryptMessage(privateDecryptedSymmetricKey, encryped);
console.log('decrypted msg', decrypted);

*/