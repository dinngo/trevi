#!/bin/bash
if [ -z "$1" ] 
then
    echo "missing description"
    exit 1
fi
B=2
certoraRun contracts/Fountain.sol contracts/Angel.sol specs/harnesses/DummyERC20A.sol specs/harnesses/DummyERC20B.sol specs/harnesses/Summary.sol \
    --verify Fountain:specs/fountain.spec \
    --link Fountain:stakingToken=DummyERC20A Fountain:lendingToken=DummyERC20A \
    --settings -assumeUnwindCond,-t=600,-ignoreViewFunctions,-b=$B \
    --msg "Fountain - $1"