const hre = require("hardhat");
const fs = require("fs");

async function main() {
  console.log("🚀 开始部署众筹项目...");

  // 部署参数
  const GOAL = hre.ethers.utils.parseEther("10");
  const DURATION = 60 * 60 * 24 * 1; // 1天 ✅ 改成1天
  const EARLY_BIRD_LIMIT = 3;        // 前3名
  const EARLY_BIRD_BONUS = 2000;      // 额外20%奖励

  // 1. 部署代币合约
  console.log("📦 部署代币合约...");
  const Token = await hre.ethers.getContractFactory("ProjectToken");
  const token = await Token.deploy();
  await token.deployed();
  console.log("✅ 代币合约地址:", token.address);

  // 2. 部署众筹合约
  console.log("📦 部署众筹合约...");
  const Crowdfunding = await hre.ethers.getContractFactory("Crowdfunding");
  const crowdfunding = await Crowdfunding.deploy(
    GOAL,
    DURATION,
    token.address,
    EARLY_BIRD_LIMIT,
    EARLY_BIRD_BONUS
  );
  await crowdfunding.deployed();
  console.log("✅ 众筹合约地址:", crowdfunding.address);

  // 3. 授权众筹合约可以铸造代币
  console.log("🔑 授权众筹合约铸造权限...");
  await token.setCrowdfundingAddress(crowdfunding.address);
  console.log("✅ 授权完成");

  // 4. 打印信息
  console.log("\n========== 🎉 部署完成 ==========");
  console.log("📌 代币合约:", token.address);
  console.log("📌 众筹合约:", crowdfunding.address);
  console.log("💰 众筹目标:", hre.ethers.utils.formatEther(GOAL), "ETH");
  console.log("⏰ 众筹时长:", DURATION / (60 * 60 * 24), "天");
  console.log("🦅 早鸟名额:", EARLY_BIRD_LIMIT, "人");
  console.log("🎁 早鸟奖励:", EARLY_BIRD_BONUS / 100, "%");
  console.log("==================================\n");

  // 5. 保存合约地址到前端配置文件
  const data = {
    crowdfundingAddress: crowdfunding.address,
    tokenAddress: token.address,
  };
  fs.writeFileSync("./frontend/src/contract-address.json", JSON.stringify(data, null, 2));
  console.log("✅ 合约地址已保存到 frontend/src/contract-address.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});