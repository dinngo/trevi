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

contract('Fridge factory', function([_, user]) {
  beforeEach(async function() {
    this.manager = await Manager.new();
    const angelFactory = await this.manager.angelFactory.call();
    const fridgeFactory = await this.manager.fridgeFactory.call();
    this.angelFactory = await AngelFactory.at(angelFactory);
    this.fridgeFactory = await FridgeFactory.at(fridgeFactory);
    this.token1 = await SimpleToken.new('Staking', 'STK', ether('1000000000'));
    this.token2 = await SimpleToken.new('Reward', 'RWD', ether('1000000000'));
  });

  describe('Create', function() {
    it('normal', async function() {
      const receipt = await this.fridgeFactory.create(this.token1.address);
      const fridgeAddress = await this.fridgeFactory.fridgeOf.call(
        this.token1.address
      );
      expectEvent(receipt, 'Created', { to: fridgeAddress });
    });

    it('should revert if existed', async function() {
      await this.fridgeFactory.create(this.token1.address);
      await expectRevert(
        this.fridgeFactory.create(this.token1.address),
        'fridge existed'
      );
    });
  });

  describe('Is valid', function() {
    it('created by factory', async function() {
      await this.fridgeFactory.create(this.token1.address);
      const fridgeAddress = await this.fridgeFactory.fridgeOf.call(
        this.token1.address
      );
      expect(await this.fridgeFactory.isValid(fridgeAddress)).to.be.true;
    });

    it('not created by factory', async function() {
      const fridge = await Fridge.new(this.token1.address, 'TEST', 'TST');
      expect(await this.fridgeFactory.isValid(fridge.address)).to.be.false;
    });
  });

  describe('Fridge of', function() {
    it('normal', async function() {
      let fridgeAddress = await this.fridgeFactory.fridgeOf.call(
        this.token1.address
      );
      expect(fridgeAddress).eq(ZERO_ADDRESS);
      await this.fridgeFactory.create(this.token1.address);
      fridgeAddress = await this.fridgeFactory.fridgeOf.call(
        this.token1.address
      );
      expect(fridgeAddress).not.eq(ZERO_ADDRESS);
    });
  });
});
