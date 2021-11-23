using DummyERC20A as someToken
using DummyERC20B as someToken2
using Fountain as fountain // may also be the same as currentContract
using Angel as angel
using Summary as summaryInstance // general summary for DeFi protocols

methods {
    // Fountain
    totalSupply() returns (uint) envfree => DISPATCHER(true)
    stakingToken() returns (address) envfree

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
    getFountain(address) => NONDET

    // Rewarder
    onGraceReward(
        uint256 pid,
        address user,
        address recipient,
        uint256 graceAmount,
        uint256 newLpAmount
    ) => HAVOC_ECF
}

rule ftnTokenSupplyNoGreaterThanUnderlyingToken(method f) {
    //used to restric func to test, should remove after testing
    require f.selector == fountain.deposit(uint256).selector;
    // require f.isView;

    require someToken != fountain;
    require someToken == stakingToken();

    uint256 ftnBefore = fountain.totalSupply();
    uint256 underlyingBefore = someToken.balanceOf(fountain);

    arbitrary(f);

    uint256 ftnAfter = fountain.totalSupply();
    uint256 underlyingAfter = someToken.balanceOf(fountain);

    assert (ftnBefore <= underlyingBefore) => (ftnAfter <= underlyingAfter);
}


function arbitrary(method f) {
    env e__;
    calldataarg arg__;
    f(e__, arg__);
}