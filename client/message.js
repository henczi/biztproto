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

/**
 * Publikus kulcs SHA256 hash base64 formátumban
 * @param {*} publicKey 
 */
function hashPublicKey(publicKey) {
  return crypto.createHash('sha256').update(publicKey.replace(/\n/g, '').trim(), 'utf8').digest().toString('base64');
}

/**
 * Új üzenetek kiolvasása a szerveren lévő üzenetsorból
 */
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
      // Minden üzenetre
      for(let i = 0; i < messages.length; i++) {
        const item = messages[i];
        // idő frisssítés
        // Ha van újabb beérkezési idővel rendelkező fogadott üzenet,
        // akkor az utolsó fogadott üzenet időpontját frissíti,
        // így a továbbiakban csak az újabb üzeneteket kéri le
        store.updateLastReceivedTS(item.ts);
        // Üzenet tartalmának feldolgozása
        processMessage(item.data);
      }

      setTimeout(receiveMessage, 3000 /* ms */); // késleltetés; újrakérdezés


    });
  });

  req.end();
}

/**
 * Visszajátszás ellenőrzése
 * @param {*} ts
 * @param {*} data 
 */
function replayDetect(ts, data) {
  // ablakon kívüli tárolt üzenetek törlése
  store.receiveWindowRemoveOld();

  // túl régi - az ablakon kívüli üzent
  if (ts < (store.getData().receiveWindowTS - store.getData().receiveWindowSize)) {
    return 'Ablakon kívüli üzenet';
  }

  // már korábban fogadott üzenet (az időablakon belül fogadott üzenetek közt már megtalálható)
  if (store.getData().receiveWindow.filter(x => x.data == data).length > 0) {
    return 'Korábban már fogadott üzenet';
  }

  // nem visszajátszás
  // üzenet mentése az ablakon belül fogadott üzenetekbe
  store.addItemToWindow(ts, data);
  return false;
}

function processMessage(messageString) {
  const messageObj = JSON.parse(messageString); // Üzenet parseolása
  const symmetricKey = mc.privateDecryptKey(store.getKeyPair().privateKey, messageObj.encrypted_symmetric_key); // szimmetrikus kulcs (és counter) dekódolása
  const decryptedMessageString = mc.decryptMessage(symmetricKey, messageObj.encrypted_data); // üzenet dekódolása a szimmetrikus kulcs segítségével
  const decryptedMessageObj = JSON.parse(decryptedMessageString); // dekódolt üzenet parseolása
  const messageBodyObj = JSON.parse(decryptedMessageObj.message_body); // üzenet tartalmának parseolása
  const verified = mc.verifySign(messageBodyObj.from, decryptedMessageObj.message_body, decryptedMessageObj.message_sign); // aláírás ellenőrzése

  // visszajátszás detektálás
  const replayDetectResult = replayDetect(messageBodyObj.ts, decryptedMessageObj.message_body);
  if (replayDetectResult) {
    console.info('[[INFO]]: Visszajátszás! - ' + replayDetectResult);
    return; // üzent eldobása
  }

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

/**
 * Hello üzenet feldolgozása
 * @param {*} messageBody 
 */
function processHelloMessage(messageBody) {
  // csoport kérelmek engedélyezése csak ismerős számára
  if (store.isFriend(messageBody.from) || store.equalsPK(messageBody.from, store.getPublicKey()))
    store.addGroup(messageBody.guid, messageBody.participants);
  else
    console.info('[[INFO]]: Csoportkérelem ismeretlen felhasználótól!');
}

/**
 * Szöveges üzenet feldolgozása
 * @param {*} messageBody 
 */
function processTextMessage(messageBody) {
  const sender = messageBody.from; // küldő fél

  // üzenet elfogadása csak a csoport tagjától
  if (!store.isUserInGroup(messageBody.guid, messageBody.from)){
    // ha az üzenet küldője nem tagja a csoportnak,
    // akkor az üzenetet eldobjuk
    return;
  }

  // Küldő nevének meghatározása
  let senderName;
  // Saját üzenet
  if (store.equalsPK(sender, store.getPublicKey())) {
    senderName = 'Te';
  
  // Más által küldött
  } else {
    senderName = store.findFriendName(sender); // Küldő nevének lekérése
  }


  // Kiírandó üzenet
  const messageText = `${senderName}: ${messageBody.data}`;

  // Üzenet mentése
  store.addMessage(messageBody.guid, messageText);

  // Ha a csoport chat meg van nyitva, akkor az üzenet kiírása a konzolra
  if (global.ACTIVE_CHAT_GROUP == messageBody.guid) {
    console.log(messageText);
  }
}

/**
 * Üzenet küldése a szervernek
 * @param {*} to 
 * @param {*} data 
 */
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
  const signedMessageString = JSON.stringify(signedMessage); // sorosítás
  const encrypedMessage = mc.encryptMessage(symmetricKey, signedMessageString); // Szimmetrikus kulcsú tirkosítás

  // Minden résztvevőnek
  for (let i = 0; i < participants.length; i++) {
    // résztvevő
    const p = participants[i];

    // kulcs tikosítás a címzett (résztvevő) publikus kulcsával
    const publicEncryptedSymmetricKey = mc.publicEncryptKey(p, symmetricKey); 

    // üzenet
    const message = {
      encrypted_symmetric_key: publicEncryptedSymmetricKey,
      encrypted_data: encrypedMessage,
    };

    const messageString = JSON.stringify(message); // sorosítás
    sendMessage(hashPublicKey(p), messageString); // küldés a résztvevőnek
  }
}

/**
 * Üzenet aláírása
 * @param {*} messageBody 
 */
function signMessage(keyPair, messageBody) {
  const messageBodyString = JSON.stringify(messageBody); // objektum sorosítása
  const signedMessage = {
    message_body: messageBodyString,
    message_sign: mc.createSign(keyPair.privateKey, messageBodyString) // aláírás létrehozása
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
  return signMessage(keyPair, messageBody); // aláírás
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
  return signMessage(keyPair, messageBody); // aláírás
}

module.exports = {
  startReceiveMessage,
  encryptAndSendMessageTo,
  createHelloMessage,
  createTextMessage,
}