## Fountain ##
# Replace ReentrancyGuard with public status getter contract
perl -0777 -i -pe 's/\@openzeppelin\/contracts\/utils\/ReentrancyGuard.sol/..\/specs\/harnesses\/ReentrancyGuardPublic.sol/g' contracts/FountainBase.sol
perl -0777 -i -pe 's/is FountainToken, ReentrancyGuard,/is FountainToken, ReentrancyGuardPublic,/g' contracts/FountainBase.sol

# Skip the inheritance of batchable contract otherwise the prover will timeout
perl -0777 -i -pe 's/ERC20FlashLoan,
    BoringBatchable/ERC20FlashLoan/g' contracts/Fountain.sol

# Add hasJoinedAngel function
perl -0777 -i -pe 's/, ErrorMsg {/, ErrorMsg  {
    function hasJoinedAngel\(address user, address angel\) external view returns \(bool\) {
        IAngel[] storage angels = _joinedAngels[user];
        for \(uint256 i = 0; i < angels.length; i++\) {
            if \(angel == address\(angels[i]\)\) return true;
        }
        return false;
    }
    /g' contracts/FountainBase.sol


## Angel ##
# Skip the inheritance of batchable contract otherwise the prover will timeout
perl -0777 -i -pe 's/is BoringOwnable, BoringBatchable,/is BoringOwnable,/g' contracts/AngelBase.sol

# Add getter functions
perl -0777 -i -pe 's/, ErrorMsg {/, ErrorMsg  {
    function lpTokenLength\(\) external view returns \(uint256\) {
        return lpToken.length;
    }

    function rewarderLength\(\) external view returns \(uint256\) {
        return rewarder.length;
    }
    /g' contracts/AngelBase.sol