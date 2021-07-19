// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;
import "../interfaces/IRewarder.sol";
import "../libraries/boringcrypto/libraries/BoringERC20.sol";
import "../libraries/boringcrypto/libraries/BoringMath.sol";

contract RewarderMock is IRewarder {
    using BoringMath for uint256;
    using BoringERC20 for IERC20;
    uint256 private immutable rewardMultiplier;
    IERC20 private immutable rewardToken;
    uint256 private constant REWARD_TOKEN_DIVISOR = 1e18;
    address private immutable MASTERCHEF_V2;
    uint256 private immutable mode;
    mapping(uint256 => uint256) private _nums;

    modifier onlyMCV2 {
        require(
            msg.sender == MASTERCHEF_V2,
            "Only MCV2 can call this function."
        );
        _;
    }

    constructor(
        uint256 _rewardMultiplier,
        IERC20 _rewardToken,
        address _MASTERCHEF_V2,
        uint256 _mode
    ) public {
        rewardMultiplier = _rewardMultiplier;
        rewardToken = _rewardToken;
        MASTERCHEF_V2 = _MASTERCHEF_V2;
        mode = _mode;
    }

    function onGraceReward(
        uint256,
        address,
        address to,
        uint256 graceAmount,
        uint256
    ) external override onlyMCV2 {
        if (mode == 0) {
            uint256 pendingReward =
                graceAmount.mul(rewardMultiplier) / REWARD_TOKEN_DIVISOR;
            uint256 rewardBal = rewardToken.balanceOf(address(this));
            if (pendingReward > rewardBal) {
                rewardToken.safeTransfer(to, rewardBal);
            } else {
                rewardToken.safeTransfer(to, pendingReward);
            }
        } else if (mode == 1) {
            revert("bad rewarder");
        } else if (mode == 2) {
            gasMonster();
        } else {
            return;
        }
    }

    function pendingTokens(
        uint256,
        address,
        uint256 graceAmount
    )
        external
        view
        override
        returns (IERC20[] memory rewardTokens, uint256[] memory rewardAmounts)
    {
        IERC20[] memory _rewardTokens = new IERC20[](1);
        _rewardTokens[0] = (rewardToken);
        uint256[] memory _rewardAmounts = new uint256[](1);
        _rewardAmounts[0] =
            graceAmount.mul(rewardMultiplier) /
            REWARD_TOKEN_DIVISOR;
        return (_rewardTokens, _rewardAmounts);
    }

    function gasMonster() public {
        for (uint256 i = 0; i < 1000; i++) {
            _nums[i] = i;
        }
        return;
    }
}
