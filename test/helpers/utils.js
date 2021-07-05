async function getCreated(receipt, contract) {
  return await contract.at(receipt.logs[0].args.to);
}

module.exports = {
  getCreated,
};
