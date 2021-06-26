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

contract('Chef factory', function([_, user]) {
  beforeEach(async function() {
    this.manager = await Manager.new();
    const chefFactory = await this.manager.chefFactory.call();
    const fridgeFactory = await this.manager.fridgeFactory.call();
    this.chefFactory = await ChefFactory.at(chefFactory);
    this.fridgeFactory = await FridgeFactory.at(fridgeFactory);
    this.token1 = await SimpleToken.new('Staking', 'STK', ether('1000000000'));
    this.token2 = await SimpleToken.new('Reward', 'RWD', ether('1000000000'));
  });

  describe('Create', function() {});

  describe('Is valid', function() {});

  describe('Reward of', function() {});
});
