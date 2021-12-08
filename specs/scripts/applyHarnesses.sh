# Replace ReentrancyGuard with public status getter contract
perl -0777 -i -pe 's/\@openzeppelin\/contracts\/utils\/ReentrancyGuard.sol/..\/specs\/harnesses\/ReentrancyGuardPublic.sol/g' contracts/FountainBase.sol
perl -0777 -i -pe 's/is FountainToken, ReentrancyGuard,/is FountainToken, ReentrancyGuardPublic,/g' contracts/FountainBase.sol

# Skip the inheritance of batchable contract otherwise the prover will timeout
perl -0777 -i -pe 's/ERC20FlashLoan,
    BoringBatchable/ERC20FlashLoan/g' contracts/Fountain.sol