const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { advanceBlockTo, duration, increase, latest, latestBlock } = time;
const { seconds } = duration;
const { tracker } = balance;
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const utils = web3.utils;
const { getCreated } = require('./helpers/utils');

const { expect } = require('chai');

const Manager = artifacts.require('Manager');
const MiniChef = artifacts.require('MiniChefV2');
const ChefFactory = artifacts.require('ChefFactory');
const Fridge = artifacts.require('Fridge');
const FridgeFactory = artifacts.require('FridgeFactory');
const SimpleToken = artifacts.require('SimpleToken');
const ERC20 = artifacts.require('ERC20');
const RewarderMock = artifacts.require('RewarderMock');

contract('MiniChefV2', function([_, user, rewarder]) {
  beforeEach(async function() {
    this.manager = await Manager.new();
    const chefFactory = await this.manager.chefFactory.call();
    const fridgeFactory = await this.manager.fridgeFactory.call();
    this.chefFactory = await ChefFactory.at(chefFactory);
    this.fridgeFactory = await FridgeFactory.at(fridgeFactory);
    this.stkToken = await SimpleToken.new('Staking', 'STK', ether('1000000'), {
      from: user,
    });
    this.rwdToken = await SimpleToken.new('Reward', 'RWD', ether('1000000'), {
      from: rewarder,
    });
    this.dummy = await SimpleToken.new('Reward', 'RWD', ether('1000000'), {
      from: rewarder,
    });
    // create fridge
    this.fridge = await getCreated(
      await this.fridgeFactory.create(this.stkToken.address),
      Fridge
    );
    // create chef
    this.chef = await getCreated(
      await this.chefFactory.create(this.rwdToken.address, { from: rewarder }),
      MiniChef
    );
    await this.chef.setSushiPerSecond(ether('0.01'), { from: rewarder });
    await this.rwdToken.transfer(this.chef.address, ether('5000'), {
      from: rewarder,
    });
    this.rewarder = await RewarderMock.new(
      new BN('1'),
      this.dummy.address,
      this.chef.address
    );
  });

  describe('PoolLength', function() {
    it('PoolLength should execute', async function() {
      await this.chef.add(10, this.stkToken.address, this.rewarder.address, {
        from: rewarder,
      });
      expect(await this.chef.poolLength()).to.be.bignumber.eq(new BN('2'));
    });
  });

  describe('Set', function() {
    it('Should emit event LogSetPool', async function() {
      await this.chef.add(
        new BN('10'),
        this.stkToken.address,
        this.rewarder.address,
        { from: rewarder }
      );
      const receipt1 = await this.chef.set(
        new BN('1'),
        new BN('10'),
        this.dummy.address,
        false,
        {
          from: rewarder,
        }
      );
      expectEvent(receipt1, 'LogSetPool', {
        pid: new BN('1'),
        allocPoint: new BN('10'),
        rewarder: this.rewarder.address,
        overwrite: false,
      });
      const receipt2 = await this.chef.set(
        new BN('1'),
        new BN('10'),
        this.dummy.address,
        true,
        {
          from: rewarder,
        }
      );
      expectEvent(receipt2, 'LogSetPool', {
        pid: new BN('1'),
        allocPoint: new BN('10'),
        rewarder: this.dummy.address,
        overwrite: true,
      });
    });

    it('Should revert if invalid pool', async function() {
      await expectRevert(
        this.chef.set(new BN('1'), new BN('10'), this.rewarder.address, false, {
          from: rewarder,
        }),
        'invalid opcode'
      );
    });
  });

  describe('PendingSushi', function() {
    it('PendingSushi should equal ExpectedSushi', async function() {
      await this.chef.add(
        new BN('10'),
        this.stkToken.address,
        this.rewarder.address,
        { from: rewarder }
      );
      await this.stkToken.approve(this.fridge.address, new BN('10'), {
        from: user,
      });
      await this.fridge.joinChef(this.chef.address, { from: user });
      const timestamp = await latest();
      await this.fridge.deposit(new BN('1'), { from: user });
      await increase(seconds(86400));
      const timestamp2 = await latest();
      await this.chef.updatePool(new BN('1'));
      let expectedSushi = new BN('10000000000000000').mul(
        timestamp2.sub(timestamp)
      );
      let pendingSushi = await this.chef.pendingSushi.call(new BN('1'), user);
      expect(pendingSushi).to.be.bignumber.gte(expectedSushi);
    });

    it('When time is lastRewardTime', async function() {
      await this.chef.add(10, this.stkToken.address, this.rewarder.address, {
        from: rewarder,
      });
      await this.stkToken.approve(this.fridge.address, new BN('10'), {
        from: user,
      });
      await this.fridge.joinChef(this.chef.address, { from: user });
      const timestamp = await latest();
      await this.fridge.deposit(new BN('1'), { from: user });
      await advanceBlockTo((await latestBlock()).add(new BN('3')));
      const timestamp2 = await latest();
      await this.chef.updatePool(new BN('1'));
      let expectedSushi = new BN('10000000000000000').mul(
        timestamp2.sub(timestamp)
      );
      let pendingSushi = await this.chef.pendingSushi.call(new BN('1'), user);
      expect(pendingSushi).to.be.bignumber.gte(expectedSushi);
    });
  });

  describe('MassUpdatePools', function() {
    it('Should call updatePool', async function() {
      await this.chef.add(10, this.stkToken.address, this.rewarder.address, {
        from: rewarder,
      });
      await advanceBlockTo((await latestBlock()).add(new BN('1')));
      await this.chef.massUpdatePools([1]);
      //expect('updatePool').to.be.calledOnContract(); //not suported by heardhat
      //expect('updatePool').to.be.calledOnContractWith(0); //not suported by heardhat
    });

    it('Updating invalid pools should fail', async function() {
      await expectRevert(
        this.chef.massUpdatePools([0, 10000, 100000]),
        'invalid opcode'
      );
    });
  });

  describe('Add', function() {
    it('Should add pool with reward token multiplier', async function() {
      expectEvent(
        await this.chef.add(
          new BN('10'),
          this.stkToken.address,
          this.rewarder.address,
          {
            from: rewarder,
          }
        ),
        'LogPoolAddition',
        {
          pid: new BN('1'),
          allocPoint: new BN('10'),
          lpToken: this.stkToken.address,
          rewarder: this.rewarder.address,
        }
      );
    });
  });

  describe('UpdatePool', function() {
    it('Should emit event LogUpdatePool', async function() {
      await this.chef.add(
        new BN('10'),
        this.stkToken.address,
        this.rewarder.address,
        {
          from: rewarder,
        }
      );
      await increase(seconds(86400));
      const receipt = await this.chef.updatePool(new BN('1'));
      expectEvent(receipt, 'LogUpdatePool', {
        pid: new BN('1'),
        lastRewardTime: (await this.chef.poolInfo.call(new BN('1')))
          .lastRewardTime,
        lpSupply: await this.stkToken.balanceOf.call(this.chef.address),
        accSushiPerShare: (await this.chef.poolInfo.call(new BN('1')))
          .accSushiPerShare,
      });
    });
  });
});
