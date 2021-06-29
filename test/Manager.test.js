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

const { expect } = require('chai');

const Manager = artifacts.require('Manager');
const Angel = artifacts.require('Angel');
const AngelFactory = artifacts.require('AngelFactory');
const Fridge = artifacts.require('Fridge');
const FridgeFactory = artifacts.require('FridgeFactory');
const SimpleToken = artifacts.require('SimpleToken');

contract('Manager', function([_, user]) {
  beforeEach(async function() {
    this.manager = await Manager.new();
    const angelFactory = await this.manager.angelFactory.call();
    const fridgeFactory = await this.manager.fridgeFactory.call();
    this.angelFactory = await AngelFactory.at(angelFactory);
    this.fridgeFactory = await FridgeFactory.at(fridgeFactory);
    this.token1 = await SimpleToken.new('Staking', 'STK', ether('1000000000'));
    this.token2 = await SimpleToken.new('Reward', 'RWD', ether('1000000000'));
  });

  describe('Get fridge', function() {
    beforeEach(async function() {
      await this.fridgeFactory.create(this.token1.address);
    });

    it('created', async function() {
      expect(
        await this.manager.getFridge.call(this.token1.address)
      ).to.not.equal(ZERO_ADDRESS);
    });

    it('not created', async function() {
      expect(await this.manager.getFridge.call(this.token2.address)).equal(
        ZERO_ADDRESS
      );
    });
  });
});
