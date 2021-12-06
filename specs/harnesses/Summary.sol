pragma experimental ABIEncoderV2;

import "./DummyERC20A.sol";

interface IERC20WithDummyFunctionality {
    function transfer(address to, uint amt) external;
    function transferFrom(address from, address to, uint amt) external;
    function balanceOf(address who) external returns (uint);
    function allowance(address a, address b) external returns (uint);
    function havocMe(address proxy) external;
    function havocMeEth() external;
}

interface Nothing {
    function nop() external payable;
}

interface WithEthAddress {
    function ETH_ADDRESS() external returns (address);
    function WETH() external returns (address);
}

interface IMakerGemJoin {
    function gem() external returns(address);
}

// used to summarize different functions
contract Summary {

    IERC20WithDummyFunctionality public erc20A;
    IERC20WithDummyFunctionality public erc20B;
    bytes32 executeRet;
    uint256 executeRetUint256;

    address faucet;
    uint someAmount;
    uint someAmount2;

    function havocDummyToken() private {
        if (erc20A.allowance(msg.sender, address(this)) > 0) {
            // preserves proxy eth balance if no eth passed
            if (msg.value == 0) {
                erc20A.havocMe(msg.sender);
            } else {
                erc20A.havocMeEth();
            }
        } else {
            // simulate receiving tokens
            erc20A.transferFrom(faucet, msg.sender, someAmount);
        }
    }

    // Rewarder
    function onGraceReward(
        uint256 pid,
        address user,
        address recipient,
        uint256 graceAmount,
        uint256 newLpAmount
    ) external {
        havocDummyToken();
    }

    // Archangel
    function getFountain(address) external returns (address) {
        return msg.sender;
    }

}