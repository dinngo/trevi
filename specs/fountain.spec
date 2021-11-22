using DummyERC20A as someToken
using DummyERC20B as someToken2
using Fountain as fountain // may also be the same as currentContract
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
}

rule ftnTokenSupplyNoGreaterThanUnderlyingToken(method f) {
    //used to restric func to test, should remove after testing
    // require f.selector == stakingToken();
    // require f.isView;

    require someToken != currentContract;
    require someToken == stakingToken();

    uint256 ftnBefore = currentContract.totalSupply();
    uint256 underlyingBefore = someToken.balanceOf(currentContract);

    arbitrary(f);

    uint256 ftnAfter = currentContract.totalSupply();
    uint256 underlyingAfter = someToken.balanceOf(currentContract);

    assert (ftnBefore <= underlyingBefore) => (ftnAfter <= underlyingAfter);
}


function arbitrary(method f) {
    env e__;
    calldataarg arg__;
    f(e__, arg__);
}