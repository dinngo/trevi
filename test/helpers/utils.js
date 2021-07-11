const { TEST_MNEMONIC_PHRASE } = require('./constants');
const { hdkey } = require('ethereumjs-wallet');
const bip39 = require('bip39');

async function getCreated(receipt, contract) {
  return await contract.at(receipt.logs[0].args.to);
}

function getMnemonicPrivateKey(user) {
  const seed = bip39.mnemonicToSeedSync(TEST_MNEMONIC_PHRASE);
  const hdNode = hdkey.fromMasterSeed(seed);
  // Only search the first ten accounts.
  for (i = 0; i < 10; i++) {
    var path = `m/44'/60'/0'/0/${i}`;
    var account = hdNode.derivePath(path).getWallet();
    if (account.getChecksumAddressString() === user) {
      return account.getPrivateKey();
    }
  }
}

module.exports = {
  getCreated,
  getMnemonicPrivateKey,
};
