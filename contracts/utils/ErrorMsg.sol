// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

abstract contract ErrorMsg {
    function getContractName() public pure virtual returns (string memory);

    function _requireMsg(
        bool condition,
        string memory functionName,
        string memory reason
    ) internal view {
        if (!condition) _revertMsg(functionName, reason);
    }

    function _requireMsg(bool condition, string memory functionName)
        internal
        view
    {
        if (!condition) _revertMsg(functionName);
    }

    function _revertMsg(string memory functionName, string memory reason)
        internal
        view
    {
        revert(
            string(
                abi.encodePacked(
                    getContractName(),
                    "_",
                    functionName,
                    ": ",
                    reason
                )
            )
        );
    }

    function _revertMsg(string memory functionName) internal view {
        _revertMsg(functionName, "Unspecified");
    }
}
