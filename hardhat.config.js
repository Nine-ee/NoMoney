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
      // 自动挖矿：每秒挖一个区块，时间自动推进
      mining: {
        auto: true,
        interval: 1000  // 1秒挖一个区块
      }
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
      // 本地节点也设置自动挖矿
      timeout: 60000
    }
  }
};