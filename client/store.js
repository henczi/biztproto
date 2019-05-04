const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const keyFile = './key.txt';
const dataFile = './data.txt';

var key = null; 
var data = {};

function getKey() { return key; }
function getData() { return data; }

function createOrReadKey() {
  if (fs.existsSync(keyFile)) {
    key = JSON.parse(fs.readFileSync(keyFile));
    console.log('[*] KEY LOADED');
  } else {
    key = createKeyPair();
    fs.writeFileSync(keyFile, JSON.stringify(key));
    console.log('[*] KEY GENERATED');
  }
  console.log(key.publicKey);
}

function createKeyPair() {
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

function readData() {
  if (fs.existsSync(dataFile)) {
    data = JSON.parse(fs.readFileSync(dataFile));
  }
}

function writeData() {
  fs.writeFileSync(dataFile, JSON.stringify(data));
}

function init() {
  createOrReadKey();
  readData();
}

module.exports = {
  getKey,
  getData,
  init,
}