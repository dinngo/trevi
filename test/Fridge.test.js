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
const MiniChef = artifacts.require('MiniChefV2');
const ChefFactory = artifacts.require('ChefFactory');
const Fridge = artifacts.require('Fridge');
const FridgeFactory = artifacts.require('FridgeFactory');
const SimpleToken = artifacts.require('SimpleToken');

contract('Fridge', function([_, user, rewarder]) {
  beforeEach(async function() {
    this.manager = await Manager.new();
    const chefFactory = await this.manager.chefFactory.call();
    const fridgeFactory = await this.manager.fridgeFactory.call();
    this.chefFactory = await ChefFactory.at(chefFactory);
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

  describe('by chef', function() {
    beforeEach(async function() {
      await this.chefFactory.create(this.rwdToken1.address, { from: rewarder });
    });

    describe('set pid', function() {
      it('normal', async function() {
        // create fridge
        // add from fridge
        // check at fridge
      });

      it('no fridge created', async function() {
        // add from fridge
      });

      it('not from fridge', async function() {
        // set pid direct
      });
    });
  });

  describe('by user', function() {
    let chef1;
    let chef2;
    let fridge1;
    let fridge2;
    beforeEach(async function() {
      // Get chef
      await this.chefFactory.create(this.rwdToken1.address, { from: rewarder });
      await this.chefFactory.create(this.rwdToken2.address, { from: rewarder });
      // Setup chef1
      // Setup chef2
      // Get fridge
      await this.fridgeFactory.create(this.stkToken1.address);
      await this.fridgeFactory.create(this.stkToken2.address);
    });

    describe('join chef', function() {
      it('normal', async function() {
        // user join chef from fridge
      });
    });

    describe('quit chef', function() {
      it('normal', async function() {
        // user quit chef from fridge
      });
    });

    describe('deposit', function() {
      it('normal', async function() {
        // join chef
        // user deposit
        // check token
        // check joined chef user balance
        // check non-joined chef user balance
      });
    });

    describe('withdraw', function() {
      beforeEach(async function() {
        // join chef
        // user deposit
        // increase time
      });

      it('normal', async function() {
        // user withdraw
        // check joined chef user balance
        // check user staking token and reward token amount
      });
    });

    describe('harvest', function() {
      beforeEach(async function() {
        // chef1 add
        // chef2 add
        // join chef1
        // user deposit
        // increase time
      });

      it('harvest joined', async function() {
        // user harvest chef1
      });

      it('harvest non-joined', async function() {
        // user harvest chef2
      });

      it('harvest all', async function() {
        // user harvest all
      });
    });

    describe('emergency withdraw', function() {
      beforeEach(async function() {
        // join chef
        // user deposit
        // increase time
      });

      it('normal', async function() {
        // user emergency withdraw
        // check joined chef and user balance
        // check user staking token and reward token amount
      });
    });

    describe('erc20', function() {
      beforeEach(async function() {
        // join chef
        // user deposit
        // increase time
      });
      describe('transfer', function() {
        it('normal', async function() {});
      });

      describe('transferFrom', function() {
        it('normal', async function() {});
      });

      describe('permit and transferFrom', function() {
        it('normal', async function() {});
      });
    });
  });
});
