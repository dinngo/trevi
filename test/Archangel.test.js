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

contract('Archangel', function([_, user, owner]) {
  beforeEach(async function() {
    this.archangel = await Archangel.new({ from: owner });
    const angelFactory = await this.archangel.angelFactory.call();
    const fountainFactory = await this.archangel.fountainFactory.call();
    this.angelFactory = await AngelFactory.at(angelFactory);
    this.fountainFactory = await FountainFactory.at(fountainFactory);
    this.token1 = await SimpleToken.new('Staking', 'STK', ether('1000000000'));
    this.token2 = await SimpleToken.new('Reward', 'RWD', ether('1000000000'));
  });

  describe('Get fountain', function() {
    beforeEach(async function() {
      await this.fountainFactory.create(this.token1.address);
    });

    it('created', async function() {
      expect(
        await this.archangel.getFountain.call(this.token1.address)
      ).to.not.equal(ZERO_ADDRESS);
    });

    it('not created', async function() {
      expect(await this.archangel.getFountain.call(this.token2.address)).equal(
        ZERO_ADDRESS
      );
    });
  });

  describe('Set fee', function() {
    beforeEach(async function() {
      this.fountain = await getCreated(
        await this.fountainFactory.create(this.token1.address),
        Fountain
      );
      this.angel = await getCreated(
        await this.angelFactory.create(this.token2.address),
        Angel
      );
    });

    it('from owner', async function() {
      const feeRate = new BN('50');
      await this.archangel.setFee(this.fountain.address, feeRate, {
        from: owner,
      });
      await this.archangel.setFee(this.angel.address, feeRate, { from: owner });
      expect(await this.fountain.feeRate.call()).to.be.bignumber.eq(feeRate);
      expect(await this.angel.feeRate.call()).to.be.bignumber.eq(feeRate);
    });

    it('not from owner', async function() {
      const feeRate = new BN('50');
      await expectRevert(
        this.archangel.setFee(this.fountain.address, feeRate),
        'caller is not the owner'
      );
    });

    it('rate exceeded', async function() {
      const feeRate = new BN('50000');
      await expectRevert(
        this.archangel.setFee(this.fountain.address, feeRate, {
          from: owner,
        }),
        'rate exceeded'
      );
    });
  });
});
