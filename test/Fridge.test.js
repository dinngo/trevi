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

const Manager = artifacts.require('Manager');
const Angel = artifacts.require('Angel');
const AngelFactory = artifacts.require('AngelFactory');
const Fridge = artifacts.require('Fridge');
const FridgeFactory = artifacts.require('FridgeFactory');
const SimpleToken = artifacts.require('SimpleToken');

const Permit = [
  { name: 'owner', type: 'address' },
  { name: 'spender', type: 'address' },
  { name: 'value', type: 'uint256' },
  { name: 'nonce', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
];

contract('Fridge', function([_, user, someone, rewarder]) {
  beforeEach(async function() {
    this.manager = await Manager.new();
    const angelFactory = await this.manager.angelFactory.call();
    const fridgeFactory = await this.manager.fridgeFactory.call();
    this.angelFactory = await AngelFactory.at(angelFactory);
    this.fridgeFactory = await FridgeFactory.at(fridgeFactory);
    this.stkToken1 = await SimpleToken.new('Staking', 'STK', ether('1000000'), {
      from: user,
    });
    this.stkToken2 = await SimpleToken.new('Staking', 'STK', ether('1000000'), {
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
        // create fridge
        const receipt = await this.fridgeFactory.create(this.stkToken1.address);
        this.fridge = await getCreated(receipt, Fridge);
      });

      it('normal', async function() {
        // add from Angel
        await this.angel.add(
          new BN('1000'),
          this.stkToken1.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // check at fridge
        const info = await this.fridge.angelInfo.call(this.angel.address);
        expect(info[0]).to.be.bignumber.eq(new BN('1'));
        expect(info[1]).to.be.bignumber.eq(new BN('0'));
      });

      it('from invalid angel', async function() {
        // add from invalid angel
      });

      it('not from fridge', async function() {
        // set pid direct
        await expectRevert.unspecified(this.fridge.setPoolId(new BN('1')));
      });
    });
  });

  describe('by user', function() {
    let angel1;
    let angel2;
    let fridge1;
    let fridge2;
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
      await this.angel1.setSushiPerSecond(ether('1'), { from: rewarder });
      await this.rwdToken1.transfer(this.angel1.address, ether('5000'), {
        from: rewarder,
      });
      // Setup angel2
      await this.angel2.setSushiPerSecond(ether('2'), { from: rewarder });
      await this.rwdToken2.transfer(this.angel2.address, ether('10000'), {
        from: rewarder,
      });
      // Get fridge
      receipt = await this.fridgeFactory.create(this.stkToken1.address);
      this.fridge1 = await getCreated(receipt, Fridge);
      receipt = await this.fridgeFactory.create(this.stkToken2.address);
      this.fridge2 = await getCreated(receipt, Fridge);
    });

    describe('join angel', function() {
      it('normal', async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('1000'),
          this.stkToken1.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // user join angel from fridge
        const receipt = await this.fridge1.joinAngel(this.angel1.address, {
          from: user,
        });
        expectEvent(receipt, 'Joined', {
          user: user,
          angel: this.angel1.address,
        });
        const angels = await this.fridge1.joinedAngel.call(user);
        expect(angels[0]).eq(this.angel1.address);
      });

      it('Not added from angel', async function() {
        // user join angel from fridge
        await expectRevert(
          this.fridge1.joinAngel(this.angel1.address, {
            from: user,
          }),
          'Fridge not added by angel'
        );
      });
    });

    describe('quit angel', function() {
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('1000'),
          this.stkToken1.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // user join angel from fridge
        await this.fridge1.joinAngel(this.angel1.address, {
          from: user,
        });
      });

      it('normal', async function() {
        // user quit angel from fridge
        const receipt = await this.fridge1.quitAngel(this.angel1.address, {
          from: user,
        });
        expectEvent(receipt, 'Quitted', {
          user: user,
          angel: this.angel1.address,
        });
      });
    });

    describe('deposit', function() {
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('1000'),
          this.stkToken1.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        await this.angel2.add(
          new BN('1000'),
          this.stkToken1.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
      });

      it('normal', async function() {
        const depositAmount = ether('10');
        // join angel
        await this.fridge1.joinAngel(this.angel1.address, { from: user });
        // user deposit
        const token1Before = await this.stkToken1.balanceOf.call(user);
        await this.stkToken1.approve(this.fridge1.address, depositAmount, {
          from: user,
        });
        await this.fridge1.deposit(depositAmount, { from: user });
        const token1After = await this.stkToken1.balanceOf.call(user);
        // check token
        expect(token1After).to.be.bignumber.eq(token1Before.sub(depositAmount));
        // check joined angel user balance
        const pid = new BN('1');
        const info1 = await this.angel1.userInfo.call(pid, user);
        expect(info1[0]).to.be.bignumber.eq(depositAmount);
        // check non-joined angel user balance
        let info2 = await this.angel2.userInfo.call(pid, user);
        expect(info2[0]).to.be.bignumber.eq(ether('0'));
        // join after deposit
        await this.fridge1.joinAngel(this.angel2.address, { from: user });
        info2 = await this.angel2.userInfo.call(pid, user);
        expect(info2[0]).to.be.bignumber.eq(depositAmount);
      });
    });

    describe('withdraw', function() {
      const depositAmount = ether('10');
      const pid = new BN('1');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('1000'),
          this.stkToken1.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // join angel
        await this.fridge1.joinAngel(this.angel1.address, { from: user });
        // user deposit
        await this.stkToken1.approve(this.fridge1.address, depositAmount, {
          from: user,
        });
        await this.fridge1.deposit(depositAmount, { from: user });
        await increase(seconds(300));
      });

      it('normal', async function() {
        // check joined angel user balance
        const info1Before = await this.angel1.userInfo.call(pid, user);
        const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
        // user withdraw
        await this.fridge1.withdraw(depositAmount, { from: user });
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
    });

    describe('harvest', function() {
      const depositAmount = ether('10');
      const pid = new BN('1');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('1000'),
          this.stkToken1.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        await this.angel2.add(
          new BN('1000'),
          this.stkToken1.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // join angel1
        await this.fridge1.joinAngel(this.angel1.address, { from: user });
        // user deposit
        await this.stkToken1.approve(this.fridge1.address, depositAmount, {
          from: user,
        });
        await this.fridge1.deposit(depositAmount, { from: user });
        await increase(seconds(300));
      });

      it('harvest joined', async function() {
        // user harvest angel1
        const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
        await this.fridge1.harvest(this.angel1.address, { from: user });
        const info1After = await this.angel1.userInfo.call(pid, user);
        const pendingAfter = await this.angel1.pendingSushi.call(pid, user);
        const tokenUser = await this.rwdToken1.balanceOf.call(user);
        expect(pendingAfter).to.be.bignumber.eq(ether('0'));
        expect(info1After[1]).to.be.bignumber.eq(tokenUser);
        expect(tokenUser).to.be.bignumber.gte(pendingBefore);
      });

      it('harvest non-joined', async function() {
        // user harvest angel2
        const pendingBefore = await this.angel2.pendingSushi.call(pid, user);
        await this.fridge1.harvest(this.angel2.address, { from: user });
        const tokenUser = await this.rwdToken2.balanceOf.call(user);
        expect(pendingBefore).to.be.bignumber.eq(ether('0'));
        expect(tokenUser).to.be.bignumber.eq(ether('0'));
      });

      it('harvest all', async function() {
        // user harvest all
        const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
        await this.fridge1.harvestAll({ from: user });
        const info1After = await this.angel1.userInfo.call(pid, user);
        const pendingAfter = await this.angel1.pendingSushi.call(pid, user);
        const tokenUser = await this.rwdToken1.balanceOf.call(user);
        expect(pendingAfter).to.be.bignumber.eq(ether('0'));
        expect(info1After[1]).to.be.bignumber.eq(tokenUser);
        expect(tokenUser).to.be.bignumber.gte(pendingBefore);
      });
    });

    describe('emergency withdraw', function() {
      const depositAmount = ether('10');
      const pid = new BN('1');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('1000'),
          this.stkToken1.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // join angel
        await this.fridge1.joinAngel(this.angel1.address, { from: user });
        // user deposit
        await this.stkToken1.approve(this.fridge1.address, depositAmount, {
          from: user,
        });
        await this.fridge1.deposit(depositAmount, { from: user });
        await increase(seconds(300));
      });

      it('normal', async function() {
        // check joined angel user balance
        const pendingBefore = await this.angel1.pendingSushi.call(pid, user);
        // user emergency withdraw
        await this.fridge1.emergencyWithdraw({ from: user });
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
      const pid = new BN('1');
      beforeEach(async function() {
        // Add from Angel
        await this.angel1.add(
          new BN('1000'),
          this.stkToken1.address,
          ZERO_ADDRESS,
          { from: rewarder }
        );
        // join angel
        await this.fridge1.joinAngel(this.angel1.address, { from: user });
        // user deposit
        await this.stkToken1.approve(this.fridge1.address, depositAmount, {
          from: user,
        });
        await this.fridge1.deposit(depositAmount, { from: user });
        await increase(seconds(300));
      });

      describe('transfer', function() {
        it('normal', async function() {
          await this.fridge1.transfer(someone, depositAmount, { from: user });
        });
      });

      describe('transferFrom', function() {
        it('normal', async function() {
          await this.fridge1.approve(someone, depositAmount, { from: user });
          await this.fridge1.transferFrom(user, someone, depositAmount, {
            from: someone,
          });
        });
      });

      describe('permit and transferFrom', function() {
        it('normal', async function() {
          const name = await this.fridge1.name.call();
          const version = '1';
          const chainId = await web3.eth.getChainId();
          const verifyingContract = this.fridge1.address;
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
          const receipt = await this.fridge1.permit(
            owner,
            spender,
            value,
            deadline,
            v,
            r,
            s
          );
          expect(await this.fridge1.nonces(owner)).to.be.bignumber.eq('1');
          expect(
            await this.fridge1.allowance(owner, spender)
          ).to.be.bignumber.eq(value);
        });
      });
    });
  });
});
