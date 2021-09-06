const {
  balance,
  BN,
  constants,
  ether,
  expectEvent,
  expectRevert,
  time,
} = require('@openzeppelin/test-helpers');
const { tracker } = balance;
const { ZERO_ADDRESS, MAX_UINT256 } = constants;
const { duration, increase, latest } = time;
const { seconds } = duration;
const utils = web3.utils;
const ethSigUtil = require('eth-sig-util');
const { fromRpcSig } = require('ethereumjs-util');
const { EIP712Domain, domainSeparator } = require('./helpers/eip712');
const { getCreated, getMnemonicPrivateKey } = require('./helpers/utils');

const { expect } = require('chai');

const Archangel = artifacts.require('Archangel');
const Angel = artifacts.require('Angel');
const AngelFactory = artifacts.require('AngelFactory');
const Fountain = artifacts.require('Fountain');
const FountainFactory = artifacts.require('FountainFactory');
const SimpleToken = artifacts.require('SimpleToken');
const DeflatingToken = artifacts.require('DeflatingToken');
const Rewarder = artifacts.require('RewarderMock');
const FlashBorrower = artifacts.require('FlashBorrower');

const Permit = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];

const HarvestPermit = [
  { name: 'owner', type: 'address' },
  { name: 'sender', type: 'address' },
  { name: 'timeLimit', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];

const JoinPermit = [
  { name: 'user', type: 'address' },
  { name: 'sender', type: 'address' },
  { name: 'timeLimit', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];

contract('Fountain', function([_, user, someone, rewarder, owner]) {
  beforeEach(async function() {
    this.archangel = await Archangel.new(new BN('9'), { from: owner });
    const angelFactory = await this.archangel.angelFactory.call();
    const fountainFactory = await this.archangel.fountainFactory.call();
    this.angelFactory = await AngelFactory.at(angelFactory);
    this.fountainFactory = await FountainFactory.at(fountainFactory);
    this.stkToken = await SimpleToken.new('Staking', 'STK', ether('10000'), {
      from: user,
    });
    this.dflToken = await DeflatingToken.new(
      'Deflating',
      'DFL',
      ether('10000'),
      {
        from: user,
      }
    );
    this.rwdToken1 = await SimpleToken.new('Reward', 'RWD', ether('1000000'), {
      from: rewarder,
    });
    this.rwdToken2 = await SimpleToken.new('Reward', 'RWD', ether('1000000'), {
      from: rewarder,
    });
  });

  describe('by angel', function() {
    beforeEach(async function() {
      const receipt = await this.angelFactory.create(this.rwdToken1.address, {
        from: rewarder,
      });
      // Get angel through event log
      this.angel = await getCreated(receipt, Angel);
      expect(await this.angelFactory.isValid(this.angel.address)).to.be.true;
    });

    describe('set pid', function() {
      beforeEach(async function() {
        // create fountain
        const receipt = await this.fountainFactory.create(
          this.stkToken.address
        );
        this.fountain = await getCreated(receipt, Fountain);
      });

      it('normal', async function() {
        // add from Angel
        await this.angel.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // check at fountain
        const info = await this.fountain.angelInfo.call(this.angel.address);
        expect(info[0]).to.be.bignumber.eq(new BN('0'));
        expect(info[1]).to.be.bignumber.eq(new BN('0'));
      });

      it('from invalid angel', async function() {
        // add from invalid angel
      });

      it('not from fountain', async function() {
        // set pid direct
        await expectRevert.unspecified(this.fountain.setPoolId(new BN('0')));
      });
    });
  });

  describe('by user', function() {
    beforeEach(async function() {
      // Get angel
      let receipt = await this.angelFactory.create(this.rwdToken1.address, {
        from: rewarder,
      });
      this.angel1 = await getCreated(receipt, Angel);
      receipt = await this.angelFactory.create(this.rwdToken2.address, {
        from: rewarder,
      });
      this.angel2 = await getCreated(receipt, Angel);
      const endTime = (await latest()).add(duration.days(1));
      // Setup angel1
      await this.rwdToken1.approve(this.angel1.address, MAX_UINT256, {
        from: rewarder,
      });
      await this.angel1.setGracePerSecond(ether('0.01'), endTime, {
        from: rewarder,
      });
      // Setup angel2
      await this.rwdToken2.approve(this.angel2.address, MAX_UINT256, {
        from: rewarder,
      });
      await this.angel2.setGracePerSecond(ether('0.01'), endTime, {
        from: rewarder,
      });
      // Get fountain
      receipt = await this.fountainFactory.create(this.stkToken.address);
      this.fountain = await getCreated(receipt, Fountain);
      // Get fountain
      receipt = await this.fountainFactory.create(this.dflToken.address);
      this.dflFountain = await getCreated(receipt, Fountain);
      // Get Rewarder
      this.rewarder = await Rewarder.new(
        ether('1'),
        this.rwdToken2.address,
        this.angel1.address,
        new BN('0')
      );
      // Get Bad Rewarder
      this.badRewarder = await Rewarder.new(
        ether('1'),
        this.rwdToken2.address,
        this.angel1.address,
        new BN('1')
      );
      // Get Gas Monster Rewarder
      this.gasRewarder = await Rewarder.new(
        ether('1'),
        this.rwdToken2.address,
        this.angel1.address,
        new BN('2')
      );
    });

    describe('join angel', function() {
      it('normal', async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // user join angel from fountain
        const receipt = await this.fountain.joinAngel(this.angel1.address, {
          from: user,
        });
        expectEvent(receipt, 'Join', {
          user: user,
          angel: this.angel1.address,
        });
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Deposit',
          [user, new BN('0'), new BN('0'), user]
        );
        const angels = await this.fountain.joinedAngel.call(user);
        expect(angels[0]).eq(this.angel1.address);
      });

      it('multiple angels', async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // Add from Angel
        await this.angel2.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // user join angel from fountain
        const receipt = await this.fountain.joinAngels(
          [this.angel1.address, this.angel2.address],
          {
            from: user,
          }
        );
        expectEvent(receipt, 'Join', {
          user: user,
          angel: this.angel1.address,
        });
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Deposit',
          [user, new BN('0'), new BN('0'), user]
        );
        expectEvent(receipt, 'Join', {
          user: user,
          angel: this.angel2.address,
        });
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel2,
          'Deposit',
          [user, new BN('0'), new BN('0'), user]
        );
        const angels = await this.fountain.joinedAngel.call(user);
        expect(angels[0]).eq(this.angel1.address);
        expect(angels[1]).eq(this.angel2.address);
      });

      it('Not added from angel', async function() {
        // user join angel from fountain
        await expectRevert(
          this.fountain.joinAngel(this.angel1.address, {
            from: user,
          }),
          'not added by angel'
        );
      });

      describe('join for', async function() {
        beforeEach(async function() {
          // Add from Angel
          await this.angel1.add(
            new BN('10'),
            this.stkToken.address,
            ZERO_ADDRESS,
            { from: rewarder }
          );
          // Add from Angel
          await this.angel2.add(
            new BN('10'),
            this.stkToken.address,
            ZERO_ADDRESS,
            { from: rewarder }
          );
          const timeLimit = (await latest()).add(seconds(86400));
          await this.fountain.joinApprove(someone, timeLimit, {
            from: user,
          });
        });

        it('join single for', async function() {
          // someone join angel for user from fountain
          const receipt = await this.fountain.joinAngelFor(
            this.angel1.address,
            user,
            {
              from: someone,
            }
          );
          expectEvent(receipt, 'Join', {
            user: user,
            angel: this.angel1.address,
          });
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel1,
            'Deposit',
            [user, new BN('0'), new BN('0'), user]
          );
          const angels = await this.fountain.joinedAngel.call(user);
          expect(angels[0]).eq(this.angel1.address);
        });

        it('join multiple for', async function() {
          // someone join angel for user from fountain
          const receipt = await this.fountain.joinAngelsFor(
            [this.angel1.address, this.angel2.address],
            user,
            {
              from: someone,
            }
          );
          expectEvent(receipt, 'Join', {
            user: user,
            angel: this.angel1.address,
          });
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel1,
            'Deposit',
            [user, new BN('0'), new BN('0'), user]
          );
          expectEvent(receipt, 'Join', {
            user: user,
            angel: this.angel2.address,
          });
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel2,
            'Deposit',
            [user, new BN('0'), new BN('0'), user]
          );
          const angels = await this.fountain.joinedAngel.call(user);
          expect(angels[0]).eq(this.angel1.address);
          expect(angels[1]).eq(this.angel2.address);
        });
      });

      describe('join permit', async function() {
        it('normal', async function() {
          const name = await this.fountain.name.call();
          const version = '1';
          const chainId = await web3.eth.getChainId();
          const verifyingContract = this.fountain.address;
          const sender = someone;
          const timeLimit = (await latest()).add(seconds(300));
          const nonce = 0;
          const deadline = MAX_UINT256;
          const data = {
            primaryType: 'JoinPermit',
            types: { EIP712Domain, JoinPermit },
            domain: { name, version, chainId, verifyingContract },
            message: { user, sender, timeLimit, nonce, deadline },
          };
          const signature = ethSigUtil.signTypedMessage(
            getMnemonicPrivateKey(user),
            {
              data,
            }
          );
          const { v, r, s } = fromRpcSig(signature);
          const receipt = await this.fountain.joinPermit(
            user,
            sender,
            timeLimit,
            deadline,
            v,
            r,
            s
          );
          expectEvent(receipt, 'JoinApproval', [user]);
          expect(await this.fountain.joinNonces(user)).to.be.bignumber.eq('1');
          expect(
            await this.fountain.joinTimeLimit.call(user, sender)
          ).to.be.bignumber.eq(timeLimit);
        });
      });

      describe('join for with one-time permit', async function() {
        const sender = someone;
        const timeLimit = new BN('1');
        const deadline = MAX_UINT256;
        let data;
        let signature;

        beforeEach(async function() {
          // Add from Angel
          await this.angel1.add(
            new BN('10'),
            this.stkToken.address,
            ZERO_ADDRESS,
            { from: rewarder }
          );
          // Add from Angel
          await this.angel2.add(
            new BN('10'),
            this.stkToken.address,
            ZERO_ADDRESS,
            { from: rewarder }
          );
          const name = await this.fountain.name.call();
          const version = '1';
          const chainId = await web3.eth.getChainId();
          const verifyingContract = this.fountain.address;
          const nonce = 0;
          const data = {
            primaryType: 'JoinPermit',
            types: { EIP712Domain, JoinPermit },
            domain: { name, version, chainId, verifyingContract },
            message: { user, sender, timeLimit, nonce, deadline },
          };
          signature = ethSigUtil.signTypedMessage(getMnemonicPrivateKey(user), {
            data,
          });
        });

        it('single', async function() {
          const { v, r, s } = fromRpcSig(signature);
          const receipt = await this.fountain.joinAngelForWithPermit(
            this.angel1.address,
            user,
            timeLimit,
            deadline,
            v,
            r,
            s,
            {
              from: someone,
            }
          );
          expectEvent(receipt, 'Join', [user, this.angel1.address]);
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel1,
            'Deposit',
            [user, new BN('0'), new BN('0'), user]
          );
          const angels = await this.fountain.joinedAngel.call(user);
          expect(angels[0]).eq(this.angel1.address);
          // Should expire next time
          increase(seconds(15));
          await expectRevert(
            this.fountain.joinAngelFor(this.angel2.address, user, {
              from: someone,
            }),
            'join not allowed'
          );
        });

        it('multiple', async function() {
          const { v, r, s } = fromRpcSig(signature);
          const receipt = await this.fountain.joinAngelsForWithPermit(
            [this.angel1.address, this.angel2.address],
            user,
            timeLimit,
            deadline,
            v,
            r,
            s,
            {
              from: someone,
            }
          );
          expectEvent(receipt, 'Join', [user, this.angel1.address]);
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel1,
            'Deposit',
            [user, new BN('0'), new BN('0'), user]
          );
          expectEvent(receipt, 'Join', [user, this.angel2.address]);
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel2,
            'Deposit',
            [user, new BN('0'), new BN('0'), user]
          );
          const angels = await this.fountain.joinedAngel.call(user);
          expect(angels[0]).eq(this.angel1.address);
          expect(angels[1]).eq(this.angel2.address);
        });
      });
    });

    describe('quit angel', function() {
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          {
            from: rewarder,
          }
        );
        // user join angel from fountain
        await this.fountain.joinAngel(this.angel1.address, {
          from: user,
        });
      });

      it('normal', async function() {
        // user quit angel from fountain
        const angelsBefore = await this.fountain.joinedAngel.call(user);
        const receipt = await this.fountain.quitAngel(this.angel1.address, {
          from: user,
        });
        const angelsAfter = await this.fountain.joinedAngel.call(user);
        expectEvent(receipt, 'Quit', {
          user: user,
          angel: this.angel1.address,
        });
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Withdraw',
          [user, new BN('0'), new BN('0'), user]
        );
        expect(angelsAfter.length - angelsBefore.length).to.be.eq(-1);
      });

      it('rage quit', async function() {
        // Set to bad rewarder
        await this.angel1.set(
          new BN('0'),
          new BN('1000'),
          this.badRewarder.address,
          true,
          { from: rewarder }
        );
        await expectRevert(
          this.fountain.quitAngel(this.angel1.address, { from: user }),
          'bad rewarder'
        );
        // user rage quit angel from fountain
        const angelsBefore = await this.fountain.joinedAngel.call(user);
        const receipt = await this.fountain.rageQuitAngel(this.angel1.address, {
          from: user,
        });
        const angelsAfter = await this.fountain.joinedAngel.call(user);
        expectEvent(receipt, 'RageQuit', {
          user: user,
          angel: this.angel1.address,
        });
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'EmergencyWithdraw',
          [user, new BN('0'), new BN('0'), user]
        );
        expect(angelsAfter.length - angelsBefore.length).to.be.eq(-1);
      });

      it('all', async function() {
        // Add from Angel
        await this.angel2.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          {
            from: rewarder,
          }
        );
        // user join angel from fountain
        await this.fountain.joinAngel(this.angel2.address, {
          from: user,
        });
        // user quit angel from fountain
        const angelsBefore = await this.fountain.joinedAngel.call(user);
        const receipt = await this.fountain.quitAllAngel({
          from: user,
        });
        const angelsAfter = await this.fountain.joinedAngel.call(user);
        expectEvent(receipt, 'Quit', {
          user: user,
          angel: this.angel1.address,
        });
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Withdraw',
          [user, new BN('0'), new BN('0'), user]
        );
        expectEvent(receipt, 'Quit', {
          user: user,
          angel: this.angel2.address,
        });
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel2,
          'Withdraw',
          [user, new BN('0'), new BN('0'), user]
        );
        expect(angelsAfter.length - angelsBefore.length).to.be.eq(-2);
      });

      it('unjoined angel', async function() {
        // user quit unjoined angel from fountain
        await expectRevert(
          this.fountain.quitAngel(this.angel2.address, {
            from: user,
          }),
          'unjoined angel'
        );
      });
    });

    describe('deposit', function() {
      const pid = new BN('0');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          {
            from: rewarder,
          }
        );
        await this.angel2.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          {
            from: rewarder,
          }
        );
      });

      it('to sender', async function() {
        const depositAmount = ether('10');
        // join angel
        await this.fountain.joinAngel(this.angel1.address, { from: user });
        // user deposit
        const token1Before = await this.stkToken.balanceOf.call(user);
        await this.stkToken.approve(this.fountain.address, depositAmount, {
          from: user,
        });
        const receipt = await this.fountain.deposit(depositAmount, {
          from: user,
        });
        expectEvent(receipt, 'Deposit', [user, depositAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Deposit',
          [user, pid, depositAmount, user]
        );
        const token1After = await this.stkToken.balanceOf.call(user);
        // check token
        expect(token1After).to.be.bignumber.eq(token1Before.sub(depositAmount));
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        expect(info1[0]).to.be.bignumber.eq(depositAmount);
        // check non-joined angel user balance
        let info2 = await this.angel2.userInfo.call(pid, user);
        expect(info2[0]).to.be.bignumber.eq(ether('0'));
        // join after deposit
        await this.fountain.joinAngel(this.angel2.address, { from: user });
        info2 = await this.angel2.userInfo.call(pid, user);
        expect(info2[0]).to.be.bignumber.eq(depositAmount);
      });

      it('0 amount', async function() {
        const depositAmount = ether('0');
        // join angel
        await this.fountain.joinAngel(this.angel1.address, { from: user });
        // user deposit
        const token1Before = await this.stkToken.balanceOf.call(user);
        await this.stkToken.approve(this.fountain.address, depositAmount, {
          from: user,
        });
        const receipt = await this.fountain.deposit(depositAmount, {
          from: user,
        });
        expectEvent(receipt, 'Deposit', [user, depositAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Deposit',
          [user, pid, depositAmount, user]
        );
        const token1After = await this.stkToken.balanceOf.call(user);
        // check token
        expect(token1After).to.be.bignumber.eq(token1Before.sub(depositAmount));
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        expect(info1[0]).to.be.bignumber.eq(depositAmount);
        // check non-joined angel user balance
        let info2 = await this.angel2.userInfo.call(pid, user);
        expect(info2[0]).to.be.bignumber.eq(ether('0'));
        // join after deposit
        await this.fountain.joinAngel(this.angel2.address, { from: user });
        info2 = await this.angel2.userInfo.call(pid, user);
        expect(info2[0]).to.be.bignumber.eq(depositAmount);
      });

      it('to others', async function() {
        const depositAmount = ether('10');
        // join angel
        await this.fountain.joinAngel(this.angel1.address, { from: someone });
        // user deposit
        const token1Before = await this.stkToken.balanceOf.call(user);
        await this.stkToken.approve(this.fountain.address, depositAmount, {
          from: user,
        });
        const receipt = await this.fountain.depositTo(depositAmount, someone, {
          from: user,
        });
        expectEvent(receipt, 'Deposit', [user, depositAmount, someone]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Deposit',
          [someone, pid, depositAmount, someone]
        );
        const token1UserAfter = await this.stkToken.balanceOf.call(user);
        // check token
        expect(token1UserAfter).to.be.bignumber.eq(
          token1Before.sub(depositAmount)
        );
        // check joined angel user balance
        const info1User = await this.angel1.userInfo.call(pid, user);
        const info1Someone = await this.angel1.userInfo.call(pid, someone);
        expect(info1User[0]).to.be.bignumber.eq(ether('0'));
        expect(info1Someone[0]).to.be.bignumber.eq(depositAmount);
        // check non-joined angel user balance
        let info2User = await this.angel2.userInfo.call(pid, user);
        let info2Someone = await this.angel2.userInfo.call(pid, someone);
        expect(info2User[0]).to.be.bignumber.eq(ether('0'));
        expect(info2Someone[0]).to.be.bignumber.eq(ether('0'));
        // join after deposit
        await this.fountain.joinAngel(this.angel2.address, { from: someone });
        info2User = await this.angel2.userInfo.call(pid, user);
        info2Someone = await this.angel2.userInfo.call(pid, someone);
        expect(info2User[0]).to.be.bignumber.eq(ether('0'));
        expect(info2Someone[0]).to.be.bignumber.eq(depositAmount);
      });
    });

    describe('deposit deflating token', function() {
      const pid = new BN('0');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.dflToken.address,
          ZERO_ADDRESS,
          {
            from: rewarder,
          }
        );
        await this.angel2.add(
          new BN('10'),
          this.dflToken.address,
          ZERO_ADDRESS,
          {
            from: rewarder,
          }
        );
      });

      it('to sender', async function() {
        const depositAmount = ether('10');
        const actualAmount = depositAmount.mul(new BN('99')).div(new BN('100'));
        // join angel
        await this.dflFountain.joinAngel(this.angel1.address, { from: user });
        // user deposit
        const token1Before = await this.dflToken.balanceOf.call(user);
        const ftnBefore = await this.dflFountain.balanceOf.call(user);
        await this.dflToken.approve(this.dflFountain.address, depositAmount, {
          from: user,
        });
        const receipt = await this.dflFountain.deposit(depositAmount, {
          from: user,
        });
        expectEvent(receipt, 'Deposit', [user, actualAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Deposit',
          [user, pid, actualAmount, user]
        );
        const token1After = await this.dflToken.balanceOf.call(user);
        const ftnAfter = await this.dflFountain.balanceOf.call(user);
        // check token
        expect(token1After).to.be.bignumber.eq(token1Before.sub(depositAmount));
        expect(ftnAfter).to.be.bignumber.eq(ftnBefore.add(actualAmount));
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        expect(info1[0]).to.be.bignumber.eq(actualAmount);
        // check non-joined angel user balance
        let info2 = await this.angel2.userInfo.call(pid, user);
        expect(info2[0]).to.be.bignumber.eq(ether('0'));
        // join after deposit
        await this.dflFountain.joinAngel(this.angel2.address, { from: user });
        info2 = await this.angel2.userInfo.call(pid, user);
        expect(info2[0]).to.be.bignumber.eq(actualAmount);
      });
    });

    describe('withdraw', function() {
      const depositAmount = ether('10');
      const pid = new BN('0');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          {
            from: rewarder,
          }
        );
        // join angel
        await this.fountain.joinAngel(this.angel1.address, { from: user });
        // user deposit
        await this.stkToken.approve(this.fountain.address, depositAmount, {
          from: user,
        });
        await this.fountain.deposit(depositAmount, { from: user });
        await increase(seconds(300));
      });

      it('normal', async function() {
        // check joined angel user balance
        const info1Before = await this.angel1.userInfo.call(pid, user);
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const stkTokenUser = await this.stkToken.balanceOf.call(user);
        // user withdraw
        const receipt = await this.fountain.withdraw(depositAmount, {
          from: user,
        });
        expectEvent(receipt, 'Withdraw', [user, depositAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Withdraw',
          [user, pid, depositAmount, user]
        );
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingGrace.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(ether('0').sub(info1[1])).to.be.bignumber.gte(pendingBefore);
        expect(pending).to.be.bignumber.gte(pendingBefore);
        expect(await this.stkToken.balanceOf.call(user)).to.be.bignumber.eq(
          stkTokenUser.add(depositAmount)
        );
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });

      it('to others', async function() {
        // check joined angel user balance
        const info1Before = await this.angel1.userInfo.call(pid, user);
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        // user withdraw
        const receipt = await this.fountain.withdrawTo(depositAmount, someone, {
          from: user,
        });
        expectEvent(receipt, 'Withdraw', [user, depositAmount, someone]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Withdraw',
          [user, pid, depositAmount, user]
        );
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingGrace.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(ether('0').sub(info1[1])).to.be.bignumber.gte(pendingBefore);
        expect(pending).to.be.bignumber.gte(pendingBefore);
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
        expect(await this.stkToken.balanceOf.call(someone)).to.be.bignumber.eq(
          depositAmount
        );
      });

      it('max', async function() {
        // check joined angel user balance
        const info1Before = await this.angel1.userInfo.call(pid, user);
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const stkTokenUser = await this.stkToken.balanceOf.call(user);
        // user withdraw
        const receipt = await this.fountain.withdraw(MAX_UINT256, {
          from: user,
        });
        expectEvent(receipt, 'Withdraw', [user, depositAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Withdraw',
          [user, pid, depositAmount, user]
        );
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingGrace.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(ether('0').sub(info1[1])).to.be.bignumber.gte(pendingBefore);
        expect(pending).to.be.bignumber.gte(pendingBefore);
        expect(await this.stkToken.balanceOf.call(user)).to.be.bignumber.eq(
          stkTokenUser.add(depositAmount)
        );
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });

      it('0 amount', async function() {
        // check joined angel user balance
        const info1Before = await this.angel1.userInfo.call(pid, user);
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const stkTokenUser = await this.stkToken.balanceOf.call(user);
        // user withdraw
        const receipt = await this.fountain.withdraw(ether('0'), {
          from: user,
        });
        expectEvent(receipt, 'Withdraw', [user, ether('0'), user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Withdraw',
          [user, pid, new BN('0'), user]
        );
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingGrace.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(depositAmount);
        expect(ether('0').sub(info1[1])).to.be.bignumber.gte(ether('0'));
        expect(pending).to.be.bignumber.gte(pendingBefore);
        expect(await this.stkToken.balanceOf.call(user)).to.be.bignumber.eq(
          stkTokenUser
        );
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });
    });

    describe('withdraw deflating token', function() {
      const depositAmount = ether('10');
      const actualAmount = depositAmount.mul(new BN('99')).div(new BN('100'));
      const withdrawAmount = actualAmount.mul(new BN('99')).div(new BN('100'));
      const pid = new BN('0');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.dflToken.address,
          ZERO_ADDRESS,
          {
            from: rewarder,
          }
        );
        // join angel
        await this.dflFountain.joinAngel(this.angel1.address, { from: user });
        // user deposit
        await this.dflToken.approve(this.dflFountain.address, depositAmount, {
          from: user,
        });
        await this.dflFountain.deposit(depositAmount, { from: user });
        await increase(seconds(300));
      });

      it('normal', async function() {
        // check joined angel user balance
        const info1Before = await this.angel1.userInfo.call(pid, user);
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const dflTokenUser = await this.dflToken.balanceOf.call(user);
        // user withdraw
        const receipt = await this.dflFountain.withdraw(actualAmount, {
          from: user,
        });
        expectEvent(receipt, 'Withdraw', [user, actualAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Withdraw',
          [user, pid, actualAmount, user]
        );
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingGrace.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(ether('0').sub(info1[1])).to.be.bignumber.gte(pendingBefore);
        expect(pending).to.be.bignumber.gte(pendingBefore);
        expect(await this.dflToken.balanceOf.call(user)).to.be.bignumber.eq(
          dflTokenUser.add(withdrawAmount)
        );
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });

      it('max', async function() {
        // check joined angel user balance
        const info1Before = await this.angel1.userInfo.call(pid, user);
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const dflTokenUser = await this.dflToken.balanceOf.call(user);
        // user withdraw
        const receipt = await this.dflFountain.withdraw(MAX_UINT256, {
          from: user,
        });
        expectEvent(receipt, 'Withdraw', [user, actualAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Withdraw',
          [user, pid, actualAmount, user]
        );
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingGrace.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(ether('0').sub(info1[1])).to.be.bignumber.gte(pendingBefore);
        expect(pending).to.be.bignumber.gte(pendingBefore);
        expect(await this.dflToken.balanceOf.call(user)).to.be.bignumber.eq(
          dflTokenUser.add(withdrawAmount)
        );
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });
    });

    describe.only('harvest', function() {
      const depositAmount = ether('10');
      const pid = new BN('0');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          {
            from: rewarder,
          }
        );
        await this.angel2.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          {
            from: rewarder,
          }
        );
        // join angel1
        await this.fountain.joinAngel(this.angel1.address, { from: user });
        // user deposit
        await this.stkToken.approve(this.fountain.address, depositAmount, {
          from: user,
        });
        await this.fountain.deposit(depositAmount, { from: user });
        await increase(seconds(300));
      });

      it('harvest joined', async function() {
        // user harvest angel1
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const receipt = await this.fountain.harvest(this.angel1.address, {
          from: user,
        });
        expectEvent(receipt, 'Harvest', [user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Harvest',
          [user, pid]
        );
        const info1After = await this.angel1.userInfo.call(pid, user);
        const pendingAfter = await this.angel1.pendingGrace.call(pid, user);
        const tokenUser = await this.rwdToken1.balanceOf.call(user);
        expect(pendingAfter).to.be.bignumber.eq(ether('0'));
        expect(info1After[1]).to.be.bignumber.eq(tokenUser);
        expect(tokenUser).to.be.bignumber.gte(pendingBefore);
        // harvest empty should be fine
        await this.fountain.harvest(this.angel1.address, {
          from: user,
        });
      });

      it('harvest non-joined', async function() {
        // user harvest angel2
        const pendingBefore = await this.angel2.pendingGrace.call(pid, user);
        const receipt = await this.fountain.harvest(this.angel2.address, {
          from: user,
        });
        expectEvent(receipt, 'Harvest', [user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel2,
          'Harvest',
          [user, pid, new BN('0')]
        );
        const tokenUser = await this.rwdToken2.balanceOf.call(user);
        expect(pendingBefore).to.be.bignumber.eq(ether('0'));
        expect(tokenUser).to.be.bignumber.eq(ether('0'));
      });

      it('harvest all', async function() {
        // user harvest all
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const receipt = await this.fountain.harvestAll({ from: user });
        expectEvent(receipt, 'Harvest', [user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Harvest',
          [user, pid]
        );
        const info1After = await this.angel1.userInfo.call(pid, user);
        const pendingAfter = await this.angel1.pendingGrace.call(pid, user);
        const tokenUser = await this.rwdToken1.balanceOf.call(user);
        expect(pendingAfter).to.be.bignumber.eq(ether('0'));
        expect(info1After[1]).to.be.bignumber.eq(tokenUser);
        expect(tokenUser).to.be.bignumber.gte(pendingBefore);
      });

      it('harvest with reward contract', async function() {
        await this.rwdToken2.transfer(this.rewarder.address, ether('100000'), {
          from: rewarder,
        });
        await this.angel1.set(pid, new BN('10'), this.rewarder.address, true, {
          from: rewarder,
        });
        await this.stkToken.transfer(someone, ether('10'), { from: user });
        await this.stkToken.approve(this.fountain.address, ether('10'), {
          from: someone,
        });
        await this.fountain.joinAngel(this.angel1.address, { from: someone });
        await this.fountain.deposit(ether('1'), { from: someone });
        expect(await this.angel1.lpToken.call(new BN('0'))).to.be.equal(
          this.stkToken.address
        );
        await increase(seconds(86400));
        await this.fountain.withdraw(ether('1'), { from: someone });
        let expectedReward = await this.angel1.pendingGrace.call(pid, someone);
        expect((await this.angel1.userInfo(0, someone))[1]).to.be.bignumber.eq(
          ether('0').sub(expectedReward)
        );
        const receipt = await this.fountain.harvest(this.angel1.address, {
          from: someone,
        });
        expect(await this.rwdToken1.balanceOf.call(someone))
          .to.be.bignumber.eq(await this.rwdToken2.balanceOf.call(someone))
          .to.be.bignumber.eq(expectedReward);
        expectEvent(receipt, 'Harvest', [someone]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'Harvest',
          [someone, pid]
        );
      });

      describe('harvest from', async function() {
        beforeEach(async function() {
          const timeLimit = (await latest()).add(seconds(86400));
          await this.fountain.harvestApprove(someone, timeLimit, {
            from: user,
          });
        });

        it('harvest joined', async function() {
          // user harvest angel1
          const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
          const receipt = await this.fountain.harvestFrom(
            this.angel1.address,
            user,
            someone,
            {
              from: someone,
            }
          );
          expectEvent(receipt, 'Harvest', [user]);
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel1,
            'Harvest',
            [user, pid]
          );
          const info1After = await this.angel1.userInfo.call(pid, user);
          const pendingAfter = await this.angel1.pendingGrace.call(pid, user);
          const tokenUser = await this.rwdToken1.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken1.balanceOf.call(someone);
          expect(pendingAfter).to.be.bignumber.eq(ether('0'));
          expect(info1After[1]).to.be.bignumber.eq(tokenSomeone);
          expect(tokenUser).to.be.bignumber.eq(ether('0'));
          expect(tokenSomeone)
            .to.be.bignumber.gte(pendingBefore)
            .gt(ether('0'));
        });

        it('harvest non-joined', async function() {
          // user harvest angel2
          const pendingBefore = await this.angel2.pendingGrace.call(pid, user);
          const receipt = await this.fountain.harvestFrom(
            this.angel2.address,
            user,
            someone,
            {
              from: someone,
            }
          );
          expectEvent(receipt, 'Harvest', [user]);
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel2,
            'Harvest',
            [user, pid, new BN('0')]
          );
          const tokenUser = await this.rwdToken2.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken2.balanceOf.call(someone);
          expect(pendingBefore).to.be.bignumber.eq(ether('0'));
          expect(tokenUser).to.be.bignumber.eq(ether('0'));
          expect(tokenSomeone).to.be.bignumber.eq(ether('0'));
        });

        it('harvest all', async function() {
          // user harvest all
          const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
          const receipt = await this.fountain.harvestAllFrom(user, someone, {
            from: someone,
          });
          expectEvent(receipt, 'Harvest', [user]);
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel1,
            'Harvest',
            [user, pid]
          );
          const info1After = await this.angel1.userInfo.call(pid, user);
          const pendingAfter = await this.angel1.pendingGrace.call(pid, user);
          const tokenUser = await this.rwdToken1.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken1.balanceOf.call(someone);
          expect(pendingAfter).to.be.bignumber.eq(ether('0'));
          expect(info1After[1]).to.be.bignumber.eq(tokenSomeone);
          expect(tokenUser).to.be.bignumber.eq(ether('0'));
          expect(tokenSomeone)
            .to.be.bignumber.gte(pendingBefore)
            .gt(ether('0'));
        });
      });

      describe('harvest permit', async function() {
        it('normal', async function() {
          const name = await this.fountain.name.call();
          const version = '1';
          const chainId = await web3.eth.getChainId();
          const verifyingContract = this.fountain.address;
          const sender = someone;
          const timeLimit = (await latest()).add(seconds(300));
          const nonce = 0;
          const deadline = MAX_UINT256;
          const data = {
            primaryType: 'HarvestPermit',
            types: { EIP712Domain, HarvestPermit },
            domain: { name, version, chainId, verifyingContract },
            message: { owner, sender, timeLimit, nonce, deadline },
          };
          const signature = ethSigUtil.signTypedMessage(
            getMnemonicPrivateKey(owner),
            {
              data,
            }
          );
          const { v, r, s } = fromRpcSig(signature);
          const receipt = await this.fountain.harvestPermit(
            owner,
            sender,
            timeLimit,
            deadline,
            v,
            r,
            s
          );
          expectEvent(receipt, 'HarvestApproval', [owner]);
          expect(await this.fountain.harvestNonces(owner)).to.be.bignumber.eq(
            '1'
          );
          expect(
            await this.fountain.harvestTimeLimit.call(owner, sender)
          ).to.be.bignumber.eq(timeLimit);
        });
      });

      describe('harvest from with permit', async function() {
        let timeLimit;
        const deadline = MAX_UINT256;
        let data;
        let signature;

        beforeEach(async function() {
          const name = await this.fountain.name.call();
          const version = '1';
          const chainId = await web3.eth.getChainId();
          const verifyingContract = this.fountain.address;
          const owner = user;
          const sender = someone;
          await increase(seconds(300));
          timeLimit = (await latest()).add(seconds(300));
          const nonce = 0;
          const data = {
            primaryType: 'HarvestPermit',
            types: { EIP712Domain, HarvestPermit },
            domain: { name, version, chainId, verifyingContract },
            message: { owner, sender, timeLimit, nonce, deadline },
          };
          signature = ethSigUtil.signTypedMessage(getMnemonicPrivateKey(user), {
            data,
          });
        });

        it('harvest joined', async function() {
          // user harvest angel1
          const { v, r, s } = fromRpcSig(signature);
          const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
          const receipt = await this.fountain.harvestFromWithPermit(
            this.angel1.address,
            user,
            someone,
            timeLimit,
            deadline,
            v,
            r,
            s,
            {
              from: someone,
            }
          );
          expectEvent(receipt, 'Harvest', [user]);
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel1,
            'Harvest',
            [user, pid]
          );
          const info1After = await this.angel1.userInfo.call(pid, user);
          const pendingAfter = await this.angel1.pendingGrace.call(pid, user);
          const tokenUser = await this.rwdToken1.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken1.balanceOf.call(someone);
          expect(pendingAfter).to.be.bignumber.eq(ether('0'));
          expect(info1After[1]).to.be.bignumber.eq(tokenSomeone);
          expect(tokenUser).to.be.bignumber.eq(ether('0'));
          expect(tokenSomeone)
            .to.be.bignumber.gte(pendingBefore)
            .gt(ether('0'));
        });

        it('harvest non-joined', async function() {
          // user harvest angel2
          const { v, r, s } = fromRpcSig(signature);
          const pendingBefore = await this.angel2.pendingGrace.call(pid, user);
          const receipt = await this.fountain.harvestFromWithPermit(
            this.angel2.address,
            user,
            someone,
            timeLimit,
            deadline,
            v,
            r,
            s,
            {
              from: someone,
            }
          );
          expectEvent(receipt, 'Harvest', [user]);
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel2,
            'Harvest',
            [user, pid, new BN('0')]
          );
          const tokenUser = await this.rwdToken2.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken2.balanceOf.call(someone);
          expect(pendingBefore).to.be.bignumber.eq(ether('0'));
          expect(tokenUser).to.be.bignumber.eq(ether('0'));
          expect(tokenSomeone).to.be.bignumber.eq(ether('0'));
        });

        it('harvest all', async function() {
          // user harvest all
          const { v, r, s } = fromRpcSig(signature);
          const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
          const receipt = await this.fountain.harvestAllFromWithPermit(
            user,
            someone,
            timeLimit,
            deadline,
            v,
            r,
            s,
            { from: someone }
          );
          expectEvent(receipt, 'Harvest', [user]);
          expectEvent.inTransaction(
            receipt.receipt.transactionHash,
            this.angel1,
            'Harvest',
            [user, pid]
          );
          const info1After = await this.angel1.userInfo.call(pid, user);
          const pendingAfter = await this.angel1.pendingGrace.call(pid, user);
          const tokenUser = await this.rwdToken1.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken1.balanceOf.call(someone);
          expect(pendingAfter).to.be.bignumber.eq(ether('0'));
          expect(info1After[1]).to.be.bignumber.eq(tokenSomeone);
          expect(tokenUser).to.be.bignumber.eq(ether('0'));
          expect(tokenSomeone)
            .to.be.bignumber.gte(pendingBefore)
            .gt(ether('0'));
        });
      });
    });

    describe('emergency withdraw', function() {
      const depositAmount = ether('10');
      const pid = new BN('0');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('1000'),
          this.stkToken.address,
          this.rewarder.address,
          { from: rewarder }
        );
        // join angel
        await this.fountain.joinAngel(this.angel1.address, { from: user });
        // user deposit
        await this.stkToken.approve(this.fountain.address, depositAmount, {
          from: user,
        });
        await this.fountain.deposit(depositAmount, { from: user });
      });

      it('reverting rewarder', async function() {
        // Set to bad rewarder
        await this.angel1.set(
          new BN('0'),
          new BN('1000'),
          this.badRewarder.address,
          true,
          { from: rewarder }
        );
        await expectRevert(
          this.fountain.withdraw(depositAmount, { from: user }),
          'bad rewarder'
        );
        await increase(seconds(300));
        // check joined angel user balance
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const stkTokenUser = await this.stkToken.balanceOf.call(user);
        // user emergency withdraw
        const receipt = await this.fountain.emergencyWithdraw({ from: user });
        expectEvent(receipt, 'EmergencyWithdraw', [user, depositAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'EmergencyWithdraw',
          [user, pid, depositAmount, user]
        );
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingGrace.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(pending).to.be.bignumber.eq(ether('0'));
        expect(await this.stkToken.balanceOf.call(user)).to.be.bignumber.eq(
          stkTokenUser.add(depositAmount)
        );
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });

      it('gas monster rewarder', async function() {
        // Set to bad rewarder
        await this.angel1.set(
          new BN('0'),
          new BN('1000'),
          this.gasRewarder.address,
          true,
          { from: rewarder }
        );
        await expectRevert(
          this.fountain.withdraw(depositAmount, { from: user }),
          'revert'
        );

        await increase(seconds(300));
        // check joined angel user balance
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const stkTokenUser = await this.stkToken.balanceOf.call(user);
        // user emergency withdraw
        const receipt = await this.fountain.emergencyWithdraw({ from: user });
        expectEvent(receipt, 'EmergencyWithdraw', [user, depositAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'EmergencyWithdraw',
          [user, pid, depositAmount, user]
        );
        expect(new BN(receipt.receipt.gasUsed)).to.be.bignumber.lt(
          new BN('1500000')
        );
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingGrace.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(pending).to.be.bignumber.eq(ether('0'));
        expect(await this.stkToken.balanceOf.call(user)).to.be.bignumber.eq(
          stkTokenUser.add(depositAmount)
        );
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });
    });

    describe('emergency withdraw deflating token', function() {
      const depositAmount = ether('10');
      const actualAmount = depositAmount.mul(new BN('99')).div(new BN('100'));
      const withdrawAmount = actualAmount.mul(new BN('99')).div(new BN('100'));
      const pid = new BN('0');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('1000'),
          this.dflToken.address,
          this.rewarder.address,
          { from: rewarder }
        );
        // join angel
        await this.dflFountain.joinAngel(this.angel1.address, { from: user });
        // user deposit
        await this.dflToken.approve(this.dflFountain.address, depositAmount, {
          from: user,
        });
        await this.dflFountain.deposit(depositAmount, { from: user });
      });

      it('reverting rewarder', async function() {
        // Set to bad rewarder
        await this.angel1.set(
          new BN('0'),
          new BN('1000'),
          this.badRewarder.address,
          true,
          { from: rewarder }
        );
        await expectRevert(
          this.dflFountain.withdraw(actualAmount, { from: user }),
          'bad rewarder'
        );
        await increase(seconds(300));
        // check joined angel user balance
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const dflTokenUser = await this.dflToken.balanceOf.call(user);
        // user emergency withdraw
        const receipt = await this.dflFountain.emergencyWithdraw({
          from: user,
        });
        expectEvent(receipt, 'EmergencyWithdraw', [user, actualAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'EmergencyWithdraw',
          [user, pid, actualAmount, user]
        );
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingGrace.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(pending).to.be.bignumber.eq(ether('0'));
        expect(await this.dflToken.balanceOf.call(user)).to.be.bignumber.eq(
          dflTokenUser.add(withdrawAmount)
        );
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });

      it('gas monster rewarder', async function() {
        // Set to bad rewarder
        await this.angel1.set(
          new BN('0'),
          new BN('1000'),
          this.gasRewarder.address,
          true,
          { from: rewarder }
        );
        await expectRevert(
          this.dflFountain.withdraw(actualAmount, { from: user }),
          'revert'
        );

        await increase(seconds(300));
        // check joined angel user balance
        const pendingBefore = await this.angel1.pendingGrace.call(pid, user);
        const dflTokenUser = await this.dflToken.balanceOf.call(user);
        // user emergency withdraw
        const receipt = await this.dflFountain.emergencyWithdraw({
          from: user,
        });
        expectEvent(receipt, 'EmergencyWithdraw', [user, actualAmount, user]);
        expectEvent.inTransaction(
          receipt.receipt.transactionHash,
          this.angel1,
          'EmergencyWithdraw',
          [user, pid, actualAmount, user]
        );
        expect(new BN(receipt.receipt.gasUsed)).to.be.bignumber.lt(
          new BN('1500000')
        );
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingGrace.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(pending).to.be.bignumber.eq(ether('0'));
        expect(await this.dflToken.balanceOf.call(user)).to.be.bignumber.eq(
          dflTokenUser.add(withdrawAmount)
        );
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });
    });

    describe('erc20', function() {
      const depositAmount = ether('10');
      const pid = new BN('0');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('1000'),
          this.stkToken.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // join angel
        await this.fountain.joinAngel(this.angel1.address, { from: user });
        // user deposit
        await this.stkToken.approve(this.fountain.address, depositAmount, {
          from: user,
        });
        await this.fountain.deposit(depositAmount, { from: user });
        await increase(seconds(300));
      });

      describe('transfer', function() {
        it('normal', async function() {
          await this.fountain.transfer(someone, depositAmount, { from: user });
        });
      });

      describe('transfer from', function() {
        it('normal', async function() {
          await this.fountain.approve(someone, depositAmount, { from: user });
          await this.fountain.transferFrom(user, someone, depositAmount, {
            from: someone,
          });
        });
      });

      describe('permit', function() {
        it('normal', async function() {
          const name = await this.fountain.name.call();
          const version = '1';
          const chainId = await web3.eth.getChainId();
          const verifyingContract = this.fountain.address;
          const spender = someone;
          const value = depositAmount;
          const nonce = 0;
          const deadline = MAX_UINT256;
          const data = {
            primaryType: 'Permit',
            types: { EIP712Domain, Permit },
            domain: { name, version, chainId, verifyingContract },
            message: { owner, spender, value, nonce, deadline },
          };
          const signature = ethSigUtil.signTypedMessage(
            getMnemonicPrivateKey(owner),
            {
              data,
            }
          );
          const { v, r, s } = fromRpcSig(signature);
          const receipt = await this.fountain.permit(
            owner,
            spender,
            value,
            deadline,
            v,
            r,
            s
          );
          expect(await this.fountain.nonces(owner)).to.be.bignumber.eq('1');
          expect(
            await this.fountain.allowance(owner, spender)
          ).to.be.bignumber.eq(value);
        });
      });

      describe('permit and transferFrom', function() {
        it('normal', async function() {
          const name = await this.fountain.name.call();
          const version = '1';
          const chainId = await web3.eth.getChainId();
          const verifyingContract = this.fountain.address;
          const spender = someone;
          const value = depositAmount;
          const nonce = 0;
          const deadline = MAX_UINT256;
          const data = {
            primaryType: 'Permit',
            types: { EIP712Domain, Permit },
            domain: { name, version, chainId, verifyingContract },
            message: { owner, spender, value, nonce, deadline },
          };
          const signature = ethSigUtil.signTypedMessage(
            getMnemonicPrivateKey(owner),
            {
              data,
            }
          );
          const { v, r, s } = fromRpcSig(signature);
          // Prepare token
          await this.fountain.transfer(owner, value, { from: user });
          await this.fountain.transferFromWithPermit(
            owner,
            user,
            value,
            deadline,
            v,
            r,
            s,
            { from: spender }
          );
          expect(await this.fountain.nonces(owner)).to.be.bignumber.eq('1');
          expect(
            await this.fountain.allowance(owner, spender)
          ).to.be.bignumber.eq(ether('0'));
          expect(await this.fountain.balanceOf(user)).to.be.bignumber.eq(value);
        });
      });
    });

    describe('flashLoan', function() {
      beforeEach(async function() {
        const depositAmount = ether('1000');
        this.borrower = await FlashBorrower.new();
        await this.stkToken.approve(this.fountain.address, depositAmount, {
          from: user,
        });
        await this.fountain.deposit(depositAmount, { from: user });
        await this.archangel.setFlashLoanFee(
          this.fountain.address,
          new BN('100'),
          { from: owner }
        );
      });

      it('normal', async function() {
        const fee = ether('1');
        const multiplier = new BN('100');
        const collector = this.archangel.address;
        await this.stkToken.approve(this.borrower.address, fee, {
          from: user,
        });
        const tokenUserBefore = await this.stkToken.balanceOf.call(user);
        const tokenLenderBefore = await this.stkToken.balanceOf.call(
          this.fountain.address
        );
        const tokenCollectorBefore = await this.stkToken.balanceOf.call(
          collector
        );
        await this.borrower.go(
          this.fountain.address,
          this.stkToken.address,
          fee,
          multiplier,
          {
            from: user,
          }
        );
        const tokenUserAfter = await this.stkToken.balanceOf.call(user);
        const tokenLenderAfter = await this.stkToken.balanceOf.call(
          this.fountain.address
        );
        const tokenCollectorAfter = await this.stkToken.balanceOf.call(
          collector
        );
        const tokenOwnerAfter = await this.stkToken.balanceOf.call(owner);
        expect(tokenUserAfter.sub(tokenUserBefore)).to.be.bignumber.eq(
          ether('0').sub(fee)
        );
        expect(tokenLenderAfter.sub(tokenLenderBefore)).to.be.bignumber.eq(fee);
        expect(
          tokenCollectorAfter.sub(tokenCollectorBefore)
        ).to.be.bignumber.eq(ether('0'));
        const receipt = await this.archangel.rescueERC20(
          this.stkToken.address,
          this.fountain.address,
          { from: owner }
        );
        const tokenLenderFinal = await this.stkToken.balanceOf.call(
          this.fountain.address
        );
        const tokenCollectorFinal = await this.stkToken.balanceOf.call(
          collector
        );
        const tokenOwnerFinal = await this.stkToken.balanceOf.call(owner);
        expect(tokenLenderFinal.sub(tokenLenderAfter)).to.be.bignumber.eq(
          ether('0').sub(fee)
        );
        expect(tokenCollectorFinal.sub(tokenCollectorAfter)).to.be.bignumber.eq(
          ether('0')
        );
        expect(tokenOwnerFinal.sub(tokenOwnerAfter)).to.be.bignumber.eq(fee);
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
          this.borrower.go(
            this.fountain.address,
            token.address,
            fee,
            multiplier,
            {
              from: user,
            }
          ),
          'wrong token'
        );
      });

      it('insufficient fee', async function() {
        const fee = ether('1');
        const multiplier = new BN('1000');
        const collector = this.archangel.address;
        await this.stkToken.approve(this.borrower.address, fee, {
          from: user,
        });
        await expectRevert(
          this.borrower.go(
            this.fountain.address,
            this.stkToken.address,
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
  });
});
