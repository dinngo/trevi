pragma experimental ABIEncoderV2;

import "./DummyERC20A.sol";

interface IERC20WithDummyFunctionality {
    function transfer(address to, uint amt) external;
    function transferFrom(address from, address to, uint amt) external;
    function approve(address spender, uint256 amount) external;
    function balanceOf(address who) external returns (uint);
    function allowance(address a, address b) external returns (uint);
    function havocMe(address proxy) external;
    function havocMeEth() external;
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
    address fountainAddress;

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

    // Used to set fountain address in spec which will be used in `onlyFountain` modifier in Angel
    function setFountainAddress(address _fountain) external {
        fountainAddress = _fountain;
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
        return fountainAddress;
    }

    // FlashBorrower
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32) {
        require(IERC20WithDummyFunctionality(token).balanceOf(address(this)) >= amount, "No borrow funds");
        erc20A = IERC20WithDummyFunctionality(token);
        havocDummyToken();
        IERC20WithDummyFunctionality(token).approve(msg.sender, amount+fee);
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

}