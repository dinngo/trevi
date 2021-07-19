const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const utils = web3.utils;

const { getCreated } = require('./helpers/utils');
const { expect } = require('chai');

const Archangel = artifacts.require('Archangel');
const Angel = artifacts.require('Angel');
const AngelFactory = artifacts.require('AngelFactory');
const Fountain = artifacts.require('Fountain');
const FountainFactory = artifacts.require('FountainFactory');
const SimpleToken = artifacts.require('SimpleToken');

contract('Angel factory', function([_, user, someone]) {
  beforeEach(async function() {
    this.archangel = await Archangel.new(new BN('9'));
    const angelFactory = await this.archangel.angelFactory.call();
    const fountainFactory = await this.archangel.fountainFactory.call();
    this.angelFactory = await AngelFactory.at(angelFactory);
    this.fountainFactory = await FountainFactory.at(fountainFactory);
    this.token1 = await SimpleToken.new('Staking', 'STK', ether('1000000000'));
    this.token2 = await SimpleToken.new('Reward', 'RWD', ether('1000000000'));
  });

  describe('Create', function() {
    it('should revert if zero address reward', async function() {
      await expectRevert(
        this.angelFactory.create(ZERO_ADDRESS),
        'reward is zero address'
      );
    });
  });

  describe('Is valid', function() {
    beforeEach(async function() {
      // Get angel
      let receipt = await this.angelFactory.create(this.token1.address);
      this.angel = await getCreated(receipt, Angel);
    });

    it('valid angel', async function() {
      expect(
        await this.angelFactory.isValid.call(this.angel.address)
      ).to.be.true;
    });

    it('invalid angel', async function() {
      expect(await this.angelFactory.isValid.call(someone)).to.be.false;
    });
  });

  describe('Reward of', function() {
    beforeEach(async function() {
      // Get angel
      let receipt = await this.angelFactory.create(this.token1.address);
      this.angel = await getCreated(receipt, Angel);
    });

    it('normal', async function() {
      expect(
        await this.angelFactory.rewardOf.call(this.angel.address)
      ).to.be.eq(this.token1.address);
    });
  });
});
