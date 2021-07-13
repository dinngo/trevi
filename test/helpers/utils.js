const { TEST_MNEMONIC_PHRASE } = require('./constants');
const { hdkey } = require('ethereumjs-wallet');
const bip39 = require('bip39');
const { BN } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

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

function expectEqWithinBps(actual, expected, bps = 1) {
  const base = new BN('10000');
  const upper = new BN(expected).mul(base.add(new BN(bps))).div(base);
  const lower = new BN(expected).mul(base.sub(new BN(bps))).div(base);
  expect(expected).to.be.bignumber.lte(upper);
  expect(expected).to.be.bignumber.gte(lower);
}

module.exports = {
  getCreated,
  getMnemonicPrivateKey,
  expectEqWithinBps,
};
