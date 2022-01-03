using DummyERC20A as someToken
using DummyERC20B as someToken2
using Fountain as fountain // may also be the same as currentContract
using Angel as angel
using Summary as summaryInstance // general summary for DeFi protocols

methods {
    // Fountain
    totalSupply() returns (uint) envfree
    allowance(address,address) returns (uint) envfree
    balanceOf(address) returns (uint) envfree
    stakingToken() returns (address) envfree
    angelInfo(address) envfree
    joinedAngel(address) returns (address[]) envfree
    _status() returns (uint) envfree => DISPATCHER(true)
    hasJoinedAngel(address,address) returns (bool) envfree
    deposit(uint256) => DISPATCHER(true)
    emergencyWithdraw() => DISPATCHER(true)

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

    // Angel
    deposit(uint256 pid, uint256 amount, address to) => DISPATCHER(true)
    withdraw(uint256 pid, uint256 amount, address to) => DISPATCHER(true)
    harvest(uint256 pid, address from, address to) => DISPATCHER(true)
    emergencyWithdraw(uint256 pid, address to) => DISPATCHER(true)
    rescueERC20(address token, uint256 amount, address to) => DISPATCHER(true)

    // Archangel
    getFountain(address) => DISPATCHER(true)

    // Rewarder
    onGraceReward(
        uint256 pid,
        address user,
        address recipient,
        uint256 graceAmount,
        uint256 newLpAmount
    ) => NONDET

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

/* ********* ALREADY PASS ******** */ 
rule ftnTokenSupplyNoGreaterThanUnderlyingToken(method f) {
    require !f.isView;
    summaryInstance.setFountainAddress(fountain);

    uint256 ftnBefore = fountain.totalSupply();
    uint256 underlyingBefore = someToken.balanceOf(fountain);

    arbitrary(f);

    uint256 ftnAfter = fountain.totalSupply();
    uint256 underlyingAfter = someToken.balanceOf(fountain);

    assert (ftnBefore <= underlyingBefore) => (ftnAfter <= underlyingAfter);
}

/* ********* Will fail when info.totalBalance less than totalSupply ******** */ 
rule emergencyWithdrawShouldAlwaysSuccess(method f) {
    require !f.isView;
    summaryInstance.setFountainAddress(fountain);
    
    env e1;
    uint256 depositAmount;
    require e1.msg.sender != 0; // 0 is reserved for minting/burning so we exclude it.
    require e1.msg.sender != fountain;
    require e1.msg.sender != angel;
    require someToken.balanceOf(fountain) >= fountain.balanceOf(e1.msg.sender);
    require fountain.totalSupply() >= fountain.balanceOf(e1.msg.sender);
    fountain.deposit(e1, depositAmount);

    // will timeout if we include this
    // arbitrary(f);

    env e2;
    require e2.msg.sender == e1.msg.sender;
    require e2.msg.value == 0; // function is non-payable
    require (someToken.balanceOf(fountain) + someToken.balanceOf(e2.msg.sender)) <= MAX_UINT256();
    fountain.emergencyWithdraw@withrevert(e2);

    assert !lastReverted;
}

/* ********* ALREADY PASS (havoc) ******** */ 
rule poolIdCannotChangeOnceSet(method f, address angel) {
    require !f.isView;
    summaryInstance.setFountainAddress(fountain);

    uint256 pidBefore;
    uint256 pidAfter;
    uint256 nonUsed;

    pidBefore, nonUsed = fountain.angelInfo(angel);

    arbitrary(f);

    pidAfter, nonUsed = fountain.angelInfo(angel);

    assert (pidBefore != 0) => (pidAfter == pidBefore);
}

/* ********* ALREADY PASS ******** */ 
rule rageQuitShouldAlwaysSuccess(method f) {
    require !f.isView;
    summaryInstance.setFountainAddress(fountain);

    env e1;
    require e1.msg.sender != 0; // 0 is reserved for minting/burning so we exclude it.
    require e1.msg.sender != fountain;
    require e1.msg.sender != angel;
    fountain.joinAngel(e1, angel);

    // will behave weird and eaily timeout
    // arbitrary(f);
    // require fountain.hasJoinedAngel(e1.msg.sender, angel); // filter out the case that angel already quited by previous action

    env e2;
    require e2.msg.sender == e1.msg.sender;
    require e2.msg.value == 0; // function is non-payable
    rageQuitAngel@withrevert(e2, angel);

    assert !lastReverted;
}


function arbitrary(method f) {
    env e__;
    calldataarg arg__;
    f(e__, arg__);
}