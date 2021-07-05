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

const SimpleToken = artifacts.require('SimpleToken');
const ERC20FlashLoan = artifacts.require('ERC20FlashLoanMock');
const FlashBorrower = artifacts.require('FlashBorrower');

contract('ERC20FlashLoan', function([_, collector, user]) {
  beforeEach(async function() {
    this.token = await SimpleToken.new('Token', 'TKN', ether('10000'));
    this.lender = await ERC20FlashLoan.new(
      this.token.address,
      new BN('100'),
      true,
      {
        from: collector,
      }
    );
    this.lenderNoC = await ERC20FlashLoan.new(
      this.token.address,
      new BN('100'),
      false,
      {
        from: collector,
      }
    );
    this.borrower = await FlashBorrower.new();
    await this.token.transfer(this.lender.address, ether('1000'));
    await this.token.transfer(this.lenderNoC.address, ether('1000'));
  });

  describe('flashLoan', function() {
    it('normal', async function() {
      const fee = ether('1');
      const multiplier = new BN('100');
      await this.token.transfer(user, fee);
      await this.token.approve(this.borrower.address, fee, { from: user });
      const tokenUserBefore = await this.token.balanceOf.call(user);
      const tokenLenderBefore = await this.token.balanceOf.call(
        this.lender.address
      );
      const tokenCollectorBefore = await this.token.balanceOf.call(collector);
      await this.borrower.go(
        this.lender.address,
        this.token.address,
        fee,
        multiplier,
        {
          from: user,
        }
      );
      const tokenUserAfter = await this.token.balanceOf.call(user);
      const tokenLenderAfter = await this.token.balanceOf.call(
        this.lender.address
      );
      const tokenCollectorAfter = await this.token.balanceOf.call(collector);
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

    it('normal no collector', async function() {
      const fee = ether('1');
      const multiplier = new BN('100');
      await this.token.transfer(user, fee);
      await this.token.approve(this.borrower.address, fee, { from: user });
      const tokenUserBefore = await this.token.balanceOf.call(user);
      const tokenLenderBefore = await this.token.balanceOf.call(
        this.lenderNoC.address
      );
      const tokenCollectorBefore = await this.token.balanceOf.call(collector);
      await this.borrower.go(
        this.lenderNoC.address,
        this.token.address,
        fee,
        multiplier,
        {
          from: user,
        }
      );
      const tokenUserAfter = await this.token.balanceOf.call(user);
      const tokenLenderAfter = await this.token.balanceOf.call(
        this.lenderNoC.address
      );
      const tokenCollectorAfter = await this.token.balanceOf.call(collector);
      expect(tokenUserAfter.sub(tokenUserBefore)).to.be.bignumber.eq(
        ether('0').sub(fee)
      );
      expect(tokenLenderAfter.sub(tokenLenderBefore)).to.be.bignumber.eq(fee);
      expect(tokenCollectorAfter.sub(tokenCollectorBefore)).to.be.bignumber.eq(
        ether('0')
      );
    });

    it('different token', async function() {
      const fee = ether('1');
      const multiplier = new BN('100');
      const token = await SimpleToken.new('Token', 'TKN', ether('10000'));
      await token.transfer(user, fee);
      await token.approve(this.borrower.address, fee, {
        from: user,
      });
      await expectRevert(
        this.borrower.go(this.lender.address, token.address, fee, multiplier, {
          from: user,
        }),
        'wrong token'
      );
    });

    it('insufficient fee', async function() {
      const fee = ether('1');
      const multiplier = new BN('1000');
      await this.token.transfer(user, fee);
      await this.token.approve(this.borrower.address, fee, {
        from: user,
      });
      await expectRevert(
        this.borrower.go(
          this.lender.address,
          this.token.address,
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
