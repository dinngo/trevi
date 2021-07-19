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

const Archangel = artifacts.require('Archangel');
const Angel = artifacts.require('Angel');
const AngelFactory = artifacts.require('AngelFactory');
const Fountain = artifacts.require('Fountain');
const FountainFactory = artifacts.require('FountainFactory');
const SimpleToken = artifacts.require('SimpleToken');

contract('Fountain factory', function([_, user, someone]) {
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
      expect(
        await this.fountainFactory.isValid.call(fountainAddress)
      ).to.be.true;
    });

    it('not fountain', async function() {
      expect(await this.fountainFactory.isValid.call(someone)).to.be.false;
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
