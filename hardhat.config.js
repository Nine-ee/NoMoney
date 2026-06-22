// require("@nomiclabs/hardhat-waffle");
// require("@nomiclabs/hardhat-ethers");

// module.exports = {
//   solidity: "0.8.18",
//   paths: {
//     artifacts: './frontend/src/artifacts'
//   },
//   networks: {
//     hardhat: {
//       chainId: 31337,
//     },
//     localhost: {
//       url: "http://127.0.0.1:8545",
//       chainId: 31337,
//     }
//   }
// };
require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");

module.exports = {
  solidity: "0.8.18",
  paths: {
    artifacts: './frontend/src/artifacts'
  },
  networks: {
    hardhat: {
      chainId: 31337,
      // 这些是 hardhat 网络默认配置，明确写出来
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    }
  }
};