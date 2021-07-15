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
const { getCreated, expectEqWithinBps } = require('./helpers/utils');

const { expect } = require('chai');

const Archangel = artifacts.require('Archangel');
const Angel = artifacts.require('Angel');
const AngelFactory = artifacts.require('AngelFactory');
const Fountain = artifacts.require('Fountain');
const FountainFactory = artifacts.require('FountainFactory');
const SimpleToken = artifacts.require('SimpleToken');
const ERC20 = artifacts.require('ERC20');
const RewarderMock = artifacts.require('RewarderMock');
const FlashBorrower = artifacts.require('FlashBorrower');

contract('Angel', function([_, user, rewarder]) {
  beforeEach(async function() {
    this.archangel = await Archangel.new(new BN('9'));
    const angelFactory = await this.archangel.angelFactory.call();
    const fountainFactory = await this.archangel.fountainFactory.call();
    this.angelFactory = await AngelFactory.at(angelFactory);
    this.fountainFactory = await FountainFactory.at(fountainFactory);
    this.stkToken = await SimpleToken.new('Staking', 'STK', ether('1000000'), {
      from: user,
    });
    this.rwdToken = await SimpleToken.new('Reward', 'RWD', ether('1000000'), {
      from: rewarder,
    });
    this.dummy = await SimpleToken.new('Reward', 'RWD', ether('1000000'), {
      from: rewarder,
    });
    // create fountain
    this.fountain = await getCreated(
      await this.fountainFactory.create(this.stkToken.address),
      Fountain
    );
    // create angel
    this.angel = await getCreated(
      await this.angelFactory.create(this.rwdToken.address, { from: rewarder }),
      Angel
    );
    // Make gracePerSecond equals to the given rewardRate
    const now = await latest();
    const rewardDuration = duration.days(2);
    this.rewardEndTime = new BN(now).add(new BN(rewardDuration));
    this.rewardRate = ether('0.01');
    const rewardAmount = this.rewardRate.mul(rewardDuration);
    await this.rwdToken.approve(this.angel.address, rewardAmount, {
      from: rewarder,
    });
    await this.angel.addGraceReward(rewardAmount, this.rewardEndTime, {
      from: rewarder,
    });
    this.rewarder = await RewarderMock.new(
      ether('1'),
      this.dummy.address,
      this.angel.address,
      new BN('0')
    );
  });

  describe('PoolLength', function() {
    it('PoolLength should execute', async function() {
      await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
        from: rewarder,
      });
      expect(await this.angel.poolLength()).to.be.bignumber.eq(new BN('1'));
    });
  });

  describe('Set', function() {
    it('Should emit event LogSetPool', async function() {
      await this.angel.add(
        new BN('10'),
        this.stkToken.address,
        this.rewarder.address,
        { from: rewarder }
      );
      const receipt1 = await this.angel.set(
        new BN('0'),
        new BN('10'),
        this.dummy.address,
        false,
        {
          from: rewarder,
        }
      );
      expectEvent(receipt1, 'LogSetPool', {
        pid: new BN('0'),
        allocPoint: new BN('10'),
        rewarder: this.rewarder.address,
        overwrite: false,
      });
      const receipt2 = await this.angel.set(
        new BN('0'),
        new BN('10'),
        this.dummy.address,
        true,
        {
          from: rewarder,
        }
      );
      expectEvent(receipt2, 'LogSetPool', {
        pid: new BN('0'),
        allocPoint: new BN('10'),
        rewarder: this.dummy.address,
        overwrite: true,
      });
    });

    it('Should revert if invalid pool', async function() {
      await expectRevert(
        this.angel.set(
          new BN('0'),
          new BN('10'),
          this.rewarder.address,
          false,
          {
            from: rewarder,
          }
        ),
        'invalid opcode'
      );
    });

    it('Not owner', async function() {
      await this.angel.add(
        new BN('10'),
        this.stkToken.address,
        this.rewarder.address,
        { from: rewarder }
      );
      await expectRevert(
        this.angel.set(
          new BN('0'),
          new BN('10'),
          this.rewarder.address,
          false,
          {
            from: user,
          }
        ),
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('PendingGrace', function() {
    it('PendingGrace should equal ExpectedGrace', async function() {
      await this.angel.add(
        new BN('10'),
        this.stkToken.address,
        this.rewarder.address,
        { from: rewarder }
      );
      await this.stkToken.approve(this.fountain.address, ether('10'), {
        from: user,
      });
      await this.fountain.joinAngel(this.angel.address, { from: user });
      await this.fountain.deposit(ether('1'), { from: user });
      const timestamp = await latest();
      await increase(seconds(86400));
      await this.angel.updatePool(new BN('0'));
      const timestamp2 = await latest();
      let expectedGrace = this.rewardRate.mul(timestamp2.sub(timestamp));
      let pendingGrace = await this.angel.pendingGrace.call(new BN('0'), user);
      expectEqWithinBps(pendingGrace, expectedGrace);
    });

    it('When time is lastRewardTime', async function() {
      await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
        from: rewarder,
      });
      await this.stkToken.approve(this.fountain.address, ether('10'), {
        from: user,
      });
      await this.fountain.joinAngel(this.angel.address, { from: user });
      await this.fountain.deposit(ether('1'), { from: user });
      const timestamp = await latest();
      await advanceBlockTo((await latestBlock()).add(new BN('3')));
      await this.angel.updatePool(new BN('0'));
      const timestamp2 = await latest();
      let expectedGrace = this.rewardRate.mul(timestamp2.sub(timestamp));
      let pendingGrace = await this.angel.pendingGrace.call(new BN('0'), user);
      expectEqWithinBps(pendingGrace, expectedGrace);
    });

    it('When time is later than endTime', async function() {
      await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
        from: rewarder,
      });
      await this.stkToken.approve(this.fountain.address, ether('10'), {
        from: user,
      });
      await this.fountain.joinAngel(this.angel.address, { from: user });
      await this.fountain.deposit(ether('1'), { from: user });
      const timestamp = await latest();
      await increase(duration.days(10));
      const timestamp2 = this.rewardEndTime;
      await this.angel.updatePool(new BN('0'));
      let expectedGrace = this.rewardRate.mul(timestamp2.sub(timestamp));
      let pendingGrace = await this.angel.pendingGrace.call(new BN('0'), user);
      expectEqWithinBps(pendingGrace, expectedGrace);
    });

    it('When the pool is expired', async function() {
      await increase(duration.days(10));
      await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
        from: rewarder,
      });
      await this.stkToken.approve(this.fountain.address, ether('10'), {
        from: user,
      });
      await this.fountain.joinAngel(this.angel.address, { from: user });
      await this.fountain.deposit(ether('1'), { from: user });
      // const timestamp = await latest();
      await increase(duration.days(1));
      // const timestamp2 = this.rewardEndTime;
      await this.angel.updatePool(new BN('0'));
      let expectedGrace = ether('0');
      let pendingGrace = await this.angel.pendingGrace.call(new BN('0'), user);
      expect(pendingGrace).to.be.bignumber.eq(expectedGrace);
    });

    describe('Reallocate by addGraceReward', function() {
      it('Reallocate after expired', async function() {
        // Allocate and join
        await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
          from: rewarder,
        });
        await this.stkToken.approve(this.fountain.address, ether('10'), {
          from: user,
        });
        await this.fountain.joinAngel(this.angel.address, { from: user });
        await this.fountain.deposit(ether('1'), { from: user });
        const timestamp = await latest();
        await increase(duration.days(10));
        const timestamp2 = this.rewardEndTime;
        await this.angel.updatePool(new BN('0'));
        let expectedGrace = this.rewardRate.mul(timestamp2.sub(timestamp));
        // Re-allocate
        const now = await latest();
        const rewardDuration = duration.days(2);
        const rewardEndTimeTemp = new BN(now).add(new BN(rewardDuration));
        const newRewardRate = ether('0.02');
        const rewardAmount = newRewardRate.mul(rewardDuration);
        await this.rwdToken.approve(this.angel.address, rewardAmount, {
          from: rewarder,
        });
        await this.angel.addGraceReward(rewardAmount, rewardEndTimeTemp, {
          from: rewarder,
        });
        const timestampReallocate = await latest();
        await increase(duration.days(1));
        await this.angel.updatePool(new BN('0'));
        const timestamp3 = await latest();
        let expectedGrace2 = newRewardRate.mul(
          timestamp3.sub(timestampReallocate)
        );
        let pendingGrace = await this.angel.pendingGrace.call(
          new BN('0'),
          user
        );
        expectEqWithinBps(pendingGrace, expectedGrace.add(expectedGrace2));
      });

      it('Reallocate before expired and set later end time', async function() {
        // Allocate and join
        await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
          from: rewarder,
        });
        await this.stkToken.approve(this.fountain.address, ether('10'), {
          from: user,
        });
        await this.fountain.joinAngel(this.angel.address, { from: user });
        await this.fountain.deposit(ether('1'), { from: user });
        const timestamp = await latest();
        await increase(duration.days(1));
        // Re-allocate
        const now = await latest();
        const rewardDuration = duration.days(2);
        const rewardEndTimeReallocate = new BN(now).add(new BN(rewardDuration));
        const rewardAmountReallocate = ether('5000');
        await this.rwdToken.approve(
          this.angel.address,
          rewardAmountReallocate,
          {
            from: rewarder,
          }
        );
        await this.angel.addGraceReward(
          rewardAmountReallocate,
          rewardEndTimeReallocate,
          {
            from: rewarder,
          }
        );
        const timestampReallocate = await latest();
        await increase(duration.days(1));
        await this.angel.updatePool(new BN('0'));
        const timestamp3 = await latest();
        let pendingGrace = await this.angel.pendingGrace.call(
          new BN('0'),
          user
        );
        // Calculate rewards from deposit to reallocate
        let expectedGrace = this.rewardRate.mul(
          timestampReallocate.sub(timestamp)
        );
        // Calculate rewards from reallocate to latest
        const newRewardRate = this.rewardEndTime
          .sub(timestampReallocate)
          .mul(this.rewardRate)
          .add(rewardAmountReallocate)
          .div(rewardDuration);
        let expectedGrace2 = newRewardRate.mul(
          timestamp3.sub(timestampReallocate)
        );
        expectEqWithinBps(pendingGrace, expectedGrace.add(expectedGrace2));
      });

      it('Reallocate before expired and set earlier end time', async function() {
        // Allocate and join
        await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
          from: rewarder,
        });
        await this.stkToken.approve(this.fountain.address, ether('10'), {
          from: user,
        });
        await this.fountain.joinAngel(this.angel.address, { from: user });
        await this.fountain.deposit(ether('1'), { from: user });
        const timestamp = await latest();
        await increase(duration.days(1));
        // Re-allocate
        const reducedDuration = duration.hours(3);
        const rewardEndTimeReallocate = this.rewardEndTime.sub(
          new BN(reducedDuration)
        );
        const rewardAmountReallocate = ether('5000');
        await this.rwdToken.approve(
          this.angel.address,
          rewardAmountReallocate,
          {
            from: rewarder,
          }
        );
        await this.angel.addGraceReward(
          rewardAmountReallocate,
          rewardEndTimeReallocate,
          {
            from: rewarder,
          }
        );
        const timestampReallocate = await latest();
        await increase(duration.hours(1));
        await this.angel.updatePool(new BN('0'));
        const timestamp3 = await latest();
        let pendingGrace = await this.angel.pendingGrace.call(
          new BN('0'),
          user
        );
        // Calculate rewards from deposit to reallocate
        let expectedGrace = this.rewardRate.mul(
          timestampReallocate.sub(timestamp)
        );
        // Calculate rewards from reallocate to latest
        // = leftoverReward + newReward / newDuration
        const newRewardRate = this.rewardRate
          .mul(this.rewardEndTime.sub(timestampReallocate))
          .add(rewardAmountReallocate)
          .div(rewardEndTimeReallocate.sub(timestampReallocate));
        let expectedGrace2 = newRewardRate.mul(
          timestamp3.sub(timestampReallocate)
        );
        expectEqWithinBps(pendingGrace, expectedGrace.add(expectedGrace2));
      });
    });

    describe('Reallocate by setGracePerSecond', function() {
      it('Reallocate after expired', async function() {
        // Allocate and join
        await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
          from: rewarder,
        });
        await this.stkToken.approve(this.fountain.address, ether('10'), {
          from: user,
        });
        await this.fountain.joinAngel(this.angel.address, { from: user });
        await this.fountain.deposit(ether('1'), { from: user });
        const timestamp = await latest();
        await increase(duration.days(10));
        const timestamp2 = this.rewardEndTime;
        await this.angel.updatePool(new BN('0'));
        let expectedGrace = this.rewardRate.mul(timestamp2.sub(timestamp));
        // Re-allocate
        const now = await latest();
        const rewardDuration = duration.days(2);
        const rewardEndTimeTemp = new BN(now).add(new BN(rewardDuration));
        const newRewardRate = ether('0.02');
        const rewardAmount = newRewardRate.mul(rewardDuration);
        await this.rwdToken.approve(this.angel.address, rewardAmount, {
          from: rewarder,
        });
        await this.angel.setGracePerSecond(newRewardRate, rewardEndTimeTemp, {
          from: rewarder,
        });
        const timestampReallocate = await latest();
        await increase(duration.days(1));
        await this.angel.updatePool(new BN('0'));
        const timestamp3 = await latest();
        let expectedGrace2 = newRewardRate.mul(
          timestamp3.sub(timestampReallocate)
        );
        let pendingGrace = await this.angel.pendingGrace.call(
          new BN('0'),
          user
        );
        expectEqWithinBps(pendingGrace, expectedGrace.add(expectedGrace2));
      });

      it('Reallocate before expired with shortage', async function() {
        // Allocate and join
        await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
          from: rewarder,
        });
        await this.stkToken.approve(this.fountain.address, ether('10'), {
          from: user,
        });
        await this.fountain.joinAngel(this.angel.address, { from: user });
        await this.fountain.deposit(ether('1'), { from: user });
        const timestamp = await latest();
        await increase(duration.days(1));
        // Re-allocate
        const now = await latest();
        const rewardDuration = duration.days(2);
        const rewardEndTimeReallocate = new BN(now).add(new BN(rewardDuration));
        const newRewardRate = ether('1'); // 100x
        // shortage = rewardNeeded - leftover
        const rewardShortage = newRewardRate
          .mul(rewardDuration)
          .sub(this.rewardEndTime.sub(now).mul(this.rewardRate));
        await this.rwdToken.approve(this.angel.address, rewardShortage, {
          from: rewarder,
        });
        await this.angel.setGracePerSecond(
          newRewardRate,
          rewardEndTimeReallocate,
          {
            from: rewarder,
          }
        );
        const timestampReallocate = await latest();
        await increase(duration.days(1));
        await this.angel.updatePool(new BN('0'));
        const timestamp3 = await latest();
        let pendingGrace = await this.angel.pendingGrace.call(
          new BN('0'),
          user
        );
        // Calculate rewards from deposit to reallocate
        let expectedGrace = this.rewardRate.mul(
          timestampReallocate.sub(timestamp)
        );
        // Calculate rewards from reallocate to latest
        let expectedGrace2 = newRewardRate.mul(
          timestamp3.sub(timestampReallocate)
        );
        expectEqWithinBps(pendingGrace, expectedGrace.add(expectedGrace2));
      });

      it('Reallocate before expired without shortage', async function() {
        // Allocate and join
        await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
          from: rewarder,
        });
        await this.stkToken.approve(this.fountain.address, ether('10'), {
          from: user,
        });
        await this.fountain.joinAngel(this.angel.address, { from: user });
        await this.fountain.deposit(ether('1'), { from: user });
        const timestamp = await latest();
        await increase(duration.days(1));
        // Re-allocate
        const rewardEndTimeReallocate = this.rewardEndTime; // same endTime
        const newRewardRate = ether('0.001'); // 1/10x
        // No shortage and just set
        await this.angel.setGracePerSecond(
          newRewardRate,
          rewardEndTimeReallocate,
          {
            from: rewarder,
          }
        );
        const timestampReallocate = await latest();
        await increase(duration.hours(10));
        await this.angel.updatePool(new BN('0'));
        const timestamp3 = await latest();
        let pendingGrace = await this.angel.pendingGrace.call(
          new BN('0'),
          user
        );
        // Calculate rewards from deposit to reallocate
        let expectedGrace = this.rewardRate.mul(
          timestampReallocate.sub(timestamp)
        );
        // Calculate rewards from reallocate to latest
        let expectedGrace2 = newRewardRate.mul(
          timestamp3.sub(timestampReallocate)
        );
        expectEqWithinBps(pendingGrace, expectedGrace.add(expectedGrace2));
      });

      it('Set GracePerSecond to 0', async function() {
        // Allocate and join
        await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
          from: rewarder,
        });
        await this.stkToken.approve(this.fountain.address, ether('10'), {
          from: user,
        });
        await this.fountain.joinAngel(this.angel.address, { from: user });
        await this.fountain.deposit(ether('1'), { from: user });
        const timestamp = await latest();
        await increase(duration.days(1));
        // Re-allocate
        const rewardEndTimeReallocate = this.rewardEndTime; // same endTime
        const newRewardRate = ether('0');
        // No shortage and just set
        await this.angel.setGracePerSecond(
          newRewardRate,
          rewardEndTimeReallocate,
          {
            from: rewarder,
          }
        );
        const timestampReallocate = await latest();
        await increase(duration.hours(10));
        await this.angel.updatePool(new BN('0'));
        let pendingGrace = await this.angel.pendingGrace.call(
          new BN('0'),
          user
        );
        // Calculate rewards from deposit to reallocate
        let expectedGrace = this.rewardRate.mul(
          timestampReallocate.sub(timestamp)
        );
        // Calculate rewards from reallocate to latest
        let expectedGrace2 = ether('0');
        expectEqWithinBps(pendingGrace, expectedGrace.add(expectedGrace2));
      });
    });
  });

  describe('AddGraceReward', function() {
    it('Allocate zero amount', async function() {
      const now = await latest();
      const rewardDuration = duration.days(2);
      const rewardEndTimeTemp = new BN(now).add(new BN(rewardDuration));
      await expectRevert(
        this.angel.addGraceReward(ether('0'), rewardEndTimeTemp, {
          from: rewarder,
        }),
        'grace amount should be greater than 0'
      );
    });

    it('End time not later than now', async function() {
      const now = await latest();
      await expectRevert(
        this.angel.addGraceReward(ether('1'), now, { from: rewarder }),
        'end time should be in the future'
      );
    });

    it('Not owner', async function() {
      const now = await latest();
      const rewardDuration = duration.days(2);
      const rewardEndTimeTemp = new BN(now).add(new BN(rewardDuration));
      await expectRevert(
        this.angel.addGraceReward(ether('1'), rewardEndTimeTemp, {
          from: user,
        }),
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('SetGracePerSecond', function() {
    it('Shortage not provide', async function() {
      const now = await latest();
      const rewardDuration = duration.days(2);
      const rewardEndTimeTemp = new BN(now).add(new BN(rewardDuration));
      await expectRevert(
        this.angel.setGracePerSecond(ether('10'), rewardEndTimeTemp, {
          from: rewarder,
        }),
        'TransferFrom failed'
      );
    });

    it('End time not later than now', async function() {
      const now = await latest();
      await expectRevert(
        this.angel.addGraceReward(ether('1'), now, { from: rewarder }),
        'end time should be in the future'
      );
    });

    it('Not owner', async function() {
      const now = await latest();
      const rewardDuration = duration.days(2);
      const rewardEndTimeTemp = new BN(now).add(new BN(rewardDuration));
      await expectRevert(
        this.angel.setGracePerSecond(ether('1'), rewardEndTimeTemp, {
          from: user,
        }),
        'Ownable: caller is not the owner'
      );
    });
  });

  describe('MassUpdatePools', function() {
    it('Should call updatePool', async function() {
      await this.angel.add(10, this.stkToken.address, this.rewarder.address, {
        from: rewarder,
      });
      await advanceBlockTo((await latestBlock()).add(new BN('1')));
      await this.angel.massUpdatePools([0]);
      //expect('updatePool').to.be.calledOnContract(); //not suported by heardhat
      //expect('updatePool').to.be.calledOnContractWith(0); //not suported by heardhat
    });

    it('Updating invalid pools should fail', async function() {
      await expectRevert(
        this.angel.massUpdatePools([0, 10000, 100000]),
        'invalid opcode'
      );
    });
  });

  describe('Add', function() {
    it('Should add pool with reward token multiplier', async function() {
      expectEvent(
        await this.angel.add(
          new BN('10'),
          this.stkToken.address,
          this.rewarder.address,
          {
            from: rewarder,
          }
        ),
        'LogPoolAddition',
        {
          pid: new BN('0'),
          allocPoint: new BN('10'),
          lpToken: this.stkToken.address,
          rewarder: this.rewarder.address,
        }
      );
    });

    it('Not owner', async function() {
      await expectRevert(
        this.angel.add(
          new BN('10'),
          this.stkToken.address,
          this.rewarder.address,
          {
            from: user,
          }
        ),
        'Ownable: caller is not the owner'
      );
    });

    it('Should revert when adding repeat lp token', async function() {
      await this.angel.add(
        new BN('10'),
        this.stkToken.address,
        this.rewarder.address,
        {
          from: rewarder,
        }
      );
      await expectRevert(
        this.angel.add(
          new BN('10'),
          this.stkToken.address,
          this.rewarder.address,
          { from: rewarder }
        ),
        'angel is set'
      );
    });
  });

  describe('UpdatePool', function() {
    it('Should emit event LogUpdatePool', async function() {
      await this.angel.add(
        new BN('10'),
        this.stkToken.address,
        this.rewarder.address,
        {
          from: rewarder,
        }
      );
      await increase(seconds(86400));
      const receipt = await this.angel.updatePool(new BN('0'));
      expectEvent(receipt, 'LogUpdatePool', {
        pid: new BN('0'),
        lastRewardTime: (await this.angel.poolInfo.call(new BN('0')))
          .lastRewardTime,
        lpSupply: await this.stkToken.balanceOf.call(this.angel.address),
        accGracePerShare: (await this.angel.poolInfo.call(new BN('0')))
          .accGracePerShare,
      });
    });
  });

  describe('flashLoan', function() {
    beforeEach(async function() {
      this.borrower = await FlashBorrower.new();
      await this.archangel.setFlashLoanFee(this.angel.address, new BN('100'));
    });

    it('normal', async function() {
      const fee = ether('1');
      const multiplier = new BN('100');
      const collector = this.archangel.address;
      await this.rwdToken.transfer(user, fee, { from: rewarder });
      await this.rwdToken.approve(this.borrower.address, fee, { from: user });
      const tokenUserBefore = await this.rwdToken.balanceOf.call(user);
      const tokenLenderBefore = await this.rwdToken.balanceOf.call(
        this.angel.address
      );
      const tokenCollectorBefore = await this.rwdToken.balanceOf.call(
        collector
      );
      await this.borrower.go(
        this.angel.address,
        this.rwdToken.address,
        fee,
        multiplier,
        {
          from: user,
        }
      );
      const tokenUserAfter = await this.rwdToken.balanceOf.call(user);
      const tokenLenderAfter = await this.rwdToken.balanceOf.call(
        this.angel.address
      );
      const tokenCollectorAfter = await this.rwdToken.balanceOf.call(collector);
      expect(tokenUserAfter.sub(tokenUserBefore)).to.be.bignumber.eq(
        ether('0').sub(fee)
      );
      expect(tokenLenderAfter.sub(tokenLenderBefore)).to.be.bignumber.eq(
        ether('0')
      );
      expect(tokenCollectorAfter.sub(tokenCollectorBefore)).to.be.bignumber.eq(
        fee
      );
    });

    it('different token', async function() {
      const fee = ether('1');
      const multiplier = new BN('100');
      const collector = this.archangel.address;
      const token = await SimpleToken.new('Token', 'TKN', ether('10000'));
      await token.transfer(user, fee);
      await token.approve(this.borrower.address, fee, {
        from: user,
      });
      await expectRevert(
        this.borrower.go(this.angel.address, token.address, fee, multiplier, {
          from: user,
        }),
        'wrong token'
      );
    });

    it('insufficient fee', async function() {
      const fee = ether('1');
      const multiplier = new BN('1000');
      const collector = this.archangel.address;
      await this.rwdToken.transfer(user, fee, { from: rewarder });
      await this.rwdToken.approve(this.borrower.address, fee, {
        from: user,
      });
      await expectRevert(
        this.borrower.go(
          this.angel.address,
          this.rwdToken.address,
          fee,
          multiplier,
          {
            from: user,
          }
        ),
        'transfer amount exceeds balance'
      );
    });
  });

  describe('Fountain only functions', function() {
    beforeEach(async function() {
      await this.angel.add(
        new BN('10'),
        this.stkToken.address,
        this.rewarder.address,
        {
          from: rewarder,
        }
      );
    });

    it('Deposit', async function() {
      await expectRevert(
        this.angel.deposit(new BN('0'), ether('1'), user),
        'not called by correct fountain'
      );
    });

    it('Withdraw', async function() {
      await expectRevert(
        this.angel.withdraw(new BN('0'), ether('1'), user),
        'not called by correct fountain'
      );
    });

    it('Harvest', async function() {
      await expectRevert(
        this.angel.harvest(new BN('0'), user, user),
        'not called by correct fountain'
      );
    });

    it('Emergency Withdraw', async function() {
      await expectRevert(
        this.angel.emergencyWithdraw(new BN('0'), user),
        'not called by correct fountain'
      );
    });
  });

  describe('Rescue token', function() {
    const amount = ether('0.1');
    beforeEach(async function() {
      await this.dummy.transfer(this.angel.address, amount, { from: rewarder });
      await this.rwdToken.transfer(this.angel.address, amount, {
        from: rewarder,
      });
    });

    it('normal', async function() {
      const tokenUser = await this.dummy.balanceOf.call(user);
      await this.angel.rescueERC20(this.dummy.address, user, {
        from: rewarder,
      });
      expect(await this.dummy.balanceOf.call(user)).to.be.bignumber.eq(
        tokenUser.add(amount)
      );
    });

    it('rescue reward', async function() {
      await expectRevert(
        this.angel.rescueERC20(this.rwdToken.address, user, {
          from: rewarder,
        }),
        'cannot rescue reward token'
      );
    });

    it('from not owner', async function() {
      await expectRevert(
        this.angel.rescueERC20(this.dummy.address, user),
        'caller is not the owner'
      );
    });
  });
});
