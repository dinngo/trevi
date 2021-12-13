using DummyERC20A as someToken
using DummyERC20B as someToken2
using Fountain as fountain
using Angel as angel // may also be the same as currentContract
using Summary as summaryInstance // general summary for DeFi protocols

methods {
    // Angel
    owner() returns (address) envfree
    lpToken(uint256) returns (address) envfree
    rewarder(uint256) returns (address) envfree
    totalAllocPoint() returns (uint256) envfree
    gracePerSecond() returns (uint256) envfree
    endTime() returns (uint256) envfree
    lpTokenLength() returns (uint256) envfree
    rewarderLength() returns (uint256) envfree
    deposit(uint256 pid, uint256 amount, address to) => DISPATCHER(true)
    withdraw(uint256 pid, uint256 amount, address to) => DISPATCHER(true)
    harvest(uint256 pid, address from, address to) => DISPATCHER(true)
    emergencyWithdraw(uint256 pid, address to) => DISPATCHER(true)
    rescueERC20(address token, uint256 amount, address to) => DISPATCHER(true)

    // // Fountain
    // totalSupply() returns (uint) envfree
    // allowance(address,address) returns (uint) envfree
    // balanceOf(address) returns (uint) envfree
    // stakingToken() returns (address) envfree
    angelInfo(address) => DISPATCHER(true)
    fountain.angelInfo(address) envfree
    // joinedAngel(address) returns (address[]) envfree
    // _status() returns (uint) => DISPATCHER(true)
    // hasJoinedAngel(address,address) returns (bool) envfree => DISPATCHER(true)
    // deposit(uint256) => DISPATCHER(true)
    // emergencyWithdraw() => DISPATCHER(true)

    // ERC20
    transfer(address,uint256) => DISPATCHER(true)
    transferFrom(address,address,uint256) => DISPATCHER(true)
    approve(address,uint256) => DISPATCHER(true)
    allowance(address,address) returns (uint) => DISPATCHER(true)
    balanceOf(address) returns (uint) => DISPATCHER(true)
    totalSupply() returns (uint) => DISPATCHER(true)

    havocMe(address) => DISPATCHER(true)
    havocMeEth() => DISPATCHER(true)

    someToken.balanceOf(address) returns (uint) envfree
    someToken.allowance(address,address) returns (uint) envfree
    someToken2.balanceOf(address) returns (uint) envfree
    someToken2.allowance(address,address) returns (uint) envfree

    // Summary
    setFountainAddress(address) => DISPATCHER(true)
    summaryInstance.setFountainAddress(address) envfree

    // Archangel
    getFountain(address) => DISPATCHER(true)

    // Rewarder
    onGraceReward(
        uint256 pid,
        address user,
        address recipient,
        uint256 graceAmount,
        uint256 newLpAmount
    ) => HAVOC_ECF

    // FlashBorrower
    onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes data
    ) returns (bytes32) => DISPATCHER(true)
}

definition MAX_UINT256() returns uint256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

/* ********* ALREADY PASS (HAVOC_ECF) ******** */ 
rule stateChagneIffOwner(method f) {
    summaryInstance.setFountainAddress(fountain);

    uint256 before_endTime = angel.endTime();
    uint256 before_gracePerSecond = angel.gracePerSecond();
    uint256 before_totalAllocPoint = angel.totalAllocPoint();

    env e;
    calldataarg arg;
    require e.msg.sender != angel.owner();
    f(e, arg);

    uint256 after_endTime = angel.endTime();
    uint256 after_gracePerSecond = angel.gracePerSecond();
    uint256 after_totalAllocPoint = angel.totalAllocPoint();

    assert before_endTime == after_endTime;
    assert before_gracePerSecond == after_gracePerSecond;
    assert before_totalAllocPoint == after_totalAllocPoint;
}

/* ********* PASS (HAVOC_ECF) ******** */ 
rule stateChagneIffOwner_lpToken(method f, uint256 i) {
    summaryInstance.setFountainAddress(fountain);

    uint256 before = angel.lpToken(i);
    uint256 before_length = angel.lpTokenLength();

    env e;
    calldataarg arg;
    require e.msg.sender != angel.owner();
    f(e, arg);

    uint256 after = angel.lpToken(i);
    uint256 after_length = angel.lpTokenLength();

    assert before == after;
    assert before_length == after_length;
}

/* ********* PASS (HAVOC_ECF) ******** */ 
rule stateChagneIffOwner_rewarder(method f, uint256 i) {
    summaryInstance.setFountainAddress(fountain);

    uint256 before = angel.rewarder(i);
    uint256 before_length = angel.rewarderLength();

    env e;
    calldataarg arg;
    require e.msg.sender != angel.owner();
    f(e, arg);

    uint256 after = angel.rewarder(i);
    uint256 after_length = angel.rewarderLength();

    assert before == after;
    assert before_length == after_length;
}

function arbitrary(method f) {
    env e__;
    calldataarg arg__;
    f(e__, arg__);
}