const https = require('https');
const crypto = require('crypto');
const store = require('./store');
const mc = require('./message-crypto');

const REMOTE_HOST = 'localhost';
const REMOTE_PORT = 1234;

// Önaláírt HTTPS cert engedélyezése
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

function startReceiveMessage() {
  receiveMessage();
}

function hashPublicKey(publicKey) {
  return crypto.createHash('sha256').update(publicKey.replace(/\n/g, '').trim(), 'utf8').digest().toString('base64');
}

function receiveMessage() {
  const options = {
    hostname: REMOTE_HOST,
    port: REMOTE_PORT,
    // /get/<user>/<start_time>
    path: '/get/' + encodeURIComponent(hashPublicKey(store.getPublicKey())) + '/' + store.getData().lastReceivedTS,
    method: 'get'
  };
  // Új üzenetek lekérdezése
  const req = https.request(options, (res) => {
    var data = '';
    res.on('data', chk => data += chk);
    res.on('end', () => {

      const messages = JSON.parse(data); // Üzenetek
      for(let i = 0; i < messages.length; i++) {
        const item = messages[i];
        store.updateLastReceivedTS(item.ts); // idő frisssítés
        processMessage(item.data);
      }

      setTimeout(receiveMessage, 3000 /* ms */); // késleltetés; újrakérdezés


    });
  });

  req.end();
}

function processMessage(messageString) {
  const messageObj = JSON.parse(messageString); // Üzenet parseolása
  const symmetricKey = mc.privateDecryptKey(store.getKeyPair().privateKey, messageObj.encrypted_symmetric_key); // szimmetrikus kulcs dekódolása
  const decryptedMessageString = mc.decryptMessage(symmetricKey, messageObj.encrypted_data); // üzenet dekódolása a szimmetrikus kulcs segítségével
  const decryptedMessageObj = JSON.parse(decryptedMessageString); // dekódolt üzenet parseolása
  const messageBodyObj = JSON.parse(decryptedMessageObj.message_body); // üzenet tartalmának parseolása
  const verified = mc.verifySign(messageBodyObj.from, decryptedMessageObj.message_body, decryptedMessageObj.message_sign); // aláírás ellenőrzése

  // TODO: visszajátszás detektálás

  // ellenőrzőtt aláírás
  if (verified) {
    // üzenet tartalmának feldolgozása típustól függően
    switch (messageBodyObj.type) {
      case 'HELLO':   processHelloMessage(messageBodyObj); break;
      case 'MESSAGE': processTextMessage(messageBodyObj);  break;
    }
  } else {
    // Üzenet eldobása
  }
}

function processHelloMessage(messageBody) {
  // TODO: csoport kérelmek tiltása/engedélyezése
  // Minden csoport engedélyezve
  store.addGroup(messageBody.guid, messageBody.participants);
}

function processTextMessage(messageBody) {
  const sender = messageBody.from;
  // TODO: kuldo neve
  const messageText = `...: ${messageBody.data}`;
  if (global.ACTIVE_CHAT_GROUP == messageBody.guid) {
    console.log(messageText);
  }
}

function sendMessage(to, data) {
  var options = {
    hostname: REMOTE_HOST,
    port: REMOTE_PORT,
    path: '/send/' + encodeURIComponent(to),
    method: 'POST',
    headers: {
         'Content-Type': 'text/plain',
         'Content-Length': data.length
       }
  };

  const req = https.request(options, (res) => {

    var data = '';
    res.on('data', chk => data += chk);
    res.on('end', () => {

      /* Message sent */

    });

  });
  req.write(data);
  req.end();
}

function encryptAndSendMessageTo(signedMessage, participants) {
  const symmetricKey = mc.createSymmetricKey(); // Szimmetrikus kulcs létrehozása
  const signedMessageString = JSON.stringify(signedMessage); // Konvertálás szöveggé
  const encrypedMessage = mc.encryptMessage(symmetricKey, signedMessageString); // Szimmetrikus kulcsú tirkosítás

  // Minden résztvevőnek
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]; // résztvevő
    const publicEncryptedSymmetricKey = mc.publicEncryptKey(p, symmetricKey); // kulcs tikosítás a címzett (résztvevő) publikus kulcsával
    // üzenet
    const message = {
      encrypted_symmetric_key: publicEncryptedSymmetricKey,
      encrypted_data: encrypedMessage,
    };
    const messageString = JSON.stringify(message); // konvertálás szöveggé
    sendMessage(hashPublicKey(p), messageString); // küldés
  }
}

/**
 * Üzenet aláírása
 * @param {*} messageBody 
 */
function signMessage(keyPair, messageBody) {
  const messageBodyString = JSON.stringify(messageBody); // objektum szöveggé konvertálása
  const signedMessage = {
    message_body: messageBodyString,
    message_sign: mc.createSign(keyPair.privateKey, messageBodyString) // aláírás
  };
  return signedMessage;
}

function createHelloMessage(keyPair, guid, participants) {
  const messageBody = {
    type: "HELLO",
    from: keyPair.publicKey,
    guid: guid,
    participants: participants,
    ts: +new Date
  };
  return signMessage(keyPair, messageBody);
}

function createTextMessage(keyPair, guid, msg) {
  const messageBody = {
    type: "MESSAGE",
    from: keyPair.publicKey,
    guid: guid,
    ts: +new Date,
    data_type: "TEXT",
    data: msg,
  };
  return signMessage(keyPair, messageBody);
}

module.exports = {
  startReceiveMessage,
  encryptAndSendMessageTo,
  createHelloMessage,
  createTextMessage,
}