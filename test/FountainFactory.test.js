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
const Fountain = artifacts.require('Fountain');
const FountainFactory = artifacts.require('FountainFactory');
const SimpleToken = artifacts.require('SimpleToken');

contract('Fountain factory', function([_, user]) {
  beforeEach(async function() {
    this.manager = await Manager.new();
    const angelFactory = await this.manager.angelFactory.call();
    const fountainFactory = await this.manager.fountainFactory.call();
    this.angelFactory = await AngelFactory.at(angelFactory);
    this.fountainFactory = await FountainFactory.at(fountainFactory);
    this.token1 = await SimpleToken.new('Staking', 'STK', ether('1000000000'));
    this.token2 = await SimpleToken.new('Reward', 'RWD', ether('1000000000'));
  });

  describe('Create', function() {
    it('normal', async function() {
      const receipt = await this.fountainFactory.create(this.token1.address);
      const fountainAddress = await this.fountainFactory.fountainOf.call(
        this.token1.address
      );
      expectEvent(receipt, 'Created', { to: fountainAddress });
    });

    it('should revert if existed', async function() {
      await this.fountainFactory.create(this.token1.address);
      await expectRevert(
        this.fountainFactory.create(this.token1.address),
        'fountain existed'
      );
    });
  });

  describe('Is valid', function() {
    it('created by factory', async function() {
      await this.fountainFactory.create(this.token1.address);
      const fountainAddress = await this.fountainFactory.fountainOf.call(
        this.token1.address
      );
      expect(await this.fountainFactory.isValid(fountainAddress)).to.be.true;
    });

    it('not created by factory', async function() {
      const fountain = await Fountain.new(this.token1.address, 'TEST', 'TST');
      expect(await this.fountainFactory.isValid(fountain.address)).to.be.false;
    });
  });

  describe('Fountain of', function() {
    it('normal', async function() {
      let fountainAddress = await this.fountainFactory.fountainOf.call(
        this.token1.address
      );
      expect(fountainAddress).eq(ZERO_ADDRESS);
      await this.fountainFactory.create(this.token1.address);
      fountainAddress = await this.fountainFactory.fountainOf.call(
        this.token1.address
      );
      expect(fountainAddress).not.eq(ZERO_ADDRESS);
    });
  });
});
