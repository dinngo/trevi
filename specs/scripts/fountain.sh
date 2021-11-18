#!/bin/bash
B=2
certoraRun contracts/Fountain.sol specs/harnesses/DummyERC20A.sol specs/harnesses/DummyERC20B.sol specs/harnesses/Summary.sol \
    --verify Fountain:specs/fountain.spec \
    --settings -assumeUnwindCond,-b=$B \
