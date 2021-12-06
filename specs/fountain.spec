using DummyERC20A as someToken
using DummyERC20B as someToken2
using Fountain as fountain // may also be the same as currentContract
using Angel as angel
using Summary as summaryInstance // general summary for DeFi protocols

methods {
    // Fountain
    totalSupply() returns (uint) envfree => DISPATCHER(true)
    stakingToken() returns (address) envfree
    angelInfo(address) envfree
    joinedAngel(address) returns (address[]) envfree
    _status() returns (uint) envfree => DISPATCHER(true)
    deposit(uint256) => DISPATCHER(true)
    emergencyWithdraw() => DISPATCHER(true)

    // ERC20
    transfer(address,uint256) => DISPATCHER(true)
    transferFrom(address,address,uint256) => DISPATCHER(true)
    approve(address,uint256) => DISPATCHER(true)
    allowance(address,address) returns (uint) envfree => DISPATCHER(true)
    balanceOf(address) returns (uint) envfree => DISPATCHER(true)
    // totalSupply() returns (uint) envfree => DISPATCHER(true)

    havocMe(address) => DISPATCHER(true)
    havocMeEth() => DISPATCHER(true)

    someToken.balanceOf(address) returns (uint) envfree
    someToken.allowance(address,address) returns (uint) envfree
    someToken2.balanceOf(address) returns (uint) envfree

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
}

definition MAX_UINT256() returns uint256 = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF;

// rule ftnTokenSupplyNoGreaterThanUnderlyingToken(method f) {
//     //used to restric func to test, should remove after testing
//     require f.selector == fountain.deposit(uint256).selector;
//     // require f.isView;

//     require someToken != fountain;
//     require someToken == stakingToken();

//     uint256 ftnBefore = fountain.totalSupply();
//     uint256 underlyingBefore = someToken.balanceOf(fountain);

//     arbitrary(f);

//     uint256 ftnAfter = fountain.totalSupply();
//     uint256 underlyingAfter = someToken.balanceOf(fountain);

//     assert (ftnBefore <= underlyingBefore) => (ftnAfter <= underlyingAfter);
// }

rule emergencyWithdrawShouldAlwaysSuccess() {
    env e1;
    uint256 depositAmount;
    require e1.msg.sender != 0; // 0 is reserved for minting/burning so we exclude it.
    require e1.msg.sender != fountain;
    require e1.msg.sender != angel;
    require someToken.balanceOf(fountain) >= fountain.balanceOf(e1.msg.sender);
    require fountain.totalSupply() >= fountain.balanceOf(e1.msg.sender);
    fountain.deposit(e1, depositAmount);

    // require fountain._status() != 2; // only run not-yet-entered case

    env e2;
    require e2.msg.sender == e1.msg.sender;
    require e2.msg.value == 0; // function is non-payable
    require (someToken.balanceOf(fountain) + someToken.balanceOf(e2.msg.sender)) <= MAX_UINT256();
    fountain.emergencyWithdraw@withrevert(e2);

    assert !lastReverted;
}


function arbitrary(method f) {
    env e__;
    calldataarg arg__;
    f(e__, arg__);
}