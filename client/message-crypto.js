const crypto = require('crypto');

/**
 * Aláírás létrehozása
 */
function createSign(privateKey, data) {
  const signer = crypto.createSign('SHA256'); // aláíró létrehozása (SHA-256 hash)

  // aláíró feltöltése az aláírandó adattal
  signer.update(data);
  signer.end();

  // base64 kódolt aláírás létrehozása a privát kulcs segítségével
  return signer.sign(privateKey).toString('base64'); 
}

/**
 * Aláírás ellenőrzése
 */
function verifySign(publicKey, data, signature) {
  const verifier = crypto.createVerify('SHA256'); // aláíró letrehozása (SHA-256 hash)

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
  // iv = Counter állapot 96 bites nonce prefix, és 32 bites számláló 0 kezdőértékkel
  const iv = Buffer.concat([nonce, counter0]).toString('base64'); // base64 kódolva
  return {key, iv};
}

/**
 * Üzenet rejtjelezése szimmetrikus kulcs segítségével
 * @param {*} param0 kulcs
 * @param {*} data rejtjelezendő szöveges üzenet
 * @returns rejtjelezett üzenet base64 kódolva
 */
function encryptMessage({key, iv}, data) {
  const cipher = crypto.createCipheriv("aes-128-ctr", key, Buffer.from(iv, 'base64'));
  return cipher.update(data, 'utf-8', 'base64') + cipher.final('base64');
}

/**
 * Üzenet dekódolása szimmetrikus kulcs segítségével
 * @param {*} param0  kulcs
 * @param {*} encryptedData base64 kódolt rejtjelezett üzenet
 * @returns nyílt üzenet
 */
function decryptMessage({key, iv}, encryptedData) {
  const cipher = crypto.createDecipheriv("aes-128-ctr", key, Buffer.from(iv, 'base64'))
  return cipher.update(encryptedData, 'base64', 'utf8') + cipher.final('utf-8');
}

/**
 * Kulcs (és counter) kódolása publikus kulcs segítségével
 * @returns rejtjelezett kulcs base64 formátumban
 */
function publicEncryptKey(publicKey, {key, iv}) {
  const keyStr = key + '|' + iv; // kulcs és iv (counter állapot) összefűzése
  return crypto.publicEncrypt(publicKey, Buffer.from(keyStr)).toString('base64');
}

/**
 * Base64 formátumú rejtjelezett kulcs (és counter) dekódolása privát kulcs segítségével
 */
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
