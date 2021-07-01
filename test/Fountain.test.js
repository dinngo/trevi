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
const { getCreated } = require('./helpers/utils');

const { expect } = require('chai');

const Archangel = artifacts.require('Archangel');
const Angel = artifacts.require('Angel');
const AngelFactory = artifacts.require('AngelFactory');
const Fountain = artifacts.require('Fountain');
const FountainFactory = artifacts.require('FountainFactory');
const SimpleToken = artifacts.require('SimpleToken');
const Rewarder = artifacts.require('RewarderMock');

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

contract('Fountain', function([_, user, someone, rewarder]) {
  beforeEach(async function() {
    this.archangel = await Archangel.new();
    const angelFactory = await this.archangel.angelFactory.call();
    const fountainFactory = await this.archangel.fountainFactory.call();
    this.angelFactory = await AngelFactory.at(angelFactory);
    this.fountainFactory = await FountainFactory.at(fountainFactory);
    this.stkToken = await SimpleToken.new('Staking', 'STK', ether('100'), {
      from: user,
    });
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
    let angel1;
    let angel2;
    let fountain1;
    let fountain2;
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
      // Setup angel1
      await this.angel1.setSushiPerSecond(ether('0.01'), { from: rewarder });
      await this.rwdToken1.transfer(this.angel1.address, ether('10000'), {
        from: rewarder,
      });
      // Setup angel2
      await this.angel2.setSushiPerSecond(ether('0.01'), { from: rewarder });
      await this.rwdToken2.transfer(this.angel2.address, ether('10000'), {
        from: rewarder,
      });
      // Get fountain
      receipt = await this.fountainFactory.create(this.stkToken.address);
      this.fountain = await getCreated(receipt, Fountain);
      // Get Rewarder
      this.rewarder = await Rewarder.new(
        ether('1'),
        this.rwdToken2.address,
        this.angel1.address
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
        expectEvent(receipt, 'Joined', {
          user: user,
          angel: this.angel1.address,
        });
        const angels = await this.fountain.joinedAngel.call(user);
        expect(angels[0]).eq(this.angel1.address);
      });

      it('Not added from angel', async function() {
        // user join angel from fountain
        await expectRevert(
          this.fountain.joinAngel(this.angel1.address, {
            from: user,
          }),
          'Fountain: not added by angel'
        );
      });
    });

    describe('quit angel', function() {
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // user join angel from fountain
        await this.fountain.joinAngel(this.angel1.address, {
          from: user,
        });
      });

      it('normal', async function() {
        // user quit angel from fountain
        const receipt = await this.fountain.quitAngel(this.angel1.address, {
          from: user,
        });
        expectEvent(receipt, 'Quitted', {
          user: user,
          angel: this.angel1.address,
        });
      });

      it('unjoined angel', async function() {
        // user quit unjoined angel from fountain
        await expectRevert(
          this.fountain.quitAngel(this.angel2.address, {
            from: user,
          }),
          'Fountain: unjoined angel'
        );
      });
    });

    describe('deposit', function() {
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        await this.angel2.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          { from: rewarder }
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
        const token1After = await this.stkToken.balanceOf.call(user);
        // check token
        expect(token1After).to.be.bignumber.eq(token1Before.sub(depositAmount));
        // check joined angel user balance
        const pid = new BN('0');
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
        const token1After = await this.stkToken.balanceOf.call(user);
        // check token
        expect(token1After).to.be.bignumber.eq(token1Before.sub(depositAmount));
        // check joined angel user balance
        const pid = new BN('0');
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
        const token1UserAfter = await this.stkToken.balanceOf.call(user);
        // check token
        expect(token1UserAfter).to.be.bignumber.eq(
          token1Before.sub(depositAmount)
        );
        // check joined angel user balance
        const pid = new BN('0');
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

    describe('withdraw', function() {
      const depositAmount = ether('10');
      const pid = new BN('0');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
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

      it('normal', async function() {
        // check joined angel user balance
        const info1Before = await this.angel1.userInfo.call(pid, user);
        const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
        // user withdraw
        const receipt = await this.fountain.withdraw(depositAmount, {
          from: user,
        });
        expectEvent(receipt, 'Withdraw', [user, depositAmount, user]);
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingSushi.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(ether('0').sub(info1[1])).to.be.bignumber.gte(pendingBefore);
        expect(pending).to.be.bignumber.gte(pendingBefore);
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });

      it('0 amount', async function() {
        // check joined angel user balance
        const info1Before = await this.angel1.userInfo.call(pid, user);
        const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
        // user withdraw
        const receipt = await this.fountain.withdraw(ether('0'), {
          from: user,
        });
        expectEvent(receipt, 'Withdraw', [user, ether('0'), user]);
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingSushi.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(depositAmount);
        expect(ether('0').sub(info1[1])).to.be.bignumber.gte(ether('0'));
        expect(pending).to.be.bignumber.gte(pendingBefore);
        expect(await this.rwdToken1.balanceOf.call(user)).to.be.bignumber.eq(
          ether('0')
        );
      });
    });

    describe('harvest', function() {
      const depositAmount = ether('10');
      const pid = new BN('0');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        await this.angel2.add(
          new BN('10'),
          this.stkToken.address,
          ZERO_ADDRESS,
          { from: rewarder }
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
        const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
        const receipt = await this.fountain.harvest(this.angel1.address, {
          from: user,
        });
        expectEvent(receipt, 'Harvest', [user]);
        const info1After = await this.angel1.userInfo.call(pid, user);
        const pendingAfter = await this.angel1.pendingSushi.call(pid, user);
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
        const pendingBefore = await this.angel2.pendingSushi.call(pid, user);
        const receipt = await this.fountain.harvest(this.angel2.address, {
          from: user,
        });
        expectEvent(receipt, 'Harvest', [user]);
        const tokenUser = await this.rwdToken2.balanceOf.call(user);
        expect(pendingBefore).to.be.bignumber.eq(ether('0'));
        expect(tokenUser).to.be.bignumber.eq(ether('0'));
      });

      it('harvest all', async function() {
        // user harvest all
        const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
        const receipt = await this.fountain.harvestAll({ from: user });
        expectEvent(receipt, 'Harvest', [user]);
        const info1After = await this.angel1.userInfo.call(pid, user);
        const pendingAfter = await this.angel1.pendingSushi.call(pid, user);
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
        let expectedReward = await this.angel1.pendingSushi.call(pid, someone);
        expect((await this.angel1.userInfo(0, someone))[1]).to.be.bignumber.eq(
          ether('0').sub(expectedReward)
        );
        await this.fountain.harvest(this.angel1.address, { from: someone });
        expect(await this.rwdToken1.balanceOf.call(someone))
          .to.be.bignumber.eq(await this.rwdToken2.balanceOf.call(someone))
          .to.be.bignumber.eq(expectedReward);
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
          const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
          const receipt = await this.fountain.harvestFrom(
            this.angel1.address,
            user,
            someone,
            {
              from: someone,
            }
          );
          expectEvent(receipt, 'Harvest', [user]);
          const info1After = await this.angel1.userInfo.call(pid, user);
          const pendingAfter = await this.angel1.pendingSushi.call(pid, user);
          const tokenUser = await this.rwdToken1.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken1.balanceOf.call(someone);
          expect(pendingAfter).to.be.bignumber.eq(ether('0'));
          expect(info1After[1]).to.be.bignumber.eq(tokenSomeone);
          expect(tokenUser).to.be.bignumber.eq(ether('0'));
          expect(tokenSomeone).to.be.bignumber.gte(pendingBefore);
        });

        it('harvest non-joined', async function() {
          // user harvest angel2
          const pendingBefore = await this.angel2.pendingSushi.call(pid, user);
          const receipt = await this.fountain.harvestFrom(
            this.angel2.address,
            user,
            someone,
            {
              from: someone,
            }
          );
          expectEvent(receipt, 'Harvest', [user]);
          const tokenUser = await this.rwdToken2.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken2.balanceOf.call(someone);
          expect(pendingBefore).to.be.bignumber.eq(ether('0'));
          expect(tokenUser).to.be.bignumber.eq(ether('0'));
          expect(tokenSomeone).to.be.bignumber.eq(ether('0'));
        });

        it('harvest all', async function() {
          // user harvest all
          const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
          const receipt = await this.fountain.harvestAllFrom(user, someone, {
            from: someone,
          });
          expectEvent(receipt, 'Harvest', [user]);
          const info1After = await this.angel1.userInfo.call(pid, user);
          const pendingAfter = await this.angel1.pendingSushi.call(pid, user);
          const tokenUser = await this.rwdToken1.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken1.balanceOf.call(someone);
          expect(pendingAfter).to.be.bignumber.eq(ether('0'));
          expect(info1After[1]).to.be.bignumber.eq(tokenSomeone);
          expect(tokenUser).to.be.bignumber.eq(ether('0'));
          expect(tokenSomeone).to.be.bignumber.gte(pendingBefore);
        });
      });

      describe('harvest permit', async function() {
        it('normal', async function() {
          const name = await this.fountain.name.call();
          const version = '1';
          const chainId = await web3.eth.getChainId();
          const verifyingContract = this.fountain.address;
          const wallet = await web3.eth.accounts.create();
          const owner = wallet.address;
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
            utils.hexToBytes(wallet.privateKey),
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
            await this.fountain.harvestAllowance.call(owner, sender)
          ).to.be.bignumber.eq(timeLimit);
        });
      });

      describe('harvest from with permit', async function() {
        let wallet;
        let owner;
        const sender = someone;
        let timeLimit;
        const deadline = MAX_UINT256;
        let data;
        let signature;

        beforeEach(async function() {
          const name = await this.fountain.name.call();
          const version = '1';
          const chainId = await web3.eth.getChainId();
          const verifyingContract = this.fountain.address;
          wallet = await web3.eth.accounts.create();
          owner = wallet.address;
          await this.fountain.transfer(wallet.address, depositAmount, {
            from: user,
          });
          await increase(seconds(300));
          timeLimit = (await latest()).add(seconds(300));
          const nonce = 0;
          const data = {
            primaryType: 'HarvestPermit',
            types: { EIP712Domain, HarvestPermit },
            domain: { name, version, chainId, verifyingContract },
            message: { owner, sender, timeLimit, nonce, deadline },
          };
          signature = ethSigUtil.signTypedMessage(
            utils.hexToBytes(wallet.privateKey),
            {
              data,
            }
          );
        });

        it('harvest joined', async function() {
          // user harvest angel1
          const { v, r, s } = fromRpcSig(signature);
          const pendingBefore = await this.angel1.pendingSushi.call(
            pid,
            wallet.address
          );
          const receipt = await this.fountain.harvestFromWithPermit(
            this.angel1.address,
            wallet.address,
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
          expectEvent(receipt, 'Harvest', [wallet.address]);
          const info1After = await this.angel1.userInfo.call(
            pid,
            wallet.address
          );
          const pendingAfter = await this.angel1.pendingSushi.call(
            pid,
            wallet.address
          );
          const tokenUser = await this.rwdToken1.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken1.balanceOf.call(someone);
          const tokenOwner = await this.rwdToken1.balanceOf.call(
            wallet.address
          );
          expect(pendingAfter).to.be.bignumber.eq(ether('0'));
          expect(info1After[1]).to.be.bignumber.eq(tokenUser);
          expect(tokenSomeone).to.be.bignumber.eq(ether('0'));
          expect(tokenOwner).to.be.bignumber.eq(ether('0'));
          expect(tokenUser).to.be.bignumber.gte(pendingBefore);
        });

        it('harvest non-joined', async function() {
          // user harvest angel2
          const { v, r, s } = fromRpcSig(signature);
          const pendingBefore = await this.angel2.pendingSushi.call(
            pid,
            wallet.address
          );
          const receipt = await this.fountain.harvestFromWithPermit(
            this.angel2.address,
            wallet.address,
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
          expectEvent(receipt, 'Harvest', [wallet.address]);
          const tokenUser = await this.rwdToken2.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken2.balanceOf.call(someone);
          const tokenOwner = await this.rwdToken1.balanceOf.call(
            wallet.address
          );
          expect(pendingBefore).to.be.bignumber.eq(ether('0'));
          expect(tokenUser).to.be.bignumber.eq(ether('0'));
          expect(tokenOwner).to.be.bignumber.eq(ether('0'));
          expect(tokenSomeone).to.be.bignumber.eq(ether('0'));
        });

        it('harvest all', async function() {
          // user harvest all
          const { v, r, s } = fromRpcSig(signature);
          const pendingBefore = await this.angel1.pendingSushi.call(
            pid,
            wallet.address
          );
          const receipt = await this.fountain.harvestAllFromWithPermit(
            wallet.address,
            user,
            timeLimit,
            deadline,
            v,
            r,
            s,
            { from: someone }
          );
          expectEvent(receipt, 'Harvest', [wallet.address]);
          const info1After = await this.angel1.userInfo.call(
            pid,
            wallet.address
          );
          const pendingAfter = await this.angel1.pendingSushi.call(
            pid,
            wallet.address
          );
          const tokenUser = await this.rwdToken1.balanceOf.call(user);
          const tokenSomeone = await this.rwdToken1.balanceOf.call(someone);
          const tokenOwner = await this.rwdToken1.balanceOf.call(
            wallet.address
          );
          expect(pendingAfter).to.be.bignumber.eq(ether('0'));
          expect(info1After[1]).to.be.bignumber.eq(tokenUser);
          expect(tokenSomeone).to.be.bignumber.eq(ether('0'));
          expect(tokenOwner).to.be.bignumber.eq(ether('0'));
          expect(tokenUser).to.be.bignumber.gte(pendingBefore);
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

      it('normal', async function() {
        // check joined angel user balance
        const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
        // user emergency withdraw
        const receipt = await this.fountain.emergencyWithdraw({ from: user });
        expectEvent(receipt, 'EmergencyWithdraw', [user, depositAmount, user]);
        // check joined angel user balance
        const info1 = await this.angel1.userInfo.call(pid, user);
        const pending = await this.angel1.pendingSushi.call(pid, user);
        // check user staking token and reward token amount
        expect(info1[0]).to.be.bignumber.eq(ether('0'));
        expect(pending).to.be.bignumber.eq(ether('0'));
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
          const wallet = await web3.eth.accounts.create();
          const owner = wallet.address;
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
            utils.hexToBytes(wallet.privateKey),
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
          const wallet = await web3.eth.accounts.create();
          const owner = wallet.address;
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
            utils.hexToBytes(wallet.privateKey),
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
  });
});
